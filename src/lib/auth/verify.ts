import {
  advancePhoneVerification as birdAdvance,
  checkPhoneVerification as birdCheck,
  startPhoneVerification as birdStart,
} from "@/lib/auth/bird";
import { checkTelegramVerification, startTelegramVerification } from "@/lib/auth/telegram";
import type { CheckOutcome, StartOutcome, VerifyFailure } from "@/lib/auth/verifyTypes";

export type { CheckOutcome, StartOutcome, VerifyFailure } from "@/lib/auth/verifyTypes";

/**
 * Which service sends and judges the sign-in code — and what to do when it
 * cannot reach someone.
 *
 * Neither option covers everybody, which is why this is a list rather than a
 * choice:
 *
 *   telegram  Telegram Gateway. No carrier involved, so nothing is filtered
 *             and no country is locked out, and codes to your own number cost
 *             nothing. Reaches only a number that has Telegram.
 *   bird      SMS, and WhatsApp where the workspace has a sender. Reaches any
 *             phone at all, and needs a funded wallet to do it.
 *
 * So `VERIFY_PROVIDER=telegram,bird` spends nothing on the people Telegram can
 * reach and falls through to SMS for the rest. A single name still works and
 * means exactly that one.
 *
 * Whatever the order, the bargain never changes: the provider makes the code,
 * counts the attempts, decides when it expired and says whether the digits
 * were right. Nothing here ever holds a code.
 */
export type ProviderName = "bird" | "telegram";

const DEFAULT_ORDER: ProviderName[] = ["bird"];

/** The providers to try, in order. */
export function providerOrder(): ProviderName[] {
  const raw = process.env.VERIFY_PROVIDER?.trim().toLowerCase();
  if (!raw) return DEFAULT_ORDER;
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name): name is ProviderName => name === "bird" || name === "telegram");
  return names.length > 0 ? names : DEFAULT_ORDER;
}

/**
 * Failures that mean "not this provider" rather than "not at all".
 *
 * A number with no Telegram account, a provider that was never configured, an
 * empty wallet — none of them say anything about whether the next provider can
 * help, so the chain moves on. A malformed number does say something, and so
 * does a network that is down, so those stop it: trying again elsewhere would
 * fail the same way, and only cost a second send to prove it.
 */
const WORTH_FALLING_THROUGH: ReadonlySet<VerifyFailure> = new Set<VerifyFailure>([
  "unsupported_destination",
  "not_configured",
  "bad_credentials",
  "insufficient_balance",
]);

function startWith(name: ProviderName, phone: string): Promise<StartOutcome> {
  return name === "telegram" ? startTelegramVerification(phone) : birdStart(phone);
}

/**
 * Ask the first provider that can reach this number to send a code.
 *
 * The provider that succeeded is stamped onto the reference, because the check
 * has to reach the same one — a code Telegram made means nothing to Bird. It
 * travels through the browser, which never reads it and cannot gain anything by
 * changing it: a check sent to the wrong provider simply does not verify.
 */
export async function startPhoneVerification(phone: string): Promise<StartOutcome> {
  const order = providerOrder();
  let lastFailure: VerifyFailure = "not_configured";

  for (const name of order) {
    const outcome = await startWith(name, phone);
    if (outcome.status === "sent") {
      return {
        status: "sent",
        verification: {
          ...outcome.verification,
          reference: `${name}:${outcome.verification.reference ?? ""}`,
        },
      };
    }
    lastFailure = outcome.reason;
    if (!WORTH_FALLING_THROUGH.has(outcome.reason)) break;
    if (order.length > 1) {
      console.info(`[verify] ${name} could not take it (${outcome.reason}) — trying the next`);
    }
  }

  return { status: "failed", reason: lastFailure };
}

/** Split a stamped reference back into who sent it and what they called it. */
function readReference(reference: string | null): { name: ProviderName; id: string | null } {
  if (reference) {
    const separator = reference.indexOf(":");
    if (separator > 0) {
      const name = reference.slice(0, separator);
      const id = reference.slice(separator + 1);
      if (name === "bird" || name === "telegram") return { name, id: id || null };
    }
  }
  // No stamp: a code requested before this existed, or by the email path.
  return { name: providerOrder()[0], id: null };
}

/**
 * Check the digits someone typed, against whoever sent them.
 *
 * Telegram needs the id it issued; Bird finds its own verification by the
 * number instead. A Telegram check with no id cannot be evaluated at all,
 * which is the same situation as one that already finished: ask for a new code.
 */
export function checkPhoneVerification(
  phone: string,
  code: string,
  reference: string | null
): Promise<CheckOutcome> {
  const { name, id } = readReference(reference);
  if (name === "telegram") {
    if (!id) return Promise.resolve({ status: "no_verification" } as CheckOutcome);
    return checkTelegramVerification(id, code);
  }
  return birdCheck(phone, code);
}

/**
 * Move to another way of reaching the number.
 *
 * Bird keeps a plan of channels to walk. Telegram is the one channel it is, so
 * there is nothing after it — but if the chain has a provider behind it, that
 * is the next way, and starting it is the honest answer to "it never came".
 */
export async function advancePhoneVerification(phone: string): Promise<StartOutcome> {
  const order = providerOrder();
  const [first, ...rest] = order;

  if (first === "bird") {
    const outcome = await birdAdvance(phone);
    if (outcome.status === "sent") {
      return {
        status: "sent",
        verification: { ...outcome.verification, reference: `bird:` },
      };
    }
    if (outcome.reason !== "no_next_channel" || rest.length === 0) return outcome;
  }

  // Out of channels here, so hand the whole thing to the next provider.
  for (const name of rest) {
    const outcome = await startWith(name, phone);
    if (outcome.status === "sent") {
      return {
        status: "sent",
        verification: {
          ...outcome.verification,
          reference: `${name}:${outcome.verification.reference ?? ""}`,
        },
      };
    }
  }

  return { status: "failed", reason: "no_next_channel" };
}
