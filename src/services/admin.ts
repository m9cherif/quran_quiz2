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

async function callJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Request failed");
  return body as T;
}

/** Every account on the platform — admin only, see /api/admin/users. */
export async function listAllProfiles(): Promise<AdminProfile[]> {
  return (await callJson<AdminProfile[]>("/api/admin/users")) ?? [];
}

export async function setUserRole(userId: string, role: "host" | "student" | "admin") {
  await callJson(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

/** Deletes the account entirely — the qq_session cookie carries the admin's identity, no bearer token needed. */
export async function deleteUserAccount(userId: string) {
  await callJson(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

/** Every competition on the platform, across every host — admin only. */
export async function listAllCompetitions(): Promise<AdminCompetition[]> {
  return (await callJson<AdminCompetition[]>("/api/admin/competitions")) ?? [];
}

export async function deleteCompetitionAsAdmin(competitionId: string) {
  await callJson(`/api/admin/competitions/${encodeURIComponent(competitionId)}`, { method: "DELETE" });
}
