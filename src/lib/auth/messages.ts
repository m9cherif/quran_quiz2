import type { SignInIssue } from "@/lib/auth/client";

/**
 * What each way of failing is called on screen.
 *
 * Sign-in and registration both show these, and a message that differs between
 * the two pages reads like two different products — so the mapping lives here
 * once rather than in each page's error handling.
 *
 * None of them repeat a provider's own wording. "Bird refused the message
 * (402)" is the truth, but it is the operator's truth: it belongs in the server
 * log, which is where it goes. What the person sees is what they can do next.
 */
export const SIGN_IN_MESSAGE_KEYS: Record<SignInIssue, string> = {
  no_account: "auth.noAccountForEmail",
  too_many_codes: "auth.tooManyCodes",
  invalid_number: "auth.contactInvalid",
  unsupported_destination: "auth.smsUnsupported",
  // A missing key is a deployment that was never finished. The person cannot
  // fix it and should not be told to try again — email still works.
  not_configured: "auth.smsNotConfigured",
  insufficient_balance: "auth.smsUnavailable",
  sms_failed: "auth.smsFailed",
  network_error: "auth.serverUnreachable",
  code_wrong: "auth.codeWrong",
  code_expired: "auth.codeExpired",
  attempts_exhausted: "auth.tooManyAttempts",
  unknown: "auth.couldNotSignIn",
};
