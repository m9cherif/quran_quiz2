import {
  BirdAPIError,
  BirdAuthError,
  BirdBillingError,
  BirdClient,
  BirdConnectionError,
  BirdPermissionError,
  BirdRateLimitError,
  BirdTimeoutError,
  BirdValidationError,
} from "@messagebird/sdk";
import { redactPhone } from "@/lib/auth/phoneNumber";

/**
 * Bird Verify: the one place a phone sign-in code is made and judged.
 *
 * Verify owns the code end to end. It generates it, sends it over the SMS
 * channel of the workspace (the Bird Shared Pool, unless the workspace has its
 * own registered sender), counts the attempts, expires it, and answers whether
 * the digits a person typed are the digits it sent. Nothing in this repo
 * generates a code, stores one, or decides that one has expired — if it did,
 * there would be two codes and only one of them would work.
 *
 * That is also why Supabase's own phone OTP is not used for numbers: calling
 * `signInWithOtp({ phone })` would have Supabase mint a second, unrelated code.
 * Supabase still owns the session; it just no longer owns the code.
 *
 * Needs, in the environment:
 *   BIRD_API_KEY   a live Bird access key with the verify scope
 *
 * The key carries its own region (`bk_{region}_…`) and the workspace it belongs
 * to, so there is no workspace id, no channel id and no base URL to configure.
 * A key from a different region simply talks to that region.
 */

/** Every way asking for a code can fail, in words the UI can act on. */
export type VerifyFailure =
  /** BIRD_API_KEY is absent — the deployment was never finished. */
  | "not_configured"
  /** The key is rejected or lacks the scope: also a deployment problem. */
  | "bad_credentials"
  /** Bird will not accept this number at all. */
  | "invalid_number"
  /** A valid number Bird cannot deliver to over SMS. */
  | "unsupported_destination"
  /** Codes asked for (or checked) faster than Bird allows. */
  | "too_many_requests"
  /** The workspace wallet will not cover the message. */
  | "insufficient_balance"
  /** Bird answered, but with something we do not handle. */
  | "provider_error"
  /** Bird did not answer at all. */
  | "network_error";

/** What became of a code someone typed. */
export type CheckOutcome =
  | { status: "verified" }
  /** Wrong digits, and Verify is still willing to hear another guess. */
  | { status: "incorrect"; attemptsRemaining: number | null }
  | { status: "expired" }
  | { status: "attempts_exhausted" }
  /** Nothing is in progress for this number: never started, or already over. */
  | { status: "no_verification" }
  | { status: "failed"; reason: VerifyFailure };

/** The verification that was started, as far as the caller needs to know it. */
export interface StartedVerification {
  /** When the code stops being accepted, ISO 8601, straight from Bird. */
  expiresAt: string;
}

export type StartOutcome =
  | { status: "sent"; verification: StartedVerification }
  | { status: "failed"; reason: VerifyFailure };

/** Thrown only for the one failure that is ours rather than Bird's. */
class BirdNotConfigured extends Error {}

let client: BirdClient | null = null;

function getClient(): BirdClient {
  const apiKey = process.env.BIRD_API_KEY;
  if (!apiKey) throw new BirdNotConfigured("BIRD_API_KEY is not set");
  if (!client) {
    // The region lives in the key's prefix, so the SDK resolves the host
    // itself. BIRD_REGION is only here for a key minted before that prefix
    // existed, which would otherwise fail at construction with no way out.
    const region = process.env.BIRD_REGION;
    client = new BirdClient({ apiKey, ...(region ? { region } : {}) });
  }
  return client;
}

/**
 * Read a Bird refusal as one of our reasons.
 *
 * The SDK throws a typed error per status class, which covers most of it. The
 * exception is 422: Bird uses it both for a number it will not accept and for
 * a request whose channel list leaves nothing usable — the second is what a
 * country with no SMS route looks like from here. The named field tells them
 * apart when Bird supplies one.
 */
function classify(err: unknown): VerifyFailure {
  if (err instanceof BirdNotConfigured) return "not_configured";
  if (err instanceof BirdAuthError || err instanceof BirdPermissionError) return "bad_credentials";
  if (err instanceof BirdRateLimitError) return "too_many_requests";
  if (err instanceof BirdBillingError) return "insufficient_balance";
  if (err instanceof BirdConnectionError || err instanceof BirdTimeoutError) return "network_error";
  if (err instanceof BirdValidationError) {
    const aboutTheNumber =
      err.param?.includes("to") ||
      err.details?.some((detail) => JSON.stringify(detail).includes("phone_number"));
    return aboutTheNumber ? "invalid_number" : "unsupported_destination";
  }
  if (err instanceof BirdAPIError) {
    if (err.statusCode === 422) return "unsupported_destination";
    return "provider_error";
  }
  return "network_error";
}

/** What Bird said, trimmed to something a server log can hold. */
function describe(err: unknown): string {
  if (err instanceof BirdAPIError) {
    return `${err.statusCode} ${err.code} (request ${err.requestId})`;
  }
  return err instanceof Error ? err.message.slice(0, 200) : "unknown error";
}

/**
 * Ask Bird to send a code to a number.
 *
 * Asking again for the same number is the resend: Verify continues the
 * verification already in progress rather than starting a second one, which is
 * why there is no separate resend call and no verification id to keep.
 *
 * The channel list is pinned to SMS on purpose. Left off, Verify would deliver
 * over whichever channels the destination country has enabled — WhatsApp among
 * them — and the screen promises a text message.
 */
export async function startPhoneVerification(phone: string): Promise<StartOutcome> {
  try {
    const verification = await getClient().verify.verifications.create({
      to: { phone_number: phone },
      options: { channels: ["sms"], code_length: 6 },
    });
    return { status: "sent", verification: { expiresAt: verification.expires_at } };
  } catch (err) {
    const reason = classify(err);
    console.error(`[verify] could not send to ${redactPhone(phone)}: ${reason}: ${describe(err)}`);
    return { status: "failed", reason };
  }
}

/**
 * Hand Bird the digits someone typed and report what it made of them.
 *
 * A wrong or expired code is not an error here — Bird answers 200 with
 * `success: false` and a reason, because a person mistyping a code is an
 * ordinary event, not a fault. Only a check that could not be evaluated at all
 * raises.
 */
export async function checkPhoneVerification(phone: string, code: string): Promise<CheckOutcome> {
  try {
    const result = await getClient().verify.verifications.check({
      to: { phone_number: phone },
      code,
    });
    if (result.success) return { status: "verified" };

    switch (result.reason) {
      case "expired":
        return { status: "expired" };
      case "attempts_exhausted":
        return { status: "attempts_exhausted" };
      // `incorrect_code`, and anything Bird adds later: the code did not match
      // and the verification is still open, which is the same thing to a user.
      default:
        return { status: "incorrect", attemptsRemaining: result.attempts_remaining ?? null };
    }
  } catch (err) {
    // Bird answers 404 both for a number with no verification and for one whose
    // verification already finished — a code checked twice, or checked after it
    // ran out. Asking for a new one is the way out of all of them.
    if (err instanceof BirdAPIError && err.statusCode === 404) {
      return { status: "no_verification" };
    }
    const reason = classify(err);
    console.error(`[verify] could not check ${redactPhone(phone)}: ${reason}: ${describe(err)}`);
    return { status: "failed", reason };
  }
}
