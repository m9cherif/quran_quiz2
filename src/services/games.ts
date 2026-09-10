import { getQuestionFull } from "./quizzes";
import type { Competition, Participant, Answer } from "@/types/database";

/**
 * Client-side wrappers over src/app/api/games/* — the post-Supabase
 * replacement for the old supabase-js + RPC calls. Function names/params are
 * kept identical to the previous version so consuming components
 * (LiveGameControl.jsx, GameQuestion.jsx, GameLobby.jsx, GameResult.jsx,
 * JoinGameForm.jsx, ...) need no changes here.
 *
 * Errors thrown carry the same `.code`/`.message` shape callers already
 * switch on (e.g. `err.code === "28000"`), rehydrated from the route's JSON
 * error body `{ error, code }`.
 */
class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function apiFetch<T = unknown>(
  path: string,
  options: (RequestInit & { token?: string | null }) = {}
): Promise<T> {
  const { token, headers, body, ...rest } = options;
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "x-participant-token": token } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body,
    ...rest,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const obj = (payload && typeof payload === "object" ? payload : {}) as { error?: string; code?: string };
    throw new ApiError(obj.error || res.statusText, obj.code, res.status);
  }
  return payload as T;
}

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
  /** page_words exercises only: which page, and which words are hidden. */
  page_number?: number | null;
  word_locations?: Array<{ surah: number; verse: number; position: number }> | null;
  audio_url?: string | null;
  hint?: string | null;
}

/** Load the competition behind a room code (owner or visible to player). */
export async function getGameByCode(code: string): Promise<Competition | null> {
  return apiFetch<Competition | null>(`/api/games/code/${encodeURIComponent(code)}`);
}

/** Question deck for the host (safe columns + timing). */
export async function listGameQuestions(competitionId: string): Promise<GameQuestionRow[]> {
  return apiFetch<GameQuestionRow[]>(`/api/games/${competitionId}/questions`);
}

/** Players of a competition (owner view; anonymous players self-view). */
export async function listParticipants(competitionId: string): Promise<Participant[]> {
  return apiFetch<Participant[]>(`/api/games/${competitionId}/participants`);
}

/** Host-side question reveal view (full row, owner only). */
export function getHostQuestionFull(questionId: string) {
  return getQuestionFull(questionId);
}

/** Server-timestamped question start (host only). */
export async function beginQuestion(questionId: string): Promise<void> {
  await apiFetch(`/api/games/questions/${questionId}/begin`, { method: "POST" });
}

export interface AdvanceResult {
  closed_question_id: string | null;
  started_question_id: string | null;
  started_position: number | null;
  ends_at: string | null;
  has_more: boolean;
}

/**
 * Close the open question and open the next one in a single call (host
 * only). Replaces the end→begin pair, so the round cannot be left
 * half-advanced if the second call fails, and costs one round trip.
 */
export async function advanceGame(competitionId: string): Promise<AdvanceResult> {
  return apiFetch<AdvanceResult>(`/api/games/${competitionId}/advance`, { method: "POST" });
}

