/**
 * Quran page images.
 *
 * Source: github.com/m9cherif/flutter_quran_data (png/pageNNN.png). Only part
 * of the mushaf is published there today — pages 553…604 — so the picker is
 * limited to what actually exists instead of offering 1…604 and 404-ing.
 */

const RAW_BASE =
  "https://raw.githubusercontent.com/m9cherif/flutter_quran_data/main/png";

export const PAGE_FIRST = 553;
export const PAGE_LAST = 604;

/** Every page number that has an image, ascending. */
export const AVAILABLE_PAGES: number[] = Array.from(
  { length: PAGE_LAST - PAGE_FIRST + 1 },
  (_, i) => PAGE_FIRST + i
);

export function isPageAvailable(page: number | null | undefined): boolean {
  return typeof page === "number" && page >= PAGE_FIRST && page <= PAGE_LAST;
}

/** Absolute URL of a page image (empty string when the page has no image). */
export function pageImageUrl(page: number | null | undefined): string {
  return isPageAvailable(page) ? `${RAW_BASE}/page${page}.png` : "";
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

/** CSS box for a region, as percentages of the image element. */
export function regionStyle(region: PageRegion) {
  return {
    left: `${region.x1 * 100}%`,
    top: `${region.y1 * 100}%`,
    width: `${(region.x2 - region.x1) * 100}%`,
    height: `${(region.y2 - region.y1) * 100}%`,
  };
}
