import { normalizeInternational, redactPhone } from "@/lib/auth/phoneNumber";
import type { CheckOutcome, StartOutcome, VerifyFailure } from "@/lib/auth/verifyTypes";

/**
 * Telegram Gateway: sign-in codes that never touch a carrier.
 *
 * Tunisia is why this exists. Every SMS route into +216 is either filtered by
 * the carrier or closed to new accounts by the provider's fraud checks — three
 * of them refused before this one, one of them refusing even to verify a
 * Tunisian number at signup. Telegram delivers over the internet to a Telegram
 * account, so none of that applies: there is no sender ID to register, no
 * carrier to please, and no country to be shut out of.
 *
 * It costs $0.01 a verification, and codes sent to the number that owns the
 * Gateway account are free — which is the whole test cycle at no charge.
 *
 * The trade is real and worth stating: the recipient must have Telegram on
 * that number. Someone who does not cannot be reached this way, which is why
 * this is a provider you can switch to rather than a replacement.
 *
 * Needs, in the environment:
 *   TELEGRAM_GATEWAY_TOKEN   the token from gateway.telegram.org
 *
 * Reference: https://core.telegram.org/gateway/api
 */

const BASE_URL = "https://gatewayapi.telegram.org";

/** The envelope every method answers with. */
interface GatewayResponse {
  ok?: boolean;
  error?: string;
  result?: {
    request_id: string;
    /** Whom Telegram actually sent to — trusted over anything a browser says. */
    phone_number: string;
    request_cost?: number;
    remaining_balance?: number;
    delivery_status?: { status: string; updated_at: number };
    verification_status?: { status: string; updated_at: number; code_entered?: string };
  };
}

/**
 * Telegram reports failure as a string rather than a status code, so the
 * mapping is by name. Anything unrecognised is treated as the provider's
 * problem rather than the caller's, which is the safer way round: it shows a
 * "try again" instead of blaming a number that may be perfectly good.
 */
function classify(error: string): VerifyFailure {
  const code = error.toUpperCase();
  if (code.includes("BALANCE")) return "insufficient_balance";
  if (code.includes("TOKEN") || code.includes("ACCESS")) return "bad_credentials";
  if (code.includes("PHONE_NUMBER_INVALID")) return "invalid_number";
  // Telegram says this when the number has no Telegram account, or cannot be
  // reached — the number is fine, this route just cannot carry a code to it.
  if (code.includes("PHONE_NUMBER_NOT_FOUND") || code.includes("SEND_ABILITY")) {
    return "unsupported_destination";
  }
  if (code.includes("FLOOD") || code.includes("TOO_MANY")) return "too_many_requests";
  return "provider_error";
}

async function call(
  method: string,
  body: Record<string, string | number>
): Promise<GatewayResponse & { httpStatus: number }> {
  const token = process.env.TELEGRAM_GATEWAY_TOKEN;
  if (!token) throw new Error("not_configured");

  const response = await fetch(`${BASE_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Telegram reports its own failures inside a 200, so the HTTP status is
  // usually 200 either way — but when it is not, that is worth knowing, and a
  // body that will not parse at all is worth knowing even more.
  const text = await response.text();
  try {
    return { ...(JSON.parse(text) as GatewayResponse), httpStatus: response.status };
  } catch {
    console.error(
      `[verify] telegram ${method} returned ${response.status} and no JSON: ${text.slice(0, 200)}`
    );
    return { ok: false, error: `http_${response.status}`, httpStatus: response.status };
  }
}

/**
 * Ask Telegram to send a code.
 *
 * Telegram makes the code (`code_length`) and checks it later, so this repo
 * still never holds one — the same division of labour Bird Verify has, which
 * is what lets the two sit behind one interface.
 *
 * `checkSendAbility` is deliberately not called first: it bills exactly like a
 * send, so using it as a pre-flight would double the cost of every sign-in.
 *
 * Unlike Bird, a verification is identified afterwards by `request_id` rather
 * than by the number, so that id is handed back to be quoted on the check.
 */
export async function startTelegramVerification(phone: string): Promise<StartOutcome> {
  try {
    const body = await call("sendVerificationMessage", {
      phone_number: phone,
      code_length: 6,
      // Undelivered messages are refunded automatically once this elapses, so
      // an unread code costs nothing. An hour is Telegram's maximum.
      ttl: 600,
    });

    if (!body.ok || !body.result) {
      const reason = classify(body.error ?? "");
      console.error(`[verify] telegram refused ${redactPhone(phone)}: ${reason}: ${body.error}`);
      return { status: "failed", reason };
    }

    // The balance rides along on every response. Logging it means an emptying
    // wallet is visible before it becomes an outage — the failure that cost
    // days on the previous provider announced itself nowhere at all.
    console.info(
      `[verify] telegram sent to ${redactPhone(phone)}: request=${body.result.request_id} ` +
        `cost=${body.result.request_cost ?? "?"} balance=${body.result.remaining_balance ?? "?"}`
    );

    return {
      status: "sent",
      verification: {
        // Telegram gives no expiry; the ttl above is what the message lives for.
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        channel: "telegram",
        reference: body.result.request_id,
      },
    };
  } catch (err) {
    const reason = err instanceof Error && err.message === "not_configured" ? "not_configured" : "network_error";
    console.error(`[verify] telegram could not send to ${redactPhone(phone)}: ${reason}`);
    return { status: "failed", reason };
  }
}

/**
 * Hand Telegram the digits and report what it made of them.
 *
 * The number that comes back is Telegram's, read off the verification itself,
 * and it is the one the caller should trust. A browser supplies the request id
 * and the code; letting it also name the account to sign into would mean a
 * correct code for one number could open another.
 */
export async function checkTelegramVerification(
  reference: string,
  code: string
): Promise<CheckOutcome> {
  try {
    const body = await call("checkVerificationStatus", { request_id: reference, code });

    if (!body.ok || !body.result) {
      const reason = classify(body.error ?? "");
      // A request id Telegram does not know is the same situation as a
      // verification that has already finished: ask for a new code.
      if ((body.error ?? "").toUpperCase().includes("REQUEST_ID")) {
        return { status: "no_verification" };
      }
      // Quoted verbatim: an unrecognised error is exactly the one worth
      // reading, and guessing at its shape is what made this hard to diagnose.
      console.error(
        `[verify] telegram check failed: http=${body.httpStatus} ` +
          `reason=${reason} error=${JSON.stringify(body.error)}`
      );
      return { status: "failed", reason };
    }

    const status = body.result.verification_status?.status;
    // Telegram echoes the number back without its plus, and it is already
    // international — reading it as a local number is how it got mangled.
    const phone = normalizeInternational(body.result.phone_number);

    switch (status) {
      case "code_valid":
        if (!phone) {
          console.error(
            `[verify] telegram verified a number that will not normalise: ` +
              `${redactPhone(body.result.phone_number)}`
          );
          return { status: "failed", reason: "provider_error" };
        }
        return { status: "verified", phone };
      case "expired":
        return { status: "expired" };
      case "code_max_attempts_exceeded":
        return { status: "attempts_exhausted" };
      // `code_invalid`, and anything Telegram adds later.
      default:
        return { status: "incorrect", attemptsRemaining: null };
    }
  } catch (err) {
    const reason = err instanceof Error && err.message === "not_configured" ? "not_configured" : "network_error";
    console.error(`[verify] telegram could not check: ${reason}`);
    return { status: "failed", reason };
  }
}
