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
 * Email a six-digit code to sign in with.
 *
 * `shouldCreateUser: false` matters: signing in must never quietly create an
 * account, because the role is decided once, on the server, when the account is
 * made. A typo in the address should be told to the person, not turned into a
 * second account.
 *
 * The mail carries a code rather than a link — the code can be read on a phone
 * and typed on a laptop, which a link cannot.
 */
export async function sendSignInCode(email: string) {
  return getSupabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
}

/** Exchange the emailed code for a session. */
export async function verifySignInCode(email: string, token: string) {
  return getSupabase().auth.verifyOtp({ email, token, type: "email" });
}

/** Sign out and clear the persisted session. */
export async function signOut() {
  return getSupabase().auth.signOut();
}

export type { ProfileRole };