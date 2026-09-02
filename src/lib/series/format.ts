import { normaliseArabic } from "@/lib/quran/pages";

/**
 * A series of exercises of rising difficulty, as the desktop tool defines them.
 *
 * The keys are the ones already used in plan_serie_modele.json — nom, exercices,
 * diff, page, n, n_fixe, limite, ecrire_mot, mots — so a plan written there can
 * be dropped into the data repo and used unchanged. Renaming them to English
 * would have meant rewriting every plan the teacher already has, for nothing.
 *
 * An exercise is not written out by hand: it is generated. The teacher says
 * "page 601, difficulty 50, ten words, ten minutes" and the words to hide are
 * drawn from the page.
 */
export interface PlanExercise {
  page: number | string;
  /** 0..100. Drives how many words are hidden when the teacher fixes no count. */
  diff: number;
  /** Words to hide. Absent means "work it out from the difficulty". */
  n?: number;
  n_fixe?: boolean;
  /** Time allowed, in minutes. 0 or absent means no limit. */
  limite?: number;
  /**
   * Which way round the exercise runs.
   *
   * false — the word is given and the student says where it is: line number and
   *         rank within the line, counted right to left.
   * true  — the position is given and the student writes the word.
   */
  ecrire_mot?: boolean;
  /** Word ids chosen by the teacher, overriding the count. */
  mots?: number[];
}

export interface Plan {
  /** Stable name for the series; the file name when the plan does not say. */
  id?: string;
  nom: string;
  exercices: PlanExercise[];
}

/**
 * How many words an exercise hides.
 *
 * Same curve as the desktop tool: four words at the easiest, one more for every
 * five points of difficulty, and never fewer than three or more than
 * twenty-five — a page has only so many words worth hiding.
 */
export function autoCount(diff: number): number {
  return Math.max(3, Math.min(25, 4 + Math.round(diff * 0.2)));
}

export function wordCount(exercise: PlanExercise): number {
  if (exercise.mots?.length) return exercise.mots.length;
  return Number(exercise.n) || autoCount(Number(exercise.diff) || 0);
}

/**
 * A small deterministic generator.
 *
 * The words must be the same every time a student reloads the page, or the
 * exercise changes underneath them and any answer already given stops meaning
 * anything. Seeding from the attempt makes the draw stable for that student and
 * different for the next.
 */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface PageWord {
  id: number;
  text: string;
  line: number;
  rank: number;
}

/** The words this exercise hides, in reading order. */
export function pickWords(exercise: PlanExercise, page: PageWord[], seed: string): PageWord[] {
  if (exercise.mots?.length) {
    const wanted = new Set(exercise.mots);
    return page.filter((w) => wanted.has(w.id));
  }

  const random = seeded(seed);
  const pool = [...page];
  // Fisher-Yates, so every word has the same chance of being chosen — sorting
  // by a random key biases the draw towards the start of the page.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, Math.min(wordCount(exercise), pool.length));
  return chosen.sort((a, b) => a.line - b.line || a.rank - b.rank);
}

/**
 * What the student is asked for, and what counts as right.
 *
 * Writing mode compares the words the way the rest of the site does, so a
 * missing hamza is not a wrong answer. Position mode compares two numbers.
 */
export function checkAnswer(
  ecrireMot: boolean,
  word: PageWord,
  given: unknown
): boolean {
  if (ecrireMot) {
    return normaliseArabic(String(given ?? "")) === normaliseArabic(word.text);
  }
  const answer = given as { line?: unknown; rank?: unknown } | null;
  return Number(answer?.line) === word.line && Number(answer?.rank) === word.rank;
}

/** The mark for one exercise, out of 100 — the proportion right, as in the desktop tool. */
export function noteOutOf100(right: number, total: number): number {
  return Math.round(Math.min(100, (right / Math.max(total, 1)) * 100) * 10) / 10;
}
