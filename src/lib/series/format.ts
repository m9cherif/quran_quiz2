import { normaliseArabic } from "@/lib/quran/pages";

/**
 * An exercise series: a set of exercises prepared in advance, worked through by
 * one student at their own pace.
 *
 * A series is a file in the data repo, not a row in the database. That is the
 * same choice made for the timelines and for the same reasons: it is content,
 * it is reviewed and versioned like content, and a teacher can prepare a term's
 * worth without touching the application. What the database holds is only what
 * the repo cannot — who attempted what, and how it went.
 *
 * The exercise types are the ones the app already plays, so a series reuses the
 * components rather than inventing a parallel set.
 */
export type ExerciseType = "mcq" | "text" | "page_words" | "audio_range";

export interface Exercise {
  id: string;
  type: ExerciseType;
  /** Shown to the student. Optional for page_words, where the page is the question. */
  text?: string;
  points?: number;
  hint?: string;
  explanation?: string;

  /** mcq and audio_range */
  choices?: string[];
  /** Index into `choices`, or the expected string for `text`. */
  answer?: number | string;

  /** page_words and audio_range */
  page?: number;
  /** page_words: the annotation ids to blank out, in reading order. */
  words?: number[];
  /** audio_range: the first and last word of the passage to play. */
  from?: number;
  to?: number;
}

export interface Series {
  id: string;
  title: string;
  description?: string;
  /** Ordering hint for the list; 1 is the easiest. */
  level?: number;
  pages?: number[];
  exercises: Exercise[];
}

/** What a series looks like once the answer key has been taken out of it. */
export type PublicExercise = Omit<Exercise, "answer">;
export interface PublicSeries extends Omit<Series, "exercises"> {
  exercises: PublicExercise[];
  totalPoints: number;
}

export function pointsFor(exercise: Exercise): number {
  return Number.isFinite(exercise.points) ? Number(exercise.points) : 10;
}

/**
 * The series as the browser may see it.
 *
 * The answer key never leaves the server. The data repo is public, so anyone
 * determined can read the file there — this does not pretend otherwise. What it
 * stops is the ordinary case: opening the network tab and reading the answers
 * off the page you are being marked on.
 */
export function stripAnswers(series: Series): PublicSeries {
  return {
    ...series,
    totalPoints: series.exercises.reduce((sum, e) => sum + pointsFor(e), 0),
    exercises: series.exercises.map(({ answer, ...rest }) => rest),
  };
}

export interface Grade {
  correct: boolean;
  points: number;
  /** For page_words: how many blanks were right, so partial work shows. */
  detail?: { right: number; total: number };
}

/**
 * Mark one answer.
 *
 * Page exercises are marked blank by blank rather than all-or-nothing: filling
 * nine words of ten is not the same as filling none, and a student who is told
 * it is will stop trying.
 *
 * `expectedWords` is required for page_words — see the note inside.
 */
export function grade(exercise: Exercise, answer: unknown, expectedWords?: string[]): Grade {
  const points = pointsFor(exercise);

  if (exercise.type === "mcq" || exercise.type === "audio_range") {
    const correct = Number(answer) === Number(exercise.answer);
    return { correct, points: correct ? points : 0 };
  }

  if (exercise.type === "text") {
    const correct =
      normaliseArabic(String(answer ?? "")) === normaliseArabic(String(exercise.answer ?? ""));
    return { correct, points: correct ? points : 0 };
  }

  if (exercise.type === "page_words") {
    // The series names the blanks by annotation id, never by their text: the
    // page is the source of truth for what a word says, and copying it into the
    // series would let the two drift apart silently. The caller resolves the
    // ids against the annotations and passes the words in.
    const expected = expectedWords ?? [];
    const given = Array.isArray(answer) ? answer : [];
    if (expected.length === 0) return { correct: false, points: 0 };
    const right = expected.filter(
      (_, i) => normaliseArabic(String(given[i] ?? "")) === normaliseArabic(String(expected[i]))
    ).length;
    return {
      correct: right === expected.length,
      points: Math.round((points * right) / expected.length),
      detail: { right, total: expected.length },
    };
  }

  return { correct: false, points: 0 };
}
