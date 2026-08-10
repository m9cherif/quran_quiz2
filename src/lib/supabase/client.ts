import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let sharedClient: SupabaseClient | null = null;

/** True when the public Supabase env vars are present at build/runtime. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Single shared client for the whole app (browser only).
 * Do NOT call this in code paths that run during prerender/build.
 * Throws a descriptive error when the public env vars are missing.
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!sharedClient) {
    sharedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 2 } },
    });
  }
  return sharedClient;
}

export type { SupabaseClient };