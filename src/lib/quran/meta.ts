/**
 * Where a passage sits in the Quran: its surah, its ayah, its hizb.
 *
 * The annotations give every word an ayah number but never a surah, so the
 * surah is recovered from the numbering itself: ayah numbers only ever go up
 * within a surah, so the point where one drops back is the point where the next
 * surah begins. Walking a page that way places every word exactly, including
 * the short pages near the end where three surahs share one sheet.
 */
export interface QuranMeta {
  surahs: { n: number; name: string; page: number; ayas: number }[];
  quarters: { hizb: number; quarter: number; page: number }[];
}

let metaPromise: Promise<QuranMeta | null> | null = null;

export function loadQuranMeta(): Promise<QuranMeta | null> {
  if (!metaPromise) {
    metaPromise = fetch("/quran/meta.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return metaPromise;
}

export interface PlacedWord {
  id: number;
  aya: number;
  surah: number;
  surahName: string;
}

/**
 * Assign a surah to every word of a page.
 *
 * The surah in progress at the top of the page is the last one to have started
 * at or before it; each drop in the ayah numbering moves to the next.
 */
export function placeWords(
  page: number,
  words: { id: number | null; aya?: number | null }[],
  meta: QuranMeta
): Map<number, PlacedWord> {
  const placed = new Map<number, PlacedWord>();
  const numbered = words.filter((w) => w.id != null && w.aya != null);
  const opensASurah = numbered[0]?.aya === 1;

  // Which surah the page opens with. Several may start on it, and the sheet may
  // also carry the tail of the one before: the page's first ayah number settles
  // it — 1 means the page opens on the earliest surah that starts here, and
  // anything else means it opens on the tail of the previous one.
  const startingHere = meta.surahs.findIndex((s) => s.page === page);
  let index: number;
  if (opensASurah && startingHere >= 0) {
    index = startingHere;
  } else {
    index = Math.max(0, meta.surahs.filter((s) => s.page < page).length - 1);
  }

  let previousAya: number | null = null;
  for (const word of words) {
    if (word.id == null || word.aya == null) continue;
    if (previousAya != null && word.aya < previousAya && index + 1 < meta.surahs.length) {
      index += 1;
    }
    previousAya = word.aya;
    const surah = meta.surahs[index];
    if (!surah) continue;
    placed.set(word.id, {
      id: word.id,
      aya: word.aya,
      surah: surah.n,
      surahName: surah.name,
    });
  }
  return placed;
}

export interface HizbAt {
  hizb: number;
  quarter: number;
  /** True when a new quarter opens on this page, so the page spans two. */
  boundary: boolean;
}

/**
 * The hizb quarter a page belongs to.
 *
 * The table records only the page each quarter opens on, so a page where one
 * opens genuinely belongs to both; that is reported rather than guessed at.
 */
export function hizbOfPage(page: number, meta: QuranMeta): HizbAt | null {
  let current: QuranMeta["quarters"][number] | null = null;
  for (const q of meta.quarters) {
    if (q.page <= page) current = q;
    else break;
  }
  if (!current) return null;
  return {
    hizb: current.hizb,
    quarter: current.quarter,
    boundary: meta.quarters.some((q) => q.page === page),
  };
}
