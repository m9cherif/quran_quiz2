import type {
  Competition,
  CompetitionDifficulty,
  CompetitionLanguage,
  CompetitionStatus,
  QuizQuestionDraft,
  QuizQuestionFull,
  QuizSummary,
} from "@/types/database";

/**
 * Thin fetch wrapper for the /api/quizzes/* routes (src/app/api/quizzes/**),
 * which replace the old Postgres RPCs/REST calls one-for-one — see each
 * route file for the RPC it ports. `credentials: "same-origin"` carries the
 * qq_session cookie along, same as every other browser->API call in this app.
 */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string })?.error || `Request failed (${response.status})`);
  }
  return body as T;
}

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
  /** Host switch for the voice/camera room. */
  calls_enabled?: boolean;
  /** Stops new players joining mid-game. */
  join_locked?: boolean;
  /** Lets people join after the game has started. */
  allow_late_join?: boolean;
  /** Lets members of the attached class in from their own dashboard. */
  class_can_join?: boolean;
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
  /** Keys must stay snake_case — save_question reads `is_correct`. */
  choices: Array<{
    text: string;
    position: number;
    is_correct: boolean;
  }>;
  audioUrl?: string | null;
  hint?: string | null;
}

export interface OrderingQuestionInput {
  competitionId: string;
  questionId?: string | null;
  position: number;
  text: string;
  /** Fragments in their CORRECT order; the server shuffles them for display. */
  items: string[];
  durationSeconds: number;
  points: number | null;
  negativePoints: number | null;
  explanation: string | null;
  hint: string | null;
  surahNumber?: number | null;
  ayahNumber?: number | null;
}

/** Save an ordering question; the answer key never reaches the browser. */
export async function saveOrderingQuestion(input: OrderingQuestionInput): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(
    `/api/quizzes/${encodeURIComponent(input.competitionId)}/questions/save-ordering`,
    {
      method: "POST",
      body: JSON.stringify({
        questionId: input.questionId ?? null,
        position: input.position,
        text: input.text,
        items: input.items,
        durationSeconds: input.durationSeconds,
        points: input.points,
        negativePoints: input.negativePoints,
        explanation: input.explanation,
        hint: input.hint,
        surahNumber: input.surahNumber ?? null,
        ayahNumber: input.ayahNumber ?? null,
      }),
    }
  );
  return id;
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
  return apiFetch<QuizSummary[]>("/api/quizzes");
}

