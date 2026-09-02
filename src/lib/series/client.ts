import { getSupabase } from "@/lib/supabase/client";

/**
 * The browser's side of the series API.
 *
 * Every call carries the caller's own Supabase token, because the server
 * decides who is asking from the token and never from the body: an attempt is
 * only ever marked for the person whose session opened it.
 */
async function authorized(): Promise<HeadersInit> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in first");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function unwrap(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

export interface SeriesExercise {
  num: number;
  page: number;
  diff: number;
  /** How many words this exercise hides. */
  mots: number;
  /** Minutes allowed; 0 means no limit. */
  limite: number;
  /** true — the place is given and the word is written; false — the other way. */
  ecrire_mot: boolean;
}

export interface SeriesSummary {
  id: string;
  nom: string;
  exercices: SeriesExercise[];
}

/** Every series on offer. Public: a plan holds no answers. */
export async function listSeries(): Promise<SeriesSummary[]> {
  return unwrap(await fetch("/api/series"));
}

export interface Prompt {
  i: number;
  /** Writing mode: where the missing word sits. */
  line?: number;
  rank?: number;
  /** Position mode: the word whose place is asked for. */
  text?: string;
}

export interface StartedExercise {
  attemptId: string;
  num: number;
  page: number;
  diff: number;
  limite: number;
  ecrire_mot: boolean;
  prompts: Prompt[];
}

export async function startExercise(seriesId: string, num: number): Promise<StartedExercise> {
  return unwrap(
    await fetch(`/api/series/${encodeURIComponent(seriesId)}/start`, {
      method: "POST",
      headers: await authorized(),
      body: JSON.stringify({ num }),
    })
  );
}

export interface Correction {
  i: number;
  right: boolean;
  answered: boolean;
  expected: string | { line: number; rank: number };
  given: unknown;
}

export interface Marked {
  note: number;
  right: number;
  answered: number;
  total: number;
  seconds: number;
  corrections: Correction[];
}

export async function submitExercise(
  seriesId: string,
  attemptId: string,
  answers: unknown[],
  seconds: number
): Promise<Marked> {
  return unwrap(
    await fetch(`/api/series/${encodeURIComponent(seriesId)}/submit`, {
      method: "POST",
      headers: await authorized(),
      body: JSON.stringify({ attemptId, answers, seconds }),
    })
  );
}

export interface Attempt {
  id: string;
  series_id: string;
  profile_id: string;
  exercise_num: number | null;
  page: number | null;
  score: number | null;
  answered: number | null;
  total: number | null;
  errors: number | null;
  seconds: number | null;
  started_at: string;
  finished_at: string | null;
}

/** The signed-in student's own marked attempts, newest first. */
export async function myAttempts(): Promise<Attempt[]> {
  const { data, error } = await getSupabase()
    .from("series_attempts")
    .select(
      "id, series_id, profile_id, exercise_num, page, score, answered, total, errors, seconds, started_at, finished_at"
    )
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(400);
  if (error) throw error;
  return (data as Attempt[]) ?? [];
}

/**
 * Marked attempts for a set of students.
 *
 * No class id is passed: the teacher policy on series_attempts already limits
 * the rows to members of classes this account owns, so asking for a stranger's
 * id returns nothing rather than someone else's marks.
 */
export async function attemptsForStudents(profileIds: string[]): Promise<Attempt[]> {
  if (profileIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from("series_attempts")
    .select(
      "id, series_id, profile_id, exercise_num, page, score, answered, total, errors, seconds, started_at, finished_at"
    )
    .in("profile_id", profileIds)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data as Attempt[]) ?? [];
}
