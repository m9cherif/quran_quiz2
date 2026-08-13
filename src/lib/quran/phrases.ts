/**
 * Finding the reciter's pauses, and the phrases between them.
 *
 * The timeline records the millisecond each word is reached. The gap between
 * one word and the next is therefore "how long that word took, plus any pause
 * after it" — and a pause for breath or a waqf is much longer than an ordinary
 * word. So the silences can be located from the timing alone, with no audio
 * analysis: find the unusually large gaps, and cut there.
 *
 * The threshold adapts to the reciter rather than being a fixed number of
 * milliseconds: a slow, measured recitation has larger ordinary gaps than a
 * quick one, and a constant would carve the slow one into nonsense.
 */
import type { AnnotatedWord } from "./pages";
import type { PageTimeline } from "./recitation";

export interface Phrase {
  index: number;
  /** Audio positions (ms, absolute in the mp3). */
  from: number;
  to: number;
  words: AnnotatedWord[];
  text: string;
  /** Bounding box of the phrase on the page, in image pixels. */
  box: { x1: number; y1: number; x2: number; y2: number };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface SplitOptions {
  /** Ignore phrases shorter than this many words — they make poor questions. */
  minWords?: number;
  /** How much longer than a typical gap counts as a pause. */
  sensitivity?: number;
}

/**
 * Cut a page into phrases at the reciter's pauses.
 * Returns them in recitation order with their audio bounds and page box.
 */
export function splitIntoPhrases(
  timeline: PageTimeline,
  words: AnnotatedWord[],
  options: SplitOptions = {}
): Phrase[] {
  const minWords = options.minWords ?? 2;
  const sensitivity = options.sensitivity ?? 2.2;

  const byId = new Map<number, AnnotatedWord>();
  for (const word of words) if (word.id != null) byId.set(word.id, word);

  // Only events whose word is actually on the page can be drawn or cropped.
  const events = timeline.events.filter((e) => byId.has(e.w));
  if (events.length < 2) return [];

  const gaps: number[] = [];
  for (let i = 1; i < events.length; i++) gaps.push(events[i].t - events[i - 1].t);

  const typical = median(gaps) || 400;
  const pause = Math.max(650, typical * sensitivity);

  // Cut before any event that follows an unusually long gap.
  const groups: Array<typeof events> = [];
  let current: typeof events = [events[0]];
  for (let i = 1; i < events.length; i++) {
    if (events[i].t - events[i - 1].t >= pause) {
      groups.push(current);
      current = [];
    }
    current.push(events[i]);
  }
  groups.push(current);

  const end = timeline.start + (timeline.duration || 0);
  const phrases: Phrase[] = [];

  groups.forEach((group, i) => {
    const groupWords = group.map((e) => byId.get(e.w)!).filter(Boolean);
    if (groupWords.length < minWords) return;

    const from = timeline.start + group[0].t;
    // Run to the next phrase's first word: the trailing silence belongs to
    // this phrase, which is what makes it sound complete when played back.
    const next = groups[i + 1];
    const to = next ? timeline.start + next[0].t : end || timeline.start + group[group.length - 1].t + 2000;

    phrases.push({
      index: phrases.length,
      from,
      to,
      words: groupWords,
      text: groupWords.map((w) => w.text).join(" "),
      box: {
        x1: Math.min(...groupWords.map((w) => w.x1)),
        y1: Math.min(...groupWords.map((w) => w.y1)),
        x2: Math.max(...groupWords.map((w) => w.x2)),
        y2: Math.max(...groupWords.map((w) => w.y2)),
      },
    });
  });

  return phrases;
}

/** Where the pauses fell, for anyone who wants to show or tune them. */
export function pauseCount(timeline: PageTimeline, words: AnnotatedWord[]): number {
  return Math.max(0, splitIntoPhrases(timeline, words).length - 1);
}

/** Pick n items at random, without repeats. */
export function sample<T>(list: T[], n: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
