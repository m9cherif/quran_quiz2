import { getSupabase } from "@/lib/supabase/client";
import { getQuestionFull } from "./quizzes";
import type { Competition, Participant } from "@/types/database";

export interface GameQuestionRow {
  id: string;
  competition_id: string;
  position: number;
  text: string;
  type: string;
  duration_seconds: number;
  points: number | null;
  negative_points: number | null;
  started_at: string | null;
  ends_at: string | null;
}

/** Load the competition behind a room code (owner or visible to player). */
export async function getGameByCode(code: string): Promise<Competition | null> {
  const { data, error } = await getSupabase()
    .from("competitions")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data as Competition | null;
}

/** Question deck for the host (safe columns + timing). */
export async function listGameQuestions(competitionId: string): Promise<GameQuestionRow[]> {
  const { data, error } = await getSupabase()
    .from("questions")
    .select(
      "id, competition_id, position, text, type, duration_seconds, points, negative_points, started_at, ends_at"
    )
    .eq("competition_id", competitionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as GameQuestionRow[]) ?? [];
}

/** Players of a competition (owner view; anonymous players self-view). */
export async function listParticipants(competitionId: string): Promise<Participant[]> {
  const { data, error } = await getSupabase()
    .from("participants")
    .select("*")
    .eq("competition_id", competitionId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data as Participant[]) ?? [];
}

/** Host-side question reveal view (full row, owner only). */
export function getHostQuestionFull(questionId: string) {
  return getQuestionFull(questionId);
}

/** Server-timestamped question start (host only). */
export async function beginQuestion(questionId: string): Promise<void> {
  const { error } = await getSupabase().rpc("begin_question", { p_question_id: questionId });
  if (error) throw error;
}

/** Force-close the current question early (host only). */
export async function endQuestion(questionId: string): Promise<void> {
  const { error } = await getSupabase().rpc("end_question", { p_question_id: questionId });
  if (error) throw error;
}

/** Remaining ms from a server timestamp; clamped at 0 when expired. */
export function remainingMs(endsAt: string, now: number = Date.now()): number {
  return Math.max(0, new Date(endsAt).getTime() - now);
}