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

/** Error thrown on a non-ok response, carrying the old Postgres errcode (see the /api/classes routes) so callers can still switch on `err.code`. */
async function callJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body?.error || "Request failed") as Error & { code?: string };
    err.code = body?.code;
    throw err;
  }
  return body as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Create a class (host). Returns the new class incl. its join code. */
export async function createClass(name: string, description?: string | null): Promise<ClassRow> {
  return callJson<ClassRow>("/api/classes", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name: name.trim(), description: description?.trim() || null }),
  });
}

/** Host's own classes with counts. */
export async function listMyClasses(): Promise<ClassSummary[]> {
  return (await callJson<ClassSummary[]>("/api/classes")) ?? [];
}

/** Archive a class (owner); it stops accepting new members. */
export async function archiveClass(classId: string): Promise<void> {
  await callJson(`/api/classes/${encodeURIComponent(classId)}/archive`, { method: "POST" });
}

/** Join a class by code (student). Idempotent. */
export async function joinClass(code: string): Promise<ClassRow> {
  return callJson<ClassRow>("/api/classes/join", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
}

/** Leave a class (student). */
export async function leaveClass(classId: string): Promise<void> {
  await callJson(`/api/classes/${encodeURIComponent(classId)}/leave`, { method: "POST" });
}

/** Classes the signed-in user joined (active only). */
export async function myClasses(): Promise<MyClassRow[]> {
  return (await callJson<MyClassRow[]>("/api/classes/joined")) ?? [];
}

/** Members of a class (owner or member). */
export async function listClassMembers(classId: string): Promise<ClassMember[]> {
  return (await callJson<ClassMember[]>(`/api/classes/${encodeURIComponent(classId)}/members`)) ?? [];
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
  return (await callJson<ClassGameRow[]>(`/api/classes/${encodeURIComponent(classId)}/games`)) ?? [];
}

/**
 * Join a class game directly. Membership is the invitation, so this ignores
 * the lock and late-join switches that gate the public code path.
 */
export async function joinClassGame(competitionId: string, displayName: string) {
  return callJson(`/api/classes/${encodeURIComponent(competitionId)}/games`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ competitionId, displayName: displayName.trim() }),
  });
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
  return (await callJson<ClassLeaderboardRow[]>(`/api/classes/${encodeURIComponent(classId)}/leaderboard`)) ?? [];
}

/** Remove a member (owner). */
export async function removeClassMember(classId: string, profileId: string): Promise<void> {
  await callJson(`/api/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
  });
}
