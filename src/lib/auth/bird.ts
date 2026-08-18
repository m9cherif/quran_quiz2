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
import type {
  CheckOutcome,
  StartOutcome,
  VerifyFailure,
} from "@/lib/auth/verifyTypes";

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
  // Bird names this one, and it is not a fault: it means every channel that
  // could reach this number has already been tried.
  if (err instanceof BirdAPIError && /NoNextChannel/i.test(err.errorName ?? "")) {
    return "no_next_channel";
  }
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
 * Which channels to try, in order, or undefined to use the ones Bird has
 * configured for the destination country.
 *
 * Naming them here narrows the plan: a channel left out is not used for the
 * request. That sounds harmless and is not — pinning the list to `sms` also
 * removes the failover, so a country whose SMS route is refusing has nothing
 * left to try and the code silently never arrives. Bird's own order for the
 * destination already prefers SMS, so the default is to let it decide and fall
 * back if it must.
 *
 * VERIFY_CHANNELS forces the matter when SMS and nothing else will do:
 * `VERIFY_CHANNELS=sms`.
 */
function configuredChannels(): string[] | undefined {
  const raw = process.env.VERIFY_CHANNELS?.trim();
  if (!raw) return undefined;
  const channels = raw.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  return channels.length > 0 ? channels : undefined;
}

/**
 * Ask Bird to send a code to a number.
 *
 * Asking again for the same number is the resend: Verify continues the
 * verification already in progress rather than starting a second one, which is
 * why there is no separate resend call and no verification id to keep.
 *
 * A word on what "sent" means here. Bird answers 200 the moment it accepts the
 * request, with the verification `pending` — delivery happens after that and is
 * reported separately. So this returning `sent` means asked-for, not arrived,
 * and no synchronous call can tell the difference: Verify has no read endpoint
 * to poll, only create, check and next-channel. What it does return is the
 * channel plan it resolved for the number, which is the one clue available at
 * this point about whether the message had anywhere to go — so it is logged.
 */
export async function startPhoneVerification(phone: string): Promise<StartOutcome> {
  try {
    const channels = configuredChannels();
    const verification = await getClient().verify.verifications.create({
      to: { phone_number: phone },
      options: {
        code_length: 6,
        ...(channels ? { channels } : {}),
      },
    });

    const plan = verification.channels?.map((entry) => entry.channel).join(",") || "none";
    const lastChannel = verification.last_channel ?? null;
    // The verification id is what Bird support asks for, and the plan is what
    // says whether this number had a route at all: a plan of "none" means Bird
    // accepted a verification it has no way to deliver.
    console.info(
      `[verify] requested for ${redactPhone(phone)}: id=${verification.id} ` +
        `status=${verification.status} plan=${plan} sent_on=${lastChannel ?? "pending"}`
    );

    return {
      status: "sent",
      verification: {
        expiresAt: verification.expires_at,
        channel: lastChannel,
        reference: null,
      },
    };
  } catch (err) {
    const reason = classify(err);
    console.error(`[verify] could not send to ${redactPhone(phone)}: ${reason}: ${describe(err)}`);
    return { status: "failed", reason };
  }
}

/**
 * Send a fresh code on the next channel in the plan: the "I did not get it"
 * action, for when SMS is accepted and then quietly goes nowhere.
 *
 * The send skips the resend cooldown, because deliberately changing channel is
 * a different act from pressing resend, and every code already sent stays
 * valid — one arriving late can still be typed in.
 */
export async function advancePhoneVerification(phone: string): Promise<StartOutcome> {
  try {
    const verification = await getClient().verify.verifications.nextChannel({
      to: { phone_number: phone },
    });
    console.info(
      `[verify] advanced ${redactPhone(phone)}: id=${verification.id} ` +
        `sent_on=${verification.last_channel ?? "pending"}`
    );
    return {
      status: "sent",
      verification: {
        expiresAt: verification.expires_at,
        channel: verification.last_channel ?? null,
        reference: null,
      },
    };
  } catch (err) {
    const reason = classify(err);
    // "No next channel" is an answer, not a fault: it means every way of
    // reaching this number has been tried. Logging it as an error sends
    // whoever reads the log hunting for a break that is not there — the real
    // finding is that the number has exactly one usable channel.
    const line = `[verify] could not advance ${redactPhone(phone)}: ${reason}: ${describe(err)}`;
    if (reason === "no_next_channel") console.info(line);
    else console.error(line);
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
    // Bird identifies the verification by the number we sent, so the number
    // verified is the number asked about.
    if (result.success) return { status: "verified", phone };

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
