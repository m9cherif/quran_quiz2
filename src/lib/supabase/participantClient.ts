import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const cache = new Map<string, SupabaseClient>();

/**
 * Cached client that identifies the anonymous player on every request via
 * the `X-Participant-Token` header (server-issued, unguessable).
 * Use for student game traffic (questions, choices, answers, participant RPCs).
 */
export function getParticipantClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  let client = cache.get(accessToken);
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // This client must be completely inert as far as sign-in goes. It
        // shares an origin with the signed-in client, so without its own
        // storage key (and with refresh/URL-detection left on) it competes
        // for the same stored session and can end up clearing it — which
        // signed a logged-in student out the moment they joined a game.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "quizcast-participant-noauth",
      },
      global: { headers: { "x-participant-token": accessToken } },
    });
    cache.set(accessToken, client);
  }
  return client;
}