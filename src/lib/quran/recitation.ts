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

export interface TimelinePart {
  /** File name inside the upstream audio folder, e.g. "062.mp3". */
  audio: string | null;
  /** Where in that mp3 this stretch begins (ms) — pages share a recording. */
  start: number;
  duration: number;
  events: TimelineEvent[];
}

export interface PageTimeline extends TimelinePart {
  page: number;
  /**
   * Present when the page's words are spread over more than one recording.
   *
   * A page can straddle two surahs — 554 ends al-Jumu'a and begins
   * al-Munafiqun — and each surah is a separate file. The first part is also
   * repeated in the plain fields above, so a reader that knows nothing of parts
   * still gets a working timeline for the beginning of the page rather than
   * nothing at all.
   */
  parts?: TimelinePart[];
}

/** Every stretch of recording this page uses, oldest format included. */
export function timelineParts(timeline: PageTimeline): TimelinePart[] {
  if (timeline.parts?.length) return timeline.parts;
  return [
    {
      audio: timeline.audio,
      start: timeline.start,
      duration: timeline.duration,
      events: timeline.events,
    },
  ];
}

/** The stretch of recording a given word is recited in. */
export function partOfWord(timeline: PageTimeline, wordId: number): TimelinePart | null {
  return timelineParts(timeline).find((p) => p.events.some((e) => e.w === wordId)) ?? null;
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
export function wordAt(
  timeline: PageTimeline | TimelinePart,
  audioMs: number
): number | null {
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
  /** Absolute audio positions (ms), inside `audio`. */
  from: number;
  to: number;
  /** Which recording these positions belong to. */
  audio: string | null;
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
  return timelineParts(timeline).flatMap((part) => {
    const end = part.start + (part.duration || 0);
    return part.events.map((event, i) => ({
      w: event.w,
      from: part.start + event.t,
      to: i + 1 < part.events.length ? part.start + part.events[i + 1].t : end,
      audio: part.audio,
    }));
  });
}

/**
 * Audio position (ms) at which a given word starts, if the recording has it.
 *
 * Looks through every part, so a word in the second half of a page that
 * straddles two surahs is found — pair it with `partOfWord` to know which
 * recording that position is in.
 */
export function timeOfWord(timeline: PageTimeline, wordId: number): number | null {
  for (const part of timelineParts(timeline)) {
    const event = part.events.find((e) => e.w === wordId);
    if (event) return part.start + event.t;
  }
  return null;
}

/** The recording a word is in, and where in it — everything needed to play it. */
export function locateWord(
  timeline: PageTimeline,
  wordId: number
): { audio: string | null; ms: number } | null {
  for (const part of timelineParts(timeline)) {
    const event = part.events.find((e) => e.w === wordId);
    if (event) return { audio: part.audio, ms: part.start + event.t };
  }
  return null;
}
