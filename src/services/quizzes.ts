import { getSupabase } from "@/lib/supabase/client";
import type {
  Competition,
  CompetitionDifficulty,
  CompetitionLanguage,
  CompetitionStatus,
  QuizQuestionDraft,
  QuizQuestionFull,
  QuizSummary,
} from "@/types/database";

export interface QuizMetaInput {
  name: string;
  title?: string | null;
  description?: string | null;
  instructions?: string | null;
  minutes_per_question?: number;
  language: CompetitionLanguage;
  category?: string | null;
  difficulty?: CompetitionDifficulty | null;
  default_points?: number;
  default_negative_points?: number;
  speed_bonus_enabled?: boolean;
  visibility?: "public" | "unlisted" | "private";
  class_id?: string | null;
}

export interface SaveQuestionInput {
  competitionId: string;
  questionId?: string | null;
  position: number;
  text: string;
  type: QuizQuestionDraft["type"];
  durationSeconds: number;
  points: number | null;
  negativePoints: number | null;
  explanation: string | null;
  correctAnswerText: string | null;
  surahNumber: number | null;
  ayahNumber: number | null;
  pageNumber: number | null;
  juzNumber: number | null;
  hizbNumber: number | null;
  choices: Array<{
    text: string;
    position: number;
    isCorrect: boolean;
  }>;
}

export interface QuestionListItem {
  id: string;
  competition_id: string;
  position: number;
  text: string;
  type: QuizQuestionDraft["type"];
  duration_seconds: number;
  points: number | null;
  negative_points: number | null;
  surah_number: number | null;
  ayah_number: number | null;
  page_number: number | null;
  juz_number: number | null;
  hizb_number: number | null;
}

/** Quiz library (draft competitions owned by the caller). */
export async function listMyQuizzes(): Promise<QuizSummary[]> {
  const { data, error } = await getSupabase().rpc("list_my_quizzes");
  if (error) throw error;
  return (data as QuizSummary[]) ?? [];
}

export async function createQuiz(input: QuizMetaInput): Promise<Pick<Competition, "id" | "code">> {
  const { data: sessionUser } = await getSupabase().auth.getUser();
  const { data, error } = await getSupabase()
    .from("competitions")
    .insert([{ ...input, owner_id: sessionUser?.user?.id ?? null } as never])
    .select("id, code")
    .single();
  if (error) throw error;
  return data as Pick<Competition, "id" | "code">;
}

export async function getQuiz(id: string): Promise<Competition | null> {
  const { data, error } = await getSupabase()
    .from("competitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Competition | null;
}

export async function updateQuizMeta(
  id: string,
  patch: Partial<QuizMetaInput>
): Promise<void> {
  const { error } = await getSupabase().from("competitions").update(patch as never).eq("id", id);
  if (error) throw error;
}

/** Moves a game to the given lifecycle status (owner only, via RLS). */
export async function setQuizStatus(
  id: string,
  status: "waiting" | "running" | "paused" | "finished" | "cancelled" | "draft" | "scheduled"
): Promise<void> {
  const { error } = await getSupabase().from("competitions").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Hard-deletes a quiz and its children (FKs cascade). Drafts only. */
export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await getSupabase().from("competitions").delete().eq("id", id);
  if (error) throw error;
}

export async function archiveQuiz(id: string): Promise<void> {
  const { error } = await getSupabase().rpc("archive_quiz", { p_competition_id: id });
  if (error) throw error;
}

/** Snapshot-copies a quiz (own questions + choices) and returns the new id. */
export async function duplicateQuiz(id: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("duplicate_quiz", { p_competition_id: id });
  if (error) throw error;
  return data as string;
}

/** Questions list without hidden columns (REST-safe for the editor sidebar). */
export async function listQuizQuestions(competitionId: string): Promise<QuestionListItem[]> {
  const { data, error } = await getSupabase()
    .from("questions")
    .select(
      "id, competition_id, position, text, type, duration_seconds, points, negative_points, surah_number, ayah_number, page_number, juz_number, hizb_number"
    )
    .eq("competition_id", competitionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as QuestionListItem[]) ?? [];
}

/** Full question incl. hidden columns — RPC-scoped to the owner. */
export async function getQuestionFull(questionId: string): Promise<QuizQuestionFull> {
  const { data, error } = await getSupabase().rpc("get_question_full", {
    p_question_id: questionId,
  });
  if (error) throw error;
  return data as QuizQuestionFull;
}

/** Atomic save of a question + its choices (owner only, server-validated). */
export async function saveQuestion(input: SaveQuestionInput): Promise<string> {
  const { data, error } = await getSupabase().rpc("save_question", {
    p_competition_id: input.competitionId,
    p_question_id: input.questionId ?? null,
    p_position: input.position,
    p_text: input.text,
    p_type: input.type,
    p_duration_seconds: input.durationSeconds,
    p_points: input.points,
    p_negative_points: input.negativePoints,
    p_explanation: input.explanation,
    p_correct_answer_text: input.correctAnswerText,
    p_surah_number: input.surahNumber,
    p_ayah_number: input.ayahNumber,
    p_page_number: input.pageNumber,
    p_juz_number: input.juzNumber,
    p_hizb_number: input.hizbNumber,
    p_choices: input.choices,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await getSupabase().from("questions").delete().eq("id", questionId);
  if (error) throw error;
}

/** Live games (non-draft competitions owned by the caller). */
export async function listMyLiveGames(): Promise<QuizSummary[]> {
  const { data: session } = await getSupabase().auth.getUser();
  if (!session.user) return [];
  const { data, error } = await getSupabase()
    .from("competitions")
    .select(
      "id, code, name, description, status, visibility, cover_url, language, category, difficulty, default_points, default_negative_points, speed_bonus_enabled, created_at, updated_at"
    )
    .eq("owner_id", session.user.id)
    .not("status", "eq", "draft")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as QuizSummary[]) ?? [];
}