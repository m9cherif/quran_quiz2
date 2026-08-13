/**
 * Recitation timelines: which word is being recited at which millisecond.
 *
 * Timelines ship with the app (small JSON); the mp3s stay on the upstream repo
 * and stream at playback time — 53 files of several megabytes each have no
 * business in a git repository or a deployment bundle.
 */
const AUDIO_BASE =
  "https://raw.githubusercontent.com/m9cherif/flutter_quran_data/main/audio";

export interface TimelineEvent {
  /** Milliseconds from the start of the recording. */
  t: number;
  /** Annotation word id this moment belongs to. */
  w: number;
}

export interface PageTimeline {
  page: number;
  /** File name inside the upstream audio folder, e.g. "062.mp3". */
  audio: string | null;
  /** Where in the mp3 this page begins (ms) — pages share a surah recording. */
  start: number;
  duration: number;
  events: TimelineEvent[];
}

export function audioUrl(file: string): string {
  return `${AUDIO_BASE}/${file}`;
}

let indexPromise: Promise<Record<string, { audio: string; words: number; duration: number }>> | null =
  null;
const cache = new Map<number, PageTimeline | null>();

/** page -> { audio, words, duration } for every page that has a recording. */
export function loadTimelineIndex() {
  if (!indexPromise) {
    indexPromise = fetch("/timeline/index.json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return indexPromise;
}

export async function loadTimeline(page: number): Promise<PageTimeline | null> {
  if (cache.has(page)) return cache.get(page) ?? null;
  try {
    const res = await fetch(`/timeline/${page}.json`);
    const data: PageTimeline | null = res.ok ? await res.json() : null;
    cache.set(page, data);
    return data;
  } catch {
    cache.set(page, null);
    return null;
  }
}

/**
 * The word being recited at a given audio position.
 * Events are ordered, so this is a binary search over "last event at or before
 * now" rather than a scan — it runs on every animation frame.
 */
export function wordAt(timeline: PageTimeline, audioMs: number): number | null {
  const rel = audioMs - timeline.start;
  const events = timeline.events;
  if (rel < 0 || events.length === 0) return null;

  let lo = 0;
  let hi = events.length - 1;
  let found: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t <= rel) {
      found = events[mid].w;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export interface WordSpan {
  /** Annotation word id. */
  w: number;
  /** Absolute audio positions (ms). */
  from: number;
  to: number;
}

/**
 * Every word's start AND end in the recording.
 *
 * The timeline stores only the moment each word is reached, but a word ends
 * where the next one begins — so exact spans fall out of the same data, and a
 * range can be played from precisely one word to precisely another without any
 * extra file to keep in step.
 */
export function wordSpans(timeline: PageTimeline): WordSpan[] {
  const events = timeline.events;
  const end = timeline.start + (timeline.duration || 0);
  return events.map((event, i) => ({
    w: event.w,
    from: timeline.start + event.t,
    to: i + 1 < events.length ? timeline.start + events[i + 1].t : end,
  }));
}

/** Audio position (ms) at which a given word starts, if the recording has it. */
export function timeOfWord(timeline: PageTimeline, wordId: number): number | null {
  const event = timeline.events.find((e) => e.w === wordId);
  return event ? timeline.start + event.t : null;
}
