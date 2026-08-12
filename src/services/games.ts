import { getSupabase } from "@/lib/supabase/client";
import { getParticipantClient } from "@/lib/supabase/participantClient";
import { getQuestionFull } from "./quizzes";
import type { Competition, Participant, Answer } from "@/types/database";

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
  /** page_words exercises only: page image + normalised box geometry. */
  page_number?: number | null;
  regions?: Array<{ x1: number; y1: number; x2: number; y2: number }> | null;
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
      "id, competition_id, position, text, type, duration_seconds, points, negative_points, started_at, ends_at, page_number, regions"
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

export interface AdvanceResult {
  closed_question_id: string | null;
  started_question_id: string | null;
  started_position: number | null;
  ends_at: string | null;
  has_more: boolean;
}

/**
 * Close the open question and open the next one in a single statement
 * (host only). Replaces the end→begin pair, so the round cannot be left
 * half-advanced if the second call fails, and costs one round trip.
 */
export async function advanceGame(competitionId: string): Promise<AdvanceResult> {
  const { data, error } = await getSupabase().rpc("advance_game", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  return data as AdvanceResult;
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

// ---------------------------------------------------------------------------
// Student-side game flow (anonymous player identified by access token)
// ---------------------------------------------------------------------------

export interface RevealPayload {
  question_id: string;
  text: string;
  correct_answer_text: string | null;
  explanation: string | null;
  correct_choice: { id: string; text: string } | null;
  choices: { id: string; text: string }[];
}

/** Join a waiting game by its public code. Returns the participant row. */
export async function joinGame(
  code: string,
  displayName: string,
  profileId?: string | null
): Promise<Participant> {
  const { data, error } = await getSupabase().rpc("join_competition", {
    p_code: code.trim().toUpperCase(),
    p_display_name: displayName.trim(),
    p_profile_id: profileId ?? null,
  });
  if (error) throw error;
  return data as Participant;
}

/** Restore/validate my participant row for a competition (token client). */
export async function getMyParticipant(
  competitionId: string,
  accessToken: string
): Promise<Participant | null> {
  const { data, error } = await getParticipantClient(accessToken).rpc("my_participant", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  return (data as Participant | null) ?? null;
}

/** Presence heartbeat: mark myself online with a server timestamp. */
export async function updatePresence(competitionId: string, accessToken: string): Promise<void> {
  const { error } = await getParticipantClient(accessToken).rpc("update_presence", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
}

/** Lobby player count (aggregate only — participants can't see names). */
export async function gameParticipantCount(
  competitionId: string,
  accessToken?: string
): Promise<number> {
  const supabase = accessToken
    ? getParticipantClient(accessToken)
    : getSupabase();
  const { data, error } = await supabase.rpc("game_participant_count", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Question deck for students (safe columns; requires the token header). */
export async function listStudentQuestions(
  competitionId: string,
  accessToken: string
): Promise<GameQuestionRow[]> {
  const { data, error } = await getParticipantClient(accessToken)
    .from("questions")
    .select(
      "id, competition_id, position, text, type, duration_seconds, points, negative_points, started_at, ends_at, page_number, regions"
    )
    .eq("competition_id", competitionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as GameQuestionRow[]) ?? [];
}

/** Choices for a set of questions (student token client; is_correct hidden). */
export async function listChoices(
  questionIds: string[],
  accessToken: string
): Promise<{ id: string; question_id: string; text: string; position: number }[]> {
  const { data, error } = await getParticipantClient(accessToken)
    .from("choices")
    .select("id, question_id, text, position")
    .in("question_id", questionIds)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as { id: string; question_id: string; text: string; position: number }[]) ?? [];
}

/** Submit my (locked, single) answer. Returns the graded answer row. */
export async function submitAnswer(
  competitionId: string,
  questionId: string,
  accessToken: string,
  options: { choiceId?: string; answerText?: string; responseTimeMs: number }
): Promise<Answer> {
  const { data, error } = await getParticipantClient(accessToken).rpc("submit_answer", {
    p_competition_id: competitionId,
    p_question_id: questionId,
    p_choice_id: options.choiceId ?? null,
    p_answer_text: options.answerText ?? null,
    p_response_time_ms: Math.max(0, Math.round(options.responseTimeMs)),
  });
  if (error) throw error;
  return data as Answer;
}

/** My answers in a game (own rows only). */
export async function getMyAnswers(
  competitionId: string,
  accessToken: string
): Promise<Answer[]> {
  const { data, error } = await getParticipantClient(accessToken)
    .from("answers")
    .select("*")
    .eq("competition_id", competitionId)
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  return (data as Answer[]) ?? [];
}

/** Correct answer + explanation for a closed question (own result). */
export async function getReveal(
  questionId: string,
  accessToken: string
): Promise<RevealPayload> {
  const { data, error } = await getParticipantClient(accessToken).rpc("get_question_reveal", {
    p_question_id: questionId,
  });
  if (error) throw error;
  return data as RevealPayload;
}

/**
 * Ranked leaderboard for the game (aggregates only).
 * The RPC admits the owner (session) or a participant (token header), so
 * students must pass their access token — otherwise the call is rejected.
 */
export async function getLeaderboard(
  competitionId: string,
  accessToken?: string | null
): Promise<LeaderboardRow[]> {
  const client = accessToken ? getParticipantClient(accessToken) : getSupabase();
  const { data, error } = await client.rpc("game_leaderboard", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  return (data as LeaderboardRow[]) ?? [];
}

export interface LeaderboardRow {
  rank: number;
  participant_id: string;
  display_name: string;
  correct_count: number;
  answered_count: number;
  total_points: number;
}

export interface QuestionStatRow {
  position_number: number;
  text: string;
  duration_seconds: number;
  answered_count: number;
  correct_count: number;
  accuracy: number;
}

/** Per-question answered/correct/accuracy — host only (owner-scoped RPC). */
export async function getQuestionStats(competitionId: string): Promise<QuestionStatRow[]> {
  const { data, error } = await getSupabase().rpc("game_question_stats", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  return (data as QuestionStatRow[]) ?? [];
}

export interface AnswerMatrixRow {
  display_name: string;
  position_number: number;
  question_text: string;
  answer_text: string | null;
  is_correct: boolean | null;
  points: number | null;
  response_time_ms: number | null;
}

/** Every player × question result — host only; backs the CSV export. */
export async function getAnswerMatrix(competitionId: string): Promise<AnswerMatrixRow[]> {
  const { data, error } = await getSupabase().rpc("game_answer_matrix", {
    p_competition_id: competitionId,
  });
  if (error) throw error;
  return (data as AnswerMatrixRow[]) ?? [];
}