/** Force-close the current question early (host only). */
export async function endQuestion(questionId: string): Promise<void> {
  await apiFetch(`/api/games/questions/${questionId}/end`, { method: "POST" });
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

export interface OpenGameRow {
  id: string;
  code: string;
  title: string | null;
  name: string;
  language: string | null;
  category: string | null;
  status: string;
  created_at: string;
}

/** Games currently open for joining. */
export async function listOpenGames(): Promise<OpenGameRow[]> {
  return apiFetch<OpenGameRow[]>(`/api/games/open`);
}

/** Join a waiting game by its public code. Returns the participant row. */
export async function joinGame(
  code: string,
  displayName: string,
  profileId?: string | null
): Promise<Participant> {
  return apiFetch<Participant>(`/api/games/join`, {
    method: "POST",
    body: JSON.stringify({
      code: code.trim().toUpperCase(),
      displayName: displayName.trim(),
      profileId: profileId ?? null,
    }),
  });
}

/** Restore/validate my participant row for a competition (token client). */
export async function getMyParticipant(
  competitionId: string,
  accessToken: string
): Promise<Participant | null> {
  return apiFetch<Participant | null>(`/api/games/${competitionId}/participant`, { token: accessToken });
}

/** Student: choose my own emoji avatar (token-scoped to me). */
export async function setMyAvatar(
  competitionId: string,
  accessToken: string,
  avatar: string
): Promise<void> {
  await apiFetch(`/api/games/${competitionId}/avatar`, {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({ avatar }),
  });
}

/** Presence heartbeat: mark myself online with a server timestamp. */
export async function updatePresence(competitionId: string, accessToken: string): Promise<void> {
  await apiFetch(`/api/games/${competitionId}/presence`, { method: "POST", token: accessToken });
}

/** Lobby player count (aggregate only — participants can't see names). */
export async function gameParticipantCount(
  competitionId: string,
  accessToken?: string
): Promise<number> {
  return apiFetch<number>(`/api/games/${competitionId}/participant-count`, { token: accessToken });
}

/** Question deck for students (safe columns; requires the token header). */
export async function listStudentQuestions(
  competitionId: string,
  accessToken: string
): Promise<GameQuestionRow[]> {
  return apiFetch<GameQuestionRow[]>(`/api/games/${competitionId}/questions`, { token: accessToken });
}

/** Choices for a set of questions (student token client; is_correct hidden). */
export async function listChoices(
  questionIds: string[],
  accessToken: string
): Promise<{ id: string; question_id: string; text: string; position: number }[]> {
  if (questionIds.length === 0) return [];
  return apiFetch<{ id: string; question_id: string; text: string; position: number }[]>(
    `/api/games/choices?questionIds=${questionIds.map(encodeURIComponent).join(",")}`,
    { token: accessToken }
  );
}

/** Submit my (locked, single) answer. Returns the graded answer row. */
export async function submitAnswer(
  competitionId: string,
  questionId: string,
  accessToken: string,
  options: { choiceId?: string; answerText?: string; responseTimeMs: number }
): Promise<Answer> {
  return apiFetch<Answer>(`/api/games/answers`, {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({
      competitionId,
      questionId,
      choiceId: options.choiceId ?? null,
      answerText: options.answerText ?? null,
      responseTimeMs: Math.max(0, Math.round(options.responseTimeMs)),
    }),
  });
}

/**
 * Store work-in-progress for a question while its window is open, so the
 * server holds the student's placements even if they never press submit or
 * the timer runs out first. The first call fixes the response time.
 */
export async function saveProgressAnswer(
  competitionId: string,
  questionId: string,
  accessToken: string,
  options: { choiceId?: string | null; answerText?: string | null; responseTimeMs: number }
): Promise<Answer> {
  return apiFetch<Answer>(`/api/games/progress`, {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({
      competitionId,
      questionId,
      answerText: options.answerText ?? null,
      responseTimeMs: Math.max(0, Math.round(options.responseTimeMs)),
      choiceId: options.choiceId ?? null,
    }),
  });
}

/** My answers in a game (own rows only). */
export async function getMyAnswers(
  competitionId: string,
  accessToken: string
): Promise<Answer[]> {
  return apiFetch<Answer[]>(`/api/games/${competitionId}/answers/mine`, { token: accessToken });
}

/** Correct answer + explanation for a closed question (own result). */
export async function getReveal(
  questionId: string,
  accessToken: string
): Promise<RevealPayload> {
  return apiFetch<RevealPayload>(`/api/games/questions/${questionId}/reveal`, { token: accessToken });
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
  return apiFetch<LeaderboardRow[]>(`/api/games/${competitionId}/leaderboard`, { token: accessToken });
}

export interface LeaderboardRow {
  rank: number;
  participant_id: string;
  display_name: string;
  correct_count: number;
  answered_count: number;
  total_points: number;
  team: string | null;
  avatar: string | null;
}

export interface QuestionStatRow {
  position_number: number;
  text: string;
  duration_seconds: number;
  answered_count: number;
  correct_count: number;
  accuracy: number;
}

/** Per-question answered/correct/accuracy — host only (owner-scoped route). */
export async function getQuestionStats(competitionId: string): Promise<QuestionStatRow[]> {
  return apiFetch<QuestionStatRow[]>(`/api/games/${competitionId}/stats`);
}

/** Host: add seconds to the open question (negative shortens it). */
export async function extendQuestion(questionId: string, seconds: number): Promise<string> {
  const result = await apiFetch<{ ends_at: string }>(`/api/games/questions/${questionId}/extend`, {
    method: "POST",
    body: JSON.stringify({ seconds }),
  });
  return result.ends_at;
}

/** Host: award (or deduct) points by hand, outside the graded answers. */
export async function awardBonus(participantId: string, points: number): Promise<number> {
  const total = await apiFetch<number>(`/api/games/participants/${participantId}/bonus`, {
    method: "POST",
    body: JSON.stringify({ points }),
  });
  return Number(total ?? 0);
}

/** Host: remove a player from the game. */
export async function removePlayer(participantId: string): Promise<void> {
  await apiFetch(`/api/games/participants/${participantId}`, { method: "DELETE" });
}

/** Host: put one player on a team (empty string clears it). */
export async function setPlayerTeam(participantId: string, team: string): Promise<void> {
  await apiFetch(`/api/games/participants/${participantId}`, {
    method: "PATCH",
    body: JSON.stringify({ team }),
  });
}

/** Host: deal everyone into N even teams at random (0 disbands them). */
export async function shuffleTeams(competitionId: string, teamCount: number): Promise<void> {
  await apiFetch(`/api/games/${competitionId}/teams/shuffle`, {
    method: "POST",
    body: JSON.stringify({ teamCount }),
  });
}

export interface TeamStandingRow {
  team: string;
  players: number;
  total_points: number;
  correct_count: number;
}

/** Team totals for the game. */
export async function getTeamStandings(
  competitionId: string,
  accessToken?: string | null
): Promise<TeamStandingRow[]> {
  return apiFetch<TeamStandingRow[]>(`/api/games/${competitionId}/teams`, { token: accessToken });
}

/**
 * Every answer to one question, for the host.
 * Carries answer_text, which is what page and ordering questions store
 * their whole solution in.
 */
export async function listQuestionAnswers(
  competitionId: string,
  questionId: string
): Promise<Answer[]> {
  void competitionId; // kept for signature parity — the route derives it from the question itself
  return apiFetch<Answer[]>(`/api/games/questions/${questionId}/answers`);
}

export interface ChoiceDistributionRow {
  choice_id: string;
  choice_text: string;
  position_number: number;
  votes: number;
  is_correct: boolean;
}

/** Live answer spread for one question — host only. */
export async function getChoiceDistribution(
  questionId: string
): Promise<ChoiceDistributionRow[]> {
  return apiFetch<ChoiceDistributionRow[]>(`/api/games/questions/${questionId}/distribution`);
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
  return apiFetch<AnswerMatrixRow[]>(`/api/games/${competitionId}/matrix`);
}
