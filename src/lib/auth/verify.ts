import {
  advancePhoneVerification as birdAdvance,
  checkPhoneVerification as birdCheck,
  startPhoneVerification as birdStart,
} from "@/lib/auth/bird";
import { checkTelegramVerification, startTelegramVerification } from "@/lib/auth/telegram";
import type { CheckOutcome, StartOutcome } from "@/lib/auth/verifyTypes";

export type { CheckOutcome, StartOutcome, VerifyFailure } from "@/lib/auth/verifyTypes";

/**
 * Which service sends and judges the sign-in code.
 *
 * There are two because reaching a Tunisian phone turned out to be the hard
 * part of this whole feature, and no single answer covers everyone:
 *
 *   bird      SMS (and WhatsApp, where the workspace has a sender). Reaches any
 *             phone, needs a funded wallet, and in Tunisia depends on the
 *             carrier not filtering the message.
 *   telegram  Telegram Gateway. Ignores carriers entirely, so no filtering and
 *             no country lockouts, and codes to your own number are free — but
 *             only reaches a number that has Telegram.
 *
 * VERIFY_PROVIDER picks. Both keep the same bargain: the provider makes the
 * code, counts the attempts, decides when it expired, and says whether the
 * digits were right. Nothing here ever holds a code.
 */
export type ProviderName = "bird" | "telegram";

export function activeProvider(): ProviderName {
  return process.env.VERIFY_PROVIDER?.trim().toLowerCase() === "telegram" ? "telegram" : "bird";
}

/** Ask the configured provider to send a code. */
export function startPhoneVerification(phone: string): Promise<StartOutcome> {
  return activeProvider() === "telegram"
    ? startTelegramVerification(phone)
    : birdStart(phone);
}

/**
 * Check the digits someone typed.
 *
 * `reference` is what the start call handed back, and only Telegram needs it —
 * Bird finds the verification by the number instead. A Telegram check without
 * one cannot be evaluated at all, which is the same situation as a verification
 * that has already finished: ask for a new code.
 */
export function checkPhoneVerification(
  phone: string,
  code: string,
  reference: string | null
): Promise<CheckOutcome> {
  if (activeProvider() === "telegram") {
    if (!reference) return Promise.resolve({ status: "no_verification" } as CheckOutcome);
    return checkTelegramVerification(reference, code);
  }
  return birdCheck(phone, code);
}

/**
 * Move to another way of reaching the number.
 *
 * Only Bird has a plan of channels to walk. Telegram is the one channel it is,
 * so there is nothing after it — and saying so is more useful than resending
 * into the same place.
 */
export function advancePhoneVerification(phone: string): Promise<StartOutcome> {
  return activeProvider() === "telegram"
    ? Promise.resolve({ status: "failed", reason: "no_next_channel" } as StartOutcome)
    : birdAdvance(phone);
}
