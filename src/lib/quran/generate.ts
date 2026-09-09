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
import { audioUrl, locateWord } from "./recitation";

// "hidden_words" (page_words) generation is not offered here for now: it was
// built entirely on the pixel-annotation pipeline (word boxes normalised
// against an <img>'s pixel size) that PageWordsEditor no longer uses since
// it moved to open-quran-view's text rendering, addressed by
// surah/verse/position rather than pixels. Someone can still build a
// page_words question — by hand, in the editor — just not in bulk from here.
export type GeneratedKind = "continue" | "listen";

export interface GeneratedQuestion {
  type: "text" | "audio";
  text: string;
  duration_seconds: number;
  correct_answer_text: string | null;
  audio_url: string | null;
  hint: string | null;
  page_number: number;
  surah_number: number | null;
  ayah_number: number | null;
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

export interface GenerateOptions {
  page: number;
  words: AnnotatedWord[];
  imageWidth: number;
  imageHeight: number;
  timeline?: PageTimeline | null;
  kinds: GeneratedKind[];
  /** How many of each kind to produce. */
  count: number;
}

export function generateQuestions(options: GenerateOptions): GeneratedQuestion[] {
  const { page, words, imageWidth, imageHeight, timeline, kinds, count } = options;
  const out: GeneratedQuestion[] = [];
  if (words.length === 0 || !imageWidth || !imageHeight) return out;

  const byAyah = new Map<number, AnnotatedWord[]>();
  for (const word of words) {
    if (!word.aya) continue;
    byAyah.set(word.aya, [...(byAyah.get(word.aya) ?? []), word]);
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
      const opening = locateWord(timeline, first.id);
      const closing = locateWord(timeline, last.id);
      // A clip is one media fragment, so both ends must be in one recording.
      // On a page that straddles two surahs each ayah still is, so this only
      // ever skips a malformed timeline.
      if (!opening?.audio || !closing || opening.audio !== closing.audio) continue;
      const from = opening.ms;
      const to = closing.ms;
      if (to <= from) continue;
      out.push({
        type: "audio",
        text: `${from ? "" : ""}${listeningPrompt(aya)}`,
        duration_seconds: 45,
        correct_answer_text: last.text,
        // A media fragment: the player only sounds this slice of the surah.
        audio_url: `${audioUrl(opening.audio)}#t=${(from / 1000).toFixed(2)},${(to / 1000).toFixed(2)}`,
        hint: null,
        page_number: page,
        surah_number: null,
        ayah_number: aya,
        words: [],
      });
    }
  }

  return out;
}

function listeningPrompt(aya: number): string {
  return `استمع إلى الآية ${aya} ثم اكتب الكلمة الأخيرة`;
}
