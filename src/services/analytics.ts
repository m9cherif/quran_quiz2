export interface GameAnalytics {
  game_id: string;
  code: string;
  status: string;
  finished_at: string | null;
  questions_count: number;
  participants_count: number;
  answers_count: number;
  avg_score: number;
  avg_accuracy: number;
  avg_response_time_ms: number;
  most_missed: Array<{
    position: number;
    text: string;
    incorrect_count: number;
    accuracy: number;
    avg_response_time_ms: number;
  }>;
}

async function callJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Request failed");
  return body as T;
}

/** Owner-scoped analytics for one game (avg score/accuracy, response time, most-missed). */
export async function getGameAnalytics(competitionId: string): Promise<GameAnalytics> {
  return callJson<GameAnalytics>(`/api/analytics/games/${encodeURIComponent(competitionId)}`);
}

export interface HistoryRow {
  competition_id: string;
  code: string;
  name: string;
  status: string;
  finished_at: string | null;
  joined_at: string;
  score: number;
  answered_count: number;
  correct_count: number;
  accuracy: number;
}

export interface HostOverview {
  quizzes_total: number;
  games_total: number;
  games_finished: number;
  games_live: number;
  players_total: number;
  questions_total: number;
  answers_total: number;
  avg_accuracy: number;
  students_reached: number;
  classes_total: number;
}

/** Cross-game totals for the signed-in host (owner-scoped, one round trip). */
export async function getHostOverview(): Promise<HostOverview> {
  return callJson<HostOverview>("/api/analytics/host-overview");
}

/** Signed-in user's own game history (linked participant rows only). */
export async function getMyHistory(): Promise<HistoryRow[]> {
  return (await callJson<HistoryRow[]>("/api/analytics/history")) ?? [];
}
