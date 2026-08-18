import { NextResponse } from "next/server";
import { checkPhoneVerification, type VerifyFailure } from "@/lib/auth/bird";
import { normalizePhone, redactPhone } from "@/lib/auth/phoneNumber";
import { createPhoneSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step two: hand Bird the code, and on its word, sign the person in.
 *
 * Bird decides whether the digits are right — it made the code, it counted the
 * attempts, it knows when the window closed. This route decides nothing about
 * the code and only acts on the answer, which is what keeps a single source of
 * truth: there is no second code here to disagree with Bird's.
 *
 * A session is granted on nothing but a verified phone number, so the order
 * matters. Bird first, always. Nothing below the check may run before it.
 */

const STATUS: Record<VerifyFailure, number> = {
  no_next_channel: 409,
  not_configured: 500,
  bad_credentials: 500,
  invalid_number: 400,
  unsupported_destination: 400,
  too_many_requests: 429,
  insufficient_balance: 502,
  provider_error: 502,
  network_error: 502,
};

export async function POST(request: Request) {
  let body: { phone?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }

  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : null;
  if (!phone) {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }

  // Bird's codes are digits. Anything else never reaches it — not for safety,
  // it is a POST body either way, but because a check that cannot succeed
  // should not spend one of the attempts Bird is counting.
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (code.length < 4 || code.length > 10) {
    return NextResponse.json({ ok: false, reason: "code_wrong" }, { status: 401 });
  }

  const outcome = await checkPhoneVerification(phone, code);

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
      // Never started, already finished, or checked a second time. All of them
      // end the same way: ask for a new code.
      return NextResponse.json({ ok: false, reason: "code_expired" }, { status: 401 });
    case "failed":
      return NextResponse.json(
        { ok: false, reason: outcome.reason },
        { status: STATUS[outcome.reason] }
      );
    case "verified":
      break;
  }

  // Bird has confirmed the number. Everything from here is Supabase's side.
  try {
    const session = await createPhoneSession(phone);
    if (!session) {
      // The account went away between asking for the code and typing it.
      return NextResponse.json({ ok: false, reason: "no_account" }, { status: 404 });
    }
    // The browser puts these straight into the Supabase client. They are the
    // same tokens verifyOtp would have handed it, over the same TLS, and they
    // are the whole reason this response is never cached.
    return NextResponse.json({
      ok: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    });
  } catch (err) {
    console.error(
      `[verify] verified ${redactPhone(phone)} but could not start a session:`,
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ ok: false, reason: "provider_error" }, { status: 502 });
  }
}
