import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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