import { NextResponse } from "next/server";
import {
  advancePhoneVerification,
  startPhoneVerification,
  type VerifyFailure,
} from "@/lib/auth/bird";
import { normalizePhone, redactPhone } from "@/lib/auth/phoneNumber";
import { getServiceClient } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step one of signing in by phone: ask Bird Verify to text a code.
 *
 * The browser never talks to Bird. It cannot: the key that would let it is the
 * same key that can send messages at this workspace's expense, so it lives in
 * the server environment and this route is the only thing that reads it.
 *
 * Asking twice for the same number is the resend. Bird treats a repeat call as
 * a continuation of the verification already in progress — inside its cooldown
 * it answers with the current state and sends nothing, after it a fresh code
 * goes out — so there is no second endpoint and nothing to remember between
 * the two calls.
 */

/** How the failure is reported: a wrong number is the caller's, a missing key is ours. */
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
  let body: { phone?: unknown; advance?: unknown };
  try {
    body = await request.json();
  } catch {
    // A body that is not JSON at all is a caller mistake rather than a bad
    // number, and saying so saves the next person a confusing 400.
    return NextResponse.json({ ok: false, reason: "malformed_request" }, { status: 400 });
  }

  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : null;
  if (!phone) {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }

  // Signing in never creates an account, so a number nobody registered has
  // nowhere to sign in to. Checking first also keeps a stranger from spending
  // this workspace's balance on numbers picked at random: without it the route
  // would send a real SMS to anything shaped like a phone number.
  let userId: string | null = null;
  try {
    const { data, error } = await getServiceClient().rpc("auth_user_id_for_phone", {
      p_phone: phone,
    });
    if (error) throw error;
    userId = (data as string | null) ?? null;
  } catch (err) {
    console.error(
      `[verify] could not look up ${redactPhone(phone)}:`,
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ ok: false, reason: "provider_error" }, { status: 502 });
  }
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "no_account" }, { status: 404 });
  }

  // "I did not get it": move the verification on to the next channel in its
  // plan instead of resending into the same silence.
  const outcome =
    body?.advance === true
      ? await advancePhoneVerification(phone)
      : await startPhoneVerification(phone);

  if (outcome.status === "failed") {
    return NextResponse.json(
      { ok: false, reason: outcome.reason },
      { status: STATUS[outcome.reason] }
    );
  }

  // The expiry is Bird's, not ours — the screen can say when the code dies
  // without this repo holding an opinion about how long that is. The channel
  // is reported because it is not always the one that was asked for.
  return NextResponse.json({
    ok: true,
    expiresAt: outcome.verification.expiresAt,
    channel: outcome.verification.channel,
  });
}
