/**
 * Memorisation state, kept per device.
 *
 * Deliberately local: this is a learner's private judgement of their own
 * progress ("I think I know this page"), not an assessment the teacher should
 * see or the server should hold. Nothing here needs an account.
 */
const STORAGE_KEY = "quizcast-hifz";
const BOOKMARK_KEY = "quizcast-bookmark";

export type PageState = "learning" | "known";

type Store = Record<string, PageState>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private mode or a full quota: progress is a nicety, never a blocker.
  }
}

export function getPageStates(): Store {
  if (typeof window === "undefined") return {};
  return read();
}

export function getPageState(page: number): PageState | null {
  return getPageStates()[String(page)] ?? null;
}

/** Cycles none -> learning -> known -> none, which is the whole UI. */
export function cyclePageState(page: number): PageState | null {
  const store = read();
  const key = String(page);
  const next: PageState | null =
    store[key] === "learning" ? "known" : store[key] === "known" ? null : "learning";
  if (next) store[key] = next;
  else delete store[key];
  write(store);
  return next;
}

export interface Bookmark {
  page: number;
  /** Audio position in seconds, so a session resumes where it stopped. */
  seconds: number;
}

export function saveBookmark(page: number, seconds: number): void {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify({ page, seconds }));
  } catch {
    // ignore
  }
}

export function readBookmark(): Bookmark | null {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.page !== "number") return null;
    return { page: parsed.page, seconds: Number(parsed.seconds) || 0 };
  } catch {
    return null;
  }
}
