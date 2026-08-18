import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_COUNTRY_CODE, normalizePhone } from "@/lib/auth/phoneNumber";
import type { ProfileRole } from "@/types/database";

/** Public profile shape exposed to the UI (never the JWT or tokens). */
export interface AuthProfile {
  id: string;
  name: string;
  role: ProfileRole;
  avatar_url: string | null;
}

/** Fetch the caller's own profile (RLS: self-select only). */
export async function getProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, name, role, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as AuthProfile) ?? null;
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
 *
 * The two halves fail in different languages: Supabase returns a sentence to
 * be read, Bird returns a named reason. Both are translated into this list at
 * the edge, so the screens carry one mapping from reason to message instead of
 * one per provider.
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
  | "network_error"
  | "code_wrong"
  | "code_expired"
  | "attempts_exhausted"
  | "unknown";

export type CodeResult =
  /** `channel` is the one Bird actually used, and null for email. */
  | { ok: true; channel: string | null }
  | { ok: false; issue: SignInIssue };

/** What the phone routes answer with, mapped onto the vocabulary above. */
const PHONE_ISSUES: Record<string, SignInIssue> = {
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
};

/** Read a Supabase auth error, which only ever arrives as prose. */
function issueFromSupabase(message: string): SignInIssue {
  if (/signups not allowed|not found|no user/i.test(message)) return "no_account";
  if (/rate|limit|seconds/i.test(message)) return "too_many_codes";
  return "unknown";
}

async function callPhoneRoute(path: string, body: unknown): Promise<CodeResult> {
  let payload: { ok?: boolean; reason?: string; channel?: string | null };
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    payload = await response.json().catch(() => ({}));
    if (response.ok && payload?.ok) return { ok: true, channel: payload.channel ?? null };
  } catch {
    // The request never landed: no network, or the site is being redeployed.
    return { ok: false, issue: "network_error" };
  }
  return { ok: false, issue: PHONE_ISSUES[payload?.reason ?? ""] ?? "unknown" };
}

/**
 * Send a code to whichever the identity is.
 *
 * The two channels are genuinely different flows, not one flow with a
 * parameter. An address goes to Supabase, which makes the code, mails it and
 * later checks it. A number goes to Bird Verify by way of this site's own
 * server, and Bird does all three.
 *
 * Bird owns the code for numbers precisely so that Supabase does not: calling
 * `signInWithOtp({ phone })` here would have Supabase mint a second code, and
 * only one of the two would open the door. What Supabase keeps either way is
 * the session — see /api/auth/phone/check.
 *
 * `shouldCreateUser: false` on the email side, and an existence check on the
 * phone side, say the same thing: signing in never creates an account, because
 * the role is decided once, on the server, when the account is made.
 */
export async function sendSignInCode(identity: Identity): Promise<CodeResult> {
  if (identity.channel === "phone") {
    return callPhoneRoute("/api/auth/phone/start", { phone: identity.value });
  }

  const { error } = await getSupabase().auth.signInWithOtp({
    email: identity.value,
    options: { shouldCreateUser: false },
  });
  return error
    ? { ok: false, issue: issueFromSupabase(error.message ?? "") }
    : { ok: true, channel: null };
}

/**
 * "It never came": send a fresh code by some other means.
 *
 * A carrier that dropped one text will drop the next one too, so offering only
 * "send it again" leaves the person pressing a button that cannot work. Bird
 * keeps an ordered plan of ways to reach a number — a Tunisian mobile has
 * WhatsApp and Telegram behind the SMS — and this steps to the next one.
 *
 * Codes already sent stay valid, so a text that turns up late is still usable.
 * Email has no second channel: there is only the one address.
 */
export async function advanceSignInChannel(identity: Identity): Promise<CodeResult> {
  if (identity.channel !== "phone") return { ok: false, issue: "no_next_channel" };
  return callPhoneRoute("/api/auth/phone/start", { phone: identity.value, advance: true });
}

export type VerifyResult = { ok: true; userId: string } | { ok: false; issue: SignInIssue };

/**
 * Exchange the code for a session.
 *
 * The phone side comes back with the session rather than setting it: the
 * tokens are minted on the server, after Bird confirms, and `setSession` is
 * what hands them to the Supabase client the rest of the app already uses. By
 * the time either branch returns, a signed-in client is a signed-in client and
 * nothing downstream can tell which channel produced it.
 */
export async function verifySignInCode(identity: Identity, token: string): Promise<VerifyResult> {
  if (identity.channel === "phone") {
    let payload: {
      ok?: boolean;
      reason?: string;
      session?: { access_token: string; refresh_token: string };
    };
    try {
      const response = await fetch("/api/auth/phone/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: identity.value, code: token }),
      });
      payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload.session) {
        return { ok: false, issue: PHONE_ISSUES[payload?.reason ?? ""] ?? "unknown" };
      }
    } catch {
      return { ok: false, issue: "network_error" };
    }

    const { data, error } = await getSupabase().auth.setSession(payload.session);
    if (error || !data?.user) return { ok: false, issue: "unknown" };
    return { ok: true, userId: data.user.id };
  }

  const { data, error } = await getSupabase().auth.verifyOtp({
    email: identity.value,
    token,
    type: "email",
  });
  // Supabase answers "Token has expired or is invalid" for both a wrong code
  // and an old one, so telling them apart here would be a fiction.
  if (error || !data?.user) return { ok: false, issue: "code_wrong" };
  return { ok: true, userId: data.user.id };
}

/** Sign out and clear the persisted session. */
export async function signOut() {
  return getSupabase().auth.signOut();
}

export type { ProfileRole };