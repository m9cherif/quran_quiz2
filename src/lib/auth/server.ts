import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { toSupabasePhone } from "@/lib/auth/phoneNumber";

let serviceClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client (service role).
 * Never import from client components — the key lives in a non-NEXT_PUBLIC_
 * env var and would not be transmitted to the browser even accidentally,
 * but keeping this module out of client bundles is the real guarantee.
 */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server-only Supabase env vars are missing (SUPABASE_SERVICE_ROLE_KEY).");
  }
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return serviceClient;
}

export interface NewAccountInput {
  name: string;
  /** Exactly one of these — the account is reached by whichever was given. */
  email?: string;
  phone?: string;
  role: "host" | "student";
}

/**
 * Creates an auth user with the role placed in app_metadata — the only
 * metadata a client cannot edit. The public.profiles row is created by the
 * handle_new_user trigger. Roles are never taken from client-claimable data.
 */
export async function createUserAccount(input: NewAccountInput) {
  const client = getServiceClient();
  const { data, error } = await client.auth.admin.createUser({
    // A phone account has no address and an email account has no number;
    // sending an empty string for the other one makes Supabase reject it.
    ...(input.email
      ? { email: input.email, email_confirm: true }
      : { phone: input.phone, phone_confirm: true }),
    // Nobody signs in with a password any more — a code is emailed instead —
    // but the account still needs one, and it must be unguessable rather than
    // absent or shared.
    password: crypto.randomUUID() + crypto.randomUUID(),
    app_metadata: { role: input.role },
    user_metadata: { name: input.name },
  });
  if (error) throw error;

  // The handle_new_user trigger may fire before app_metadata is visible in
  // raw_app_meta_data (async metadata write), which would leave the profile
  // with the default 'student' role. Set it explicitly here (service role
  // bypasses RLS; profile.role is immutable by clients).
  const { error: updateError } = await client
    .from("profiles")
    .update({ role: input.role })
    .eq("id", data.user.id);
  if (updateError) throw updateError;

  return data.user;
}

/**
 * Mint a Supabase session for a number Bird Verify has just confirmed.
 *
 * Call this only after Bird answered `verified`. It grants a session on the
 * strength of a phone number alone, so anything upstream of it is what stands
 * between a stranger and someone else's account.
 *
 * Why it is written this way. Once an external service has done the proving,
 * Supabase offers no "give me a session for this user": `generateLink` covers
 * email only, and the admin API has nothing for phone. What it does support is
 * signing in with a phone and a password — so the server, which is the only
 * party that ever sees it, sets a fresh random password and immediately spends
 * it. The password is rotated on every sign-in, is never sent to the browser,
 * and is never the same twice, which leaves it a one-time credential in all
 * but name. No SMS is sent by this: a password sign-in does not send one.
 *
 * Returns null when no account holds the number. Signing in never creates one,
 * because the role is decided once, on the server, when the account is made.
 */
export async function createPhoneSession(phone: string): Promise<Session | null> {
  const admin = getServiceClient();

  const { data: userId, error: lookupError } = await admin.rpc("auth_user_id_for_phone", {
    p_phone: phone,
  });
  if (lookupError) throw lookupError;
  if (!userId) return null;

  const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { error: passwordError } = await admin.auth.admin.updateUserById(userId as string, {
    password,
  });
  if (passwordError) throw passwordError;

  // A separate, short-lived client on the anon key. Signing in on the service
  // client would store the new session on it, and every later admin call would
  // then go out as that user instead of as the service role.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env vars are missing (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY).");
  }
  const signIn = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await signIn.auth.signInWithPassword({
    // Supabase keeps the number without its plus and matches on what it kept.
    phone: toSupabasePhone(phone),
    password,
  });
  if (error) throw error;
  return data.session;
}