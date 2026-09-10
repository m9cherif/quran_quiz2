import { NextResponse } from "next/server";
import { checkEmailVerification } from "@/lib/auth/emailGateway";
import { createEmailSession } from "@/lib/auth/server";
import { sessionCookieOptions } from "@/lib/db/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mirrors /api/auth/phone/check — same contract, email channel instead of SMS. */

export async function POST(request: Request) {
  let body: { email?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (code.length !== 6) {
    return NextResponse.json({ ok: false, reason: "code_wrong" }, { status: 401 });
  }

  const outcome = await checkEmailVerification(email, code);

  switch (outcome.status) {
    case "incorrect":
      return NextResponse.json(
        { ok: false, reason: "code_wrong", attemptsRemaining: outcome.attemptsRemaining },
        { status: 401 }
      );
    case "expired":
      return NextResponse.json({ ok: false, reason: "code_expired" }, { status: 401 });
    case "attempts_exhausted":
      return NextResponse.json({ ok: false, reason: "attempts_exhausted" }, { status: 429 });
    case "no_verification":
      return NextResponse.json({ ok: false, reason: "code_expired" }, { status: 401 });
    case "failed":
      return NextResponse.json(
        { ok: false, reason: outcome.reason === "provider_error" ? "check_failed" : outcome.reason },
        { status: 502 }
      );
    case "verified":
      break;
  }

  try {
    const session = await createEmailSession(outcome.phone);
    if (!session) {
      return NextResponse.json({ ok: false, reason: "no_account" }, { status: 404 });
    }
    const response = NextResponse.json({ ok: true, userId: session.userId });
    const cookie = sessionCookieOptions(session.expiresAt);
    response.cookies.set(cookie.name, session.token, cookie);
    return response;
  } catch (err) {
    console.error("[verify] verified an email but could not start a session:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, reason: "provider_error" }, { status: 502 });
  }
}
