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
  email: string;
  password: string;
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
    email: input.email,
    password: input.password,
    email_confirm: true,
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