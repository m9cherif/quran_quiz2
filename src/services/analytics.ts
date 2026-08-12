import { getSupabase } from "@/lib/supabase/client";

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

/** Owner-scoped analytics for one game (avg score/accuracy, response time, most-missed). */
export async function getGameAnalytics(competitionId: string): Promise<GameAnalytics> {
  const { data, error } = await getSupabase().rpc("game_analytics", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  return data as GameAnalytics;
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
  const { data, error } = await getSupabase().rpc("host_overview");
  if (error) throw error;
  return data as HostOverview;
}

/** Signed-in user's own game history (linked participant rows only). */
export async function getMyHistory(): Promise<HistoryRow[]> {
  const { data, error } = await getSupabase().rpc("my_history");
  if (error) throw error;
  return (data as HistoryRow[]) ?? [];
}