import { getSupabase } from "@/lib/supabase/client";

export interface ClassRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  archived_at: string | null;
}

/** Host view: own classes with member + game counts. */
export interface ClassSummary extends ClassRow {
  member_count: number;
  game_count: number;
}

/** Student view: classes I joined (active only). */
export interface MyClassRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  member_count: number;
}

export interface ClassMember {
  profile_id: string;
  name: string;
  joined_at: string;
}

/** Create a class (host). Returns the new class incl. its join code. */
export async function createClass(name: string, description?: string | null): Promise<ClassRow> {
  const { data, error } = await getSupabase().rpc("create_class", {
    p_name: name.trim(),
    p_description: description?.trim() || null,
  });
  if (error) throw error;
  return data as ClassRow;
}

/** Host's own classes with counts. */
export async function listMyClasses(): Promise<ClassSummary[]> {
  const { data, error } = await getSupabase().rpc("list_my_classes");
  if (error) throw error;
  return (data as ClassSummary[]) ?? [];
}

/** Archive a class (owner); it stops accepting new members. */
export async function archiveClass(classId: string): Promise<void> {
  const { error } = await getSupabase().rpc("archive_class", { p_class_id: classId });
  if (error) throw error;
}

/** Join a class by code (student). Idempotent. */
export async function joinClass(code: string): Promise<ClassRow> {
  const { data, error } = await getSupabase().rpc("join_class", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data as ClassRow;
}

/** Leave a class (student). */
export async function leaveClass(classId: string): Promise<void> {
  const { error } = await getSupabase().rpc("leave_class", { p_class_id: classId });
  if (error) throw error;
}

/** Classes the signed-in user joined (active only). */
export async function myClasses(): Promise<MyClassRow[]> {
  const { data, error } = await getSupabase().rpc("my_classes");
  if (error) throw error;
  return (data as MyClassRow[]) ?? [];
}

/** Members of a class (owner or member). */
export async function listClassMembers(classId: string): Promise<ClassMember[]> {
  const { data, error } = await getSupabase().rpc("list_class_members", { p_class_id: classId });
  if (error) throw error;
  return (data as ClassMember[]) ?? [];
}

export interface ClassGameRow {
  id: string;
  code: string;
  title: string | null;
  name: string;
  status: string;
  created_at: string;
  already_joined: boolean;
  /** Host switch: may class members walk in from their dashboard? */
  class_can_join: boolean;
}

/** Games run for a class — visible to its members without a code. */
export async function listClassGames(classId: string): Promise<ClassGameRow[]> {
  const { data, error } = await getSupabase().rpc("list_class_games", {
    p_class_id: classId,
  });
  if (error) throw error;
  return (data as ClassGameRow[]) ?? [];
}

/**
 * Join a class game directly. Membership is the invitation, so this ignores
 * the lock and late-join switches that gate the public code path.
 */
export async function joinClassGame(competitionId: string, displayName: string) {
  const { data, error } = await getSupabase().rpc("join_class_game", {
    p_competition_id: competitionId,
    p_display_name: displayName.trim(),
  });
  if (error) throw error;
  return data;
}

export interface ClassLeaderboardRow {
  student: string;
  games_played: number;
  total_points: number;
  correct_count: number;
  answered_count: number;
  accuracy: number;
}

/** Standings across every game attached to a class (owner only). */
export async function classLeaderboard(classId: string): Promise<ClassLeaderboardRow[]> {
  const { data, error } = await getSupabase().rpc("class_leaderboard", {
    p_class_id: classId,
  });
  if (error) throw error;
  return (data as ClassLeaderboardRow[]) ?? [];
}

/** Remove a member (owner). */
export async function removeClassMember(classId: string, profileId: string): Promise<void> {
  const { error } = await getSupabase().rpc("remove_class_member", {
    p_class_id: classId,
    p_profile_id: profileId,
  });
  if (error) throw error;
}