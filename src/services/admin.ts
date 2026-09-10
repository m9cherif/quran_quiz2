import { getSupabase } from "@/lib/supabase/client";

export interface AdminProfile {
  id: string;
  name: string;
  role: "host" | "student" | "admin";
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface AdminCompetition {
  id: string;
  code: string;
  title: string | null;
  status: string;
  owner_id: string;
  owner_name: string | null;
  created_at: string;
  question_count: number;
  participant_count: number;
}

/** Every account on the platform — admin only, see admin_list_profiles(). */
export async function listAllProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await getSupabase().rpc("admin_list_profiles");
  if (error) throw error;
  return (data as AdminProfile[]) ?? [];
}

export async function setUserRole(userId: string, role: "host" | "student" | "admin") {
  const { error } = await getSupabase().rpc("admin_set_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

/** Deletes the account entirely (auth user + profile, cascades). */
export async function deleteUserAccount(userId: string) {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Could not delete the account");
}

/** Every competition on the platform, across every host — admin only. */
export async function listAllCompetitions(): Promise<AdminCompetition[]> {
  const { data, error } = await getSupabase().rpc("admin_list_competitions");
  if (error) throw error;
  return (data as AdminCompetition[]) ?? [];
}

export async function deleteCompetitionAsAdmin(competitionId: string) {
  const { error } = await getSupabase().rpc("admin_delete_competition", {
    p_id: competitionId,
  });
  if (error) throw error;
}
