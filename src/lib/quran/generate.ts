/**
 * Build questions automatically from the published page data.
 *
 * The annotations give every word with its box and ayah; the timeline gives the
 * millisecond each word is recited. Between them a page can be turned into a
 * set of exercises without a teacher typing anything — which is the difference
 * between "a tool I could use if I had an hour" and one used on a Tuesday
 * morning.
 */
import type { AnnotatedWord } from "./pages";
import type { PageTimeline } from "./recitation";
import { audioUrl, timeOfWord } from "./recitation";

export type GeneratedKind = "hidden_words" | "continue" | "listen";

export interface GeneratedQuestion {
  type: "page_words" | "text" | "audio";
  text: string;
  duration_seconds: number;
  correct_answer_text: string | null;
  audio_url: string | null;
  hint: string | null;
  page_number: number;
  surah_number: number | null;
  ayah_number: number | null;
  regions: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  words: string[];
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Boxes are stored in workbook pixels; questions store 0..1. */
function normalise(word: AnnotatedWord, width: number, height: number) {
  return {
    x1: Math.min(1, Math.max(0, word.x1 / width)),
    y1: Math.min(1, Math.max(0, word.y1 / height)),
    x2: Math.min(1, Math.max(0, word.x2 / width)),
    y2: Math.min(1, Math.max(0, word.y2 / height)),
  };
}

export interface GenerateOptions {
  page: number;
  words: AnnotatedWord[];
  imageWidth: number;
  imageHeight: number;
  timeline?: PageTimeline | null;
  kinds: GeneratedKind[];
  /** How many of each kind to produce. */
  count: number;
  /** Words hidden per "hidden words" exercise. */
  wordsPerExercise?: number;
}

export function generateQuestions(options: GenerateOptions): GeneratedQuestion[] {
  const { page, words, imageWidth, imageHeight, timeline, kinds, count } = options;
  const perExercise = Math.max(2, options.wordsPerExercise ?? 6);
  const out: GeneratedQuestion[] = [];
  if (words.length === 0 || !imageWidth || !imageHeight) return out;

  const byAyah = new Map<number, AnnotatedWord[]>();
  for (const word of words) {
    if (!word.aya) continue;
    byAyah.set(word.aya, [...(byAyah.get(word.aya) ?? []), word]);
  }

  if (kinds.includes("hidden_words")) {
    // Draw disjoint samples so two exercises don't hide the same words.
    const pool = shuffled(words.filter((w) => w.text.trim()));
    for (let i = 0; i < count; i++) {
      const slice = pool.slice(i * perExercise, (i + 1) * perExercise);
      if (slice.length < 2) break;
      // Reading order inside the exercise, not the shuffled order.
      const ordered = slice
        .slice()
        .sort((a, b) => words.indexOf(a) - words.indexOf(b));
      out.push({
        type: "page_words",
        text: "page_words",
        duration_seconds: 120,
        correct_answer_text: null,
        audio_url: null,
        hint: null,
        page_number: page,
        surah_number: null,
        ayah_number: null,
        regions: ordered.map((w) => normalise(w, imageWidth, imageHeight)),
        words: ordered.map((w) => w.text),
      });
    }
  }

  if (kinds.includes("continue")) {
    // "…what comes next?" — the prompt is the run-up, the answer the next word.
    const ayahs = shuffled([...byAyah.values()].filter((list) => list.length >= 4));
    for (const list of ayahs.slice(0, count)) {
      const cut = Math.max(2, Math.floor(list.length / 2));
      const prompt = list.slice(Math.max(0, cut - 4), cut).map((w) => w.text).join(" ");
      const answer = list[cut]?.text;
      if (!prompt || !answer) continue;
      out.push({
        type: "text",
        text: `${prompt} …`,
        duration_seconds: 30,
        correct_answer_text: answer,
        audio_url: null,
        hint: null,
        page_number: page,
        surah_number: null,
        ayah_number: list[0]?.aya ?? null,
        regions: [],
        words: [],
      });
    }
  }

  if (kinds.includes("listen") && timeline?.audio) {
    // Play one ayah, name the word that follows it.
    const ayahs = shuffled([...byAyah.entries()].filter(([, list]) => list.length >= 3));
    for (const [aya, list] of ayahs.slice(0, count)) {
      const first = list[0];
      const last = list[list.length - 1];
      if (first?.id == null || last?.id == null) continue;
      const from = timeOfWord(timeline, first.id);
      const to = timeOfWord(timeline, last.id);
      if (from == null || to == null || to <= from) continue;
      out.push({
        type: "audio",
        text: `${from ? "" : ""}${listeningPrompt(aya)}`,
        duration_seconds: 45,
        correct_answer_text: last.text,
        // A media fragment: the player only sounds this slice of the surah.
        audio_url: `${audioUrl(timeline.audio)}#t=${(from / 1000).toFixed(2)},${(to / 1000).toFixed(2)}`,
        hint: null,
        page_number: page,
        surah_number: null,
        ayah_number: aya,
        regions: [],
        words: [],
      });
    }
  }

  return out;
}

function listeningPrompt(aya: number): string {
  return `استمع إلى الآية ${aya} ثم اكتب الكلمة الأخيرة`;
}
