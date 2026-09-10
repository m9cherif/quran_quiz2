import { DEFAULT_COUNTRY_CODE, normalizePhone } from "@/lib/auth/phoneNumber";
import type { ProfileRole } from "@/types/database";

/** Public profile shape exposed to the UI. */
export interface AuthProfile {
  id: string;
  name: string;
  role: ProfileRole;
  avatar_url: string | null;
}

/** Current session's profile, from the qq_session cookie — userId is unused now (kept for call-site compatibility) but the cookie is always what's actually read. */
export async function getProfile(_userId: string): Promise<AuthProfile | null> {
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json().catch(() => ({}));
    return data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * One field takes both: an address or a phone number.
 *
 * Which one it is can be read off the value itself — nobody types an @ into a
 * phone number — so asking the person to declare it first would be a question
 * with an obvious answer.
 */
export type Channel = "email" | "phone";

export interface Identity {
  channel: Channel;
  /** Normalised: lower-cased address, or E.164 phone. */
  value: string;
}

export { DEFAULT_COUNTRY_CODE };

export function identify(input: string): Identity | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    const value = raw.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { channel: "email", value } : null;
  }

  const value = normalizePhone(raw);
  return value ? { channel: "phone", value } : null;
}

/**
 * Everything either half of the sign-in can go wrong with, in one vocabulary.
 * Both channels now go through the same kind of route (start/check, our own
 * server owning the code), so both answer in this same shape.
 */
export type SignInIssue =
  | "no_account"
  | "too_many_codes"
  | "invalid_number"
  | "unsupported_destination"
  | "no_next_channel"
  | "not_configured"
  | "insufficient_balance"
  | "sms_failed"
  | "check_failed"
  | "network_error"
  | "code_wrong"
  | "code_expired"
  | "attempts_exhausted"
  | "unknown";

export type CodeResult =
  | { ok: true; channel: string | null; reference: string | null }
  | { ok: false; issue: SignInIssue };

/** What either /start route answers with, mapped onto the vocabulary above. */
const ISSUES: Record<string, SignInIssue> = {
  no_account: "no_account",
  invalid_number: "invalid_number",
  malformed_request: "unknown",
  unsupported_destination: "unsupported_destination",
  no_next_channel: "no_next_channel",
  too_many_requests: "too_many_codes",
  attempts_exhausted: "attempts_exhausted",
  insufficient_balance: "insufficient_balance",
  not_configured: "not_configured",
  bad_credentials: "not_configured",
  provider_error: "sms_failed",
  network_error: "network_error",
  code_wrong: "code_wrong",
  code_expired: "code_expired",
  check_failed: "check_failed",
};

async function callRoute(path: string, body: unknown): Promise<CodeResult> {
  let payload: {
    ok?: boolean;
    reason?: string;
    channel?: string | null;
    reference?: string | null;
  };
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    payload = await response.json().catch(() => ({}));
    if (response.ok && payload?.ok) {
      return { ok: true, channel: payload.channel ?? null, reference: payload.reference ?? null };
    }
  } catch {
    // The request never landed: no network, or the site is being redeployed.
    return { ok: false, issue: "network_error" };
  }
  return { ok: false, issue: ISSUES[payload?.reason ?? ""] ?? "unknown" };
}

/**
 * Send a code to whichever the identity is. Both channels are now the same
 * shape of flow — this server makes the code, stores only a salted hash, and
 * delivers it (SMS via Bird Verify, email via SMTP) — so this just picks the
 * matching route.
 *
 * Signing in never creates an account: both /start routes 404 on an address
 * or number that never registered, because the role is decided once, on the
 * server, when the account is made.
 */
export async function sendSignInCode(identity: Identity): Promise<CodeResult> {
  const path = identity.channel === "phone" ? "/api/auth/phone/start" : "/api/auth/email/start";
  const field = identity.channel === "phone" ? "phone" : "email";
  return callRoute(path, { [field]: identity.value });
}

/**
 * "It never came." A carrier that swallowed one text will swallow the next,
 * so resending is not the answer — another channel is. Only phone numbers
 * have a next channel to try (Bird Verify's own channel plan, or the next
 * provider in VERIFY_PROVIDER); email has just the one address.
 */
export async function advanceSignInChannel(identity: Identity): Promise<CodeResult> {
  if (identity.channel !== "phone") return { ok: false, issue: "no_next_channel" };
  return callRoute("/api/auth/phone/start", { phone: identity.value, advance: true });
}

export type VerifyResult = { ok: true; userId: string } | { ok: false; issue: SignInIssue };

/**
 * Exchange the code for a session. The matching /check route verifies the
 * code server-side and, on success, sets the qq_session cookie directly on
 * its response — there's nothing left for the client to do with the result
 * beyond reading the userId back.
 */
export async function verifySignInCode(
  identity: Identity,
  token: string,
  reference: string | null = null
): Promise<VerifyResult> {
  const path = identity.channel === "phone" ? "/api/auth/phone/check" : "/api/auth/email/check";
  const field = identity.channel === "phone" ? "phone" : "email";
  let payload: { ok?: boolean; reason?: string; userId?: string };
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: identity.value, code: token, reference }),
    });
    payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok || !payload.userId) {
      return { ok: false, issue: ISSUES[payload?.reason ?? ""] ?? "unknown" };
    }
  } catch {
    return { ok: false, issue: "network_error" };
  }
  return { ok: true, userId: payload.userId };
}

/** Sign out and clear the session cookie. */
export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
}

export type { ProfileRole };
