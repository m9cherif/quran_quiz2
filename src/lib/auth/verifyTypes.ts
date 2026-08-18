/**
 * The vocabulary both verification providers answer in.
 *
 * Bird and Telegram fail in different languages — one throws typed errors with
 * HTTP statuses, the other returns a string in a JSON envelope — and the routes
 * should not have to know which is installed. Each provider translates into
 * this at its own edge, so adding a third is a new file rather than a new
 * branch in the sign-in flow.
 */

/** Every way asking for a code can fail, in words the UI can act on. */
export type VerifyFailure =
  /** No provider credentials — the deployment was never finished. */
  | "not_configured"
  /** Credentials present and rejected: also a deployment problem. */
  | "bad_credentials"
  /** The provider will not accept this number at all. */
  | "invalid_number"
  /** A valid number this provider cannot deliver to. */
  | "unsupported_destination"
  /** Asked for another channel, and there is none left to try. */
  | "no_next_channel"
  /** Codes asked for, or checked, faster than the provider allows. */
  | "too_many_requests"
  /** The account's balance will not cover the message. */
  | "insufficient_balance"
  /** The provider answered, with something we do not handle. */
  | "provider_error"
  /** The provider did not answer at all. */
  | "network_error";

/** The verification that was started, as far as the caller needs to know it. */
export interface StartedVerification {
  /** When the code stops being accepted, ISO 8601. */
  expiresAt: string;
  /** The channel the code went out on, or null before the first send. */
  channel: string | null;
  /**
   * How this provider names the verification, when it needs naming.
   *
   * Bird finds a verification by the number it was sent to, so there is
   * nothing to carry. Telegram issues a request id and expects it back. Null
   * means "identified by the number".
   */
  reference: string | null;
}

export type StartOutcome =
  | { status: "sent"; verification: StartedVerification }
  | { status: "failed"; reason: VerifyFailure };

/** What became of a code someone typed. */
export type CheckOutcome =
  /**
   * `phone` is the number the provider says was verified, in E.164. It is the
   * one to sign in — never the number the browser claimed, or a correct code
   * for one account could be spent opening another.
   */
  | { status: "verified"; phone: string }
  /** Wrong digits, and the provider will still hear another guess. */
  | { status: "incorrect"; attemptsRemaining: number | null }
  | { status: "expired" }
  | { status: "attempts_exhausted" }
  /** Nothing in progress: never started, or already over. */
  | { status: "no_verification" }
  | { status: "failed"; reason: VerifyFailure };
