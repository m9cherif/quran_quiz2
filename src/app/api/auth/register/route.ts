import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/auth/phoneNumber";
import { createUserAccount, getServiceClient } from "@/lib/auth/server";

export const runtime = "nodejs";

const ROLES = new Set(["host", "student", "admin"]);

/**
 * An admin account needs a one-time key, not just a role picked off a form —
 * the other two roles are self-service by design, this one is not. The key
 * is a single long random secret (sha256'd, no salt: unlike a six-digit SMS
 * code this has enough entropy on its own).
 *
 * Checked here, but only deleted (spending it) once the account it gates has
 * actually been created — checking and consuming in one step would burn the
 * key on a request that fails afterward for an unrelated reason (duplicate
 * email, say), leaving nothing anyone could use to register the intended
 * admin account.
 */
async function adminKeyExists(key: string): Promise<boolean> {
  const hash = createHash("sha256").update(key).digest("hex");
  const { count, error } = await getServiceClient()
    .from("admin_keys")
    .select("id", { count: "exact", head: true })
    .eq("key_hash", hash);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function spendAdminKey(key: string): Promise<void> {
  const hash = createHash("sha256").update(key).digest("hex");
  const { error } = await getServiceClient().from("admin_keys").delete().eq("key_hash", hash);
  if (error) {
    // The account is already created at this point — worth knowing about,
    // not worth failing the request over.
    console.error("Could not spend the admin key after account creation:", error);
  }
}

export async function POST(request: Request) {
  let body: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    role?: unknown;
    adminKey?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  // The same normaliser the browser and the Verify routes use. An account
  // stored in one form and verified in another is an account nobody can sign
  // in to, and the number only has to survive one round trip to prove it.
  const phoneGiven = typeof body?.phone === "string" && body.phone.trim() !== "";
  const phone = phoneGiven ? (normalizePhone(body.phone as string) ?? "") : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const adminKey = typeof body?.adminKey === "string" ? body.adminKey.trim() : "";

  if (name.length < 2 || name.length > 50) {
    return NextResponse.json({ error: "Name must be between 2 and 50 characters" }, { status: 400 });
  }
  // One or the other, never both: the account is reached by whichever the
  // person gave, and the browser has already worked out which that is.
  if (email && phone) {
    return NextResponse.json({ error: "Give an email address or a phone number, not both" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  // A number that survived being typed but not being normalised is a number,
  // just not a usable one — saying "enter an email or a phone" to someone who
  // did enter a phone would send them looking for the wrong mistake.
  if (phoneGiven && !phone) {
    return NextResponse.json(
      { error: "Enter the phone number in international format, e.g. +21622345678" },
      { status: 400 }
    );
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "Enter an email address or a phone number" }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid account role" }, { status: 400 });
  }
  if (role === "admin") {
    if (!adminKey) {
      return NextResponse.json({ error: "An admin registration key is required" }, { status: 400 });
    }
    let keyOk: boolean;
    try {
      keyOk = await adminKeyExists(adminKey);
    } catch (err) {
      console.error("Admin key check failed:", err);
      return NextResponse.json({ error: "Could not create the account. Try again." }, { status: 500 });
    }
    // Same message as an unknown/expired code elsewhere in this flow —
    // "invalid" and "already used" tell an attacker equally little.
    if (!keyOk) {
      return NextResponse.json({ error: "Invalid or already-used admin key" }, { status: 403 });
    }
  }

  try {
    await createUserAccount({
      name,
      ...(email ? { email } : { phone }),
      role: role as "host" | "student" | "admin",
    });
    if (role === "admin") await spendAdminKey(adminKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    if (message.toLowerCase().includes("already")) {
      return NextResponse.json(
        { error: "An account already uses this email address or phone number" },
        { status: 409 }
      );
    }
    // eslint-disable-next-line no-console
    console.error("Registration error:", message);
    return NextResponse.json({ error: "Could not create the account. Try again." }, { status: 500 });
  }
}
