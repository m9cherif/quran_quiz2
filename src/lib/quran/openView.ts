/**
 * "Mots cachés" on the real page, via open-quran-view — replacing the PNG
 * image (streamed live from a personal GitHub repo, which kept getting
 * renumbered from under the site) and the pixel-coordinate annotation files
 * (parsed from workbooks that were, at various points, empty, corrupted, or
 * simply absent for the page in question).
 *
 * The tradeoff worth knowing: the visual layout is real text now, not a
 * scanned page, so it is only as page-accurate as open-quran-view's own
 * hafs-v4 data. Word text, though, is not taken from that layout — hafs-v4's
 * `text` field is set to its glyph code (a Private Use Area character,
 * unreadable outside that exact font), which is real but useless as a chip
 * label or something a student could type. It is looked up here instead from
 * hafs-unicode's data, keyed by surah/verse/position rather than by id,
 * because that is the address both layouts agree on.
 */

export const MUSHAF_LAYOUT = "hafs-v4";
export const MUSHAF_PAGE_COUNT = 604;

/** One word, addressed the way open-quran-view addresses it. */
export interface WordLocation {
  surah: number;
  verse: number;
  position: number;
}

export interface PageWord extends WordLocation {
  text: string;
}

export function wordKey(loc: WordLocation): string {
  return `${loc.surah}:${loc.verse}:${loc.position}`;
}

const pageCache = new Map<number, Promise<PageWord[]>>();

/** Every word of a page, in reading order, with its real (unicode) text. */
export function loadPageWords(page: number): Promise<PageWord[]> {
  let cached = pageCache.get(page);
  if (!cached) {
    cached = fetch(`/quran-view/words/${page}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    pageCache.set(page, cached);
  }
  return cached;
}

/** `{ "surah:verse:position": text }`, for resolving a click without a re-fetch per word. */
export async function loadWordIndex(page: number): Promise<Map<string, string>> {
  const words = await loadPageWords(page);
  return new Map(words.map((w) => [wordKey(w), w.text]));
}

/**
 * A colour reserved for `locateWords` below — chosen only so it can be told
 * apart from a highlight the page would ever carry on its own (tajweed tints
 * the letters, not the background, and the two built-in highlight props stay
 * away from this exact triplet). Passed to `wordHighlightColor` verbatim, in
 * the same "rgb(r, g, b)" form `getComputedStyle` normalises to, so the
 * lookup below is a plain string match rather than a colour parser.
 */
export const LOCATE_MARKER_COLOR = "rgb(1, 2, 3)";

/**
 * Where a set of words actually rendered, read off the DOM rather than
 * computed — open-quran-view's own coordinate system is internal and
 * undocumented, but marking words with `wordHighlightColor` and reading back
 * which elements got it is not. Call after the page (and the marker
 * highlight) has painted; returns boxes relative to `container`, in page
 * reading order — top to bottom, right to left within a line — which is
 * generally NOT the order the words were given in, since that reflects
 * whatever order they were clicked or stored in.
 */
export function locateWords(container: HTMLElement): DOMRect[] {
  const containerBox = container.getBoundingClientRect();
  const marked = Array.from(container.querySelectorAll<HTMLElement>("span")).filter(
    (el) => getComputedStyle(el).backgroundColor === LOCATE_MARKER_COLOR
  );
  const relative = marked.map((el) => {
    const r = el.getBoundingClientRect();
    return new DOMRect(r.left - containerBox.left, r.top - containerBox.top, r.width, r.height);
  });
  const lineTolerance = 4;
  relative.sort((a, b) =>
    Math.abs(a.y - b.y) < lineTolerance ? b.x - a.x : a.y - b.y
  );
  return relative;
}
