import { getSupabase } from "@/lib/supabase/client";
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

/** Where the code goes when a number is typed without its country code. */
export const DEFAULT_COUNTRY_CODE = "+216";

/**
 * Tunisian mobiles are eight digits starting with 2, 4, 5 or 9. The other
 * prefixes are landlines: an SMS sent there is paid for and never arrives, so
 * it is better to say no here than to charge for silence.
 */
const TUNISIAN_MOBILE = /^\+216[2459]\d{7}$/;

export function identify(input: string): Identity | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    const value = raw.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { channel: "email", value } : null;
  }

  // Phones arrive written every which way — spaces, dashes, brackets, a leading
  // zero. Supabase wants E.164 and nothing else.
  let digits = raw.replace(/[^\d+]/g, "");
  if (!/\d/.test(digits)) return null;
  // "00" is how most of the world writes "+", and treating it as digits turns
  // 0021612345678 into a number in no country at all.
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  let value = digits.startsWith("+")
    ? digits
    : DEFAULT_COUNTRY_CODE + digits.replace(/^0+/, "");
  value = "+" + value.slice(1).replace(/\+/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(value)) return null;
  if (value.startsWith("+216") && !TUNISIAN_MOBILE.test(value)) return null;
  return { channel: "phone", value };
}

/**
 * Send a code to whichever the identity is.
 *
 * `shouldCreateUser: false` matters: signing in must never quietly create an
 * account, because the role is decided once, on the server, when the account is
 * made. A typo should be told to the person, not turned into a second account.
 *
 * The mail carries a code rather than a link — a code can be read on a phone
 * and typed on a laptop, which a link cannot — and an SMS carries the same
 * thing, so both halves of this behave identically from here on.
 */
export async function sendSignInCode(identity: Identity) {
  const options = { shouldCreateUser: false };
  return identity.channel === "email"
    ? getSupabase().auth.signInWithOtp({ email: identity.value, options })
    : getSupabase().auth.signInWithOtp({ phone: identity.value, options });
}

/** Exchange the code for a session. */
export async function verifySignInCode(identity: Identity, token: string) {
  return identity.channel === "email"
    ? getSupabase().auth.verifyOtp({ email: identity.value, token, type: "email" })
    : getSupabase().auth.verifyOtp({ phone: identity.value, token, type: "sms" });
}

/** Sign out and clear the persisted session. */
export async function signOut() {
  return getSupabase().auth.signOut();
}

export type { ProfileRole };