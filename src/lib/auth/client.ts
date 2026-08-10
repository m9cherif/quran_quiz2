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

/** Sign in with email/password (client-side, anon key). */
export async function signInWithEmail(email: string, password: string) {
  return getSupabase().auth.signInWithPassword({ email, password });
}

/** Sign out and clear the persisted session. */
export async function signOut() {
  return getSupabase().auth.signOut();
}

export type { ProfileRole };