export async function createQuiz(input: QuizMetaInput): Promise<Pick<Competition, "id" | "code">> {
  return apiFetch<Pick<Competition, "id" | "code">>("/api/quizzes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getQuiz(id: string): Promise<Competition | null> {
  const { quiz } = await apiFetch<{ quiz: Competition | null }>(
    `/api/quizzes/${encodeURIComponent(id)}`
  );
  return quiz;
}

export async function updateQuizMeta(
  id: string,
  patch: Partial<QuizMetaInput>
): Promise<void> {
  await apiFetch(`/api/quizzes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Moves a game to the given lifecycle status (owner only). */
export async function setQuizStatus(
  id: string,
  status: "waiting" | "running" | "paused" | "finished" | "cancelled" | "draft" | "scheduled"
): Promise<void> {
  await apiFetch(`/api/quizzes/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Hard-deletes a quiz and its children. Drafts only (owner-enforced). */
export async function deleteQuiz(id: string): Promise<void> {
  await apiFetch(`/api/quizzes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function archiveQuiz(id: string): Promise<void> {
  await apiFetch(`/api/quizzes/${encodeURIComponent(id)}/archive`, { method: "POST" });
}

/** Snapshot-copies a quiz (own questions + choices) and returns the new id. */
export async function duplicateQuiz(id: string): Promise<string> {
  const { id: newId } = await apiFetch<{ id: string }>(
    `/api/quizzes/${encodeURIComponent(id)}/duplicate`,
    { method: "POST" }
  );
  return newId;
}

/** Questions list without hidden columns (safe for the editor sidebar). */
export async function listQuizQuestions(competitionId: string): Promise<QuestionListItem[]> {
  return apiFetch<QuestionListItem[]>(
    `/api/quizzes/${encodeURIComponent(competitionId)}/questions`
  );
}

/**
 * Whole deck incl. hidden columns in one owner-scoped call.
 * The editor used to issue one get_question_full round trip per question (N+1); on a
 * 40-question quiz that was 41 round trips before the first paint.
 */
export async function getQuizQuestionsFull(
  competitionId: string
): Promise<Array<QuizQuestionFull & { started_at: string | null }>> {
  return apiFetch<Array<QuizQuestionFull & { started_at: string | null }>>(
    `/api/quizzes/${encodeURIComponent(competitionId)}/full`
  );
}

export interface PageWordsInput {
  competitionId: string;
  questionId?: string | null;
  position: number;
  pageNumber: number;
  durationSeconds: number;
  points: number | null;
  negativePoints: number | null;
  explanation: string | null;
  surahNumber?: number | null;
  ayahNumber?: number | null;
  juzNumber?: number | null;
  hizbNumber?: number | null;
  /** Which words are hidden, in page reading order (open-quran-view addressing). */
  wordLocations: Array<{ surah: number; verse: number; position: number }>;
  /** One entry per hidden word: { text, region: <index into wordLocations> }. */
  words: Array<{ text: string; region: number }>;
}

/**
 * Save a "hidden words on a page" exercise. The server shuffles the chips and
 * derives the solution, so the answer key never round-trips through the browser.
 */
export async function savePageWordsQuestion(input: PageWordsInput): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(
    `/api/quizzes/${encodeURIComponent(input.competitionId)}/questions/save-page-words`,
    {
      method: "POST",
      body: JSON.stringify({
        questionId: input.questionId ?? null,
        position: input.position,
        pageNumber: input.pageNumber,
        wordLocations: input.wordLocations,
        words: input.words,
        durationSeconds: input.durationSeconds,
        points: input.points,
        negativePoints: input.negativePoints,
        explanation: input.explanation,
        surahNumber: input.surahNumber ?? null,
        ayahNumber: input.ayahNumber ?? null,
        juzNumber: input.juzNumber ?? null,
        hizbNumber: input.hizbNumber ?? null,
      }),
    }
  );
  return id;
}

/** Create a full quiz (questions + choices) from an exported JSON payload. */
export async function importQuiz(payload: unknown): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/api/quizzes/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return id;
}

/** Full question incl. hidden columns — owner-scoped. */
export async function getQuestionFull(questionId: string): Promise<QuizQuestionFull> {
  return apiFetch<QuizQuestionFull>(`/api/quizzes/questions/${encodeURIComponent(questionId)}/full`);
}

/** Atomic save of a question + its choices (owner only, server-validated). */
export async function saveQuestion(input: SaveQuestionInput): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(
    `/api/quizzes/${encodeURIComponent(input.competitionId)}/questions/save`,
    {
      method: "POST",
      body: JSON.stringify({
        questionId: input.questionId ?? null,
        position: input.position,
        text: input.text,
        type: input.type,
        durationSeconds: input.durationSeconds,
        points: input.points,
        negativePoints: input.negativePoints,
        explanation: input.explanation,
        correctAnswerText: input.correctAnswerText,
        surahNumber: input.surahNumber,
        ayahNumber: input.ayahNumber,
        pageNumber: input.pageNumber,
        juzNumber: input.juzNumber,
        hizbNumber: input.hizbNumber,
        choices: input.choices,
        audioUrl: input.audioUrl ?? null,
        hint: input.hint ?? null,
      }),
    }
  );
  return id;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await apiFetch(`/api/quizzes/questions/${encodeURIComponent(questionId)}`, { method: "DELETE" });
}

/** Live games (non-draft competitions owned by the caller). */
export async function listMyLiveGames(): Promise<QuizSummary[]> {
  return apiFetch<QuizSummary[]>("/api/quizzes/live");
}
