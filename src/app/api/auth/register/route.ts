import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/auth/phoneNumber";
import { createUserAccount } from "@/lib/auth/server";

export const runtime = "nodejs";

const ROLES = new Set(["host", "student"]);

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; phone?: unknown; role?: unknown };
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

  try {
    await createUserAccount({
      name,
      ...(email ? { email } : { phone }),
      role: role as "host" | "student",
    });
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
