import { NextResponse } from "next/server";
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
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
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
  if (phone && !/^\+\d{8,15}$/.test(phone)) {
    return NextResponse.json({ error: "Enter the phone number in international format" }, { status: 400 });
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
