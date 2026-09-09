/**
 * Quran page images.
 *
 * Source: github.com/m9cherif/flutter_quran_data (png/pageNNN.png). Only part
 * of the mushaf is published there, and which part changes as the upstream
 * folder is renumbered — hardcoding a range is what broke every picker the
 * last time that happened, every option it offered pointing at an image that
 * no longer existed. So the real list is imported at build time instead (the
 * same way the annotations already are, in scripts/fetch-pages.mjs) and
 * loaded here rather than assumed.
 */

const RAW_BASE =
  "https://raw.githubusercontent.com/m9cherif/flutter_quran_data/main/png";

/** A page to default to before the real list has loaded. Not a guarantee it exists. */
export const DEFAULT_PAGE = 1;

let pagesPromise: Promise<number[]> | null = null;

/** Every page number that currently has a published image, ascending. */
export function loadAvailablePages(): Promise<number[]> {
  if (!pagesPromise) {
    pagesPromise = fetch("/quran/pages.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (Array.isArray(d?.pages) ? d.pages : []))
      .catch(() => []);
  }
  return pagesPromise;
}

/** Sanity check, not an existence check — real availability is the loaded list. */
export function isPageAvailable(page: number | null | undefined): boolean {
  return typeof page === "number" && Number.isInteger(page) && page > 0;
}

/** Absolute URL of a page image (empty string when the page number is invalid). */
export function pageImageUrl(page: number | null | undefined): string {
  // Filenames are zero-padded to 3 digits (page001.png … page604.png). That
  // never showed up as a bug while every page in use was already 3 digits —
  // it only became visible once the upstream range dropped below 100.
  return isPageAvailable(page) ? `${RAW_BASE}/page${String(page).padStart(3, "0")}.png` : "";
}

/** Box on a page, normalised 0..1 so it scales with the rendered width. */
export interface PageRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Normalised box from two drag points, dropping accidental micro-drags. */
export function regionFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number
): PageRegion | null {
  const x1 = clamp01(Math.min(ax, bx));
  const y1 = clamp01(Math.min(ay, by));
  const x2 = clamp01(Math.max(ax, bx));
  const y2 = clamp01(Math.max(ay, by));
  if (x2 - x1 < 0.006 || y2 - y1 < 0.004) return null;
  return { x1, y1, x2, y2 };
}

/** Reading order for Arabic: top line first, right-to-left inside a line. */
export function sortRegions(regions: PageRegion[]): PageRegion[] {
  return [...regions].sort((a, b) => {
    const sameLine = Math.abs(a.y1 - b.y1) < 0.012;
    return sameLine ? b.x2 - a.x2 : a.y1 - b.y1;
  });
}

/** One annotated word: pixel box on the page image plus its text. */
export interface AnnotatedWord {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Workbook word id — what the recitation timelines reference. */
  id: number | null;
  text: string;
  aya: number | null;
  hidden: boolean;
}

let indexPromise: Promise<Record<string, number>> | null = null;
const pageCache = new Map<number, AnnotatedWord[]>();

/** page -> word count, for every page that ships an annotation file. */
export function loadAnnotationIndex(): Promise<Record<string, number>> {
  if (!indexPromise) {
    indexPromise = fetch("/annotations/index.json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return indexPromise;
}

/** Words of one page, in reading order (empty when the page has no file). */
export async function loadPageAnnotations(page: number): Promise<AnnotatedWord[]> {
  const cached = pageCache.get(page);
  if (cached) return cached;
  try {
    const res = await fetch(`/annotations/${page}.json`);
    const words: AnnotatedWord[] = res.ok ? await res.json() : [];
    pageCache.set(page, words);
    return words;
  } catch {
    return [];
  }
}

/**
 * Convert pixel boxes from the workbook into the normalised 0..1 form the
 * question stores, using the rendered image's natural size.
 */
export function normaliseWords(
  words: AnnotatedWord[],
  naturalWidth: number,
  naturalHeight: number
): { regions: PageRegion[]; texts: string[] } {
  if (!naturalWidth || !naturalHeight) return { regions: [], texts: [] };
  const regions: PageRegion[] = [];
  const texts: string[] = [];
  for (const w of words) {
    regions.push({
      x1: clamp01(w.x1 / naturalWidth),
      y1: clamp01(w.y1 / naturalHeight),
      x2: clamp01(w.x2 / naturalWidth),
      y2: clamp01(w.y2 / naturalHeight),
    });
    texts.push(w.text);
  }
  return { regions, texts };
}

/**
 * Remove harakat, quranic annotation marks and tatweel, keeping the letters.
 * Words are authored plain, but questions saved before that change still hold
 * vocalised text — stripping at render keeps every chip consistent.
 */
export function stripTashkeel(value: string): string {
  return value
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, "")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compare Arabic words the way a learner types them: ignore diacritics,
 * tatweel and the alef/ya/ta-marbuta spelling variants, so a correct answer
 * typed without harakat still counts.
 */
export function normaliseArabic(value: string): string {
  return value
    .trim()
    .replace(/[ً-ْٰۖ-ۭ]/g, "") // harakat + quranic marks
    .replace(/ـ/g, "") // tatweel
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ -> ا
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** CSS box for a region, as percentages of the image element. */
export function regionStyle(region: PageRegion) {
  return {
    left: `${region.x1 * 100}%`,
    top: `${region.y1 * 100}%`,
    width: `${(region.x2 - region.x1) * 100}%`,
    height: `${(region.y2 - region.y1) * 100}%`,
  };
}
