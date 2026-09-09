#!/usr/bin/env node
/**
 * Per-page word text, for "mots cachés" chip labels and typed-answer
 * matching — read straight out of the open-quran-view package already in
 * node_modules, not fetched over the network.
 *
 * Why hafs-unicode's data specifically: hafs-v4 (the layout the page is
 * rendered in) ships every word's `text` equal to its glyph code
 * (`code_v2`) — a Private Use Area character with no meaning outside that
 * font, useless as a chip label or something a student could type. The
 * unicode layout's words carry the real spelling, and cover the same 604
 * pages with the same surah/verse/position addressing, so a lookup by
 * those three numbers gives the right word for whichever layout is on
 * screen.
 *
 * Run: node scripts/fetch-quran-view-words.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(
  HERE,
  "..",
  "node_modules",
  "open-quran-view",
  "dist",
  "data",
  "pages",
  "hafs-unicode",
  "pages.json"
);
const OUT_DIR = join(HERE, "..", "public", "quran-view", "words");

const pages = JSON.parse(readFileSync(SOURCE, "utf8"));
mkdirSync(OUT_DIR, { recursive: true });

let totalWords = 0;
for (const page of pages) {
  const words = page.lines.flatMap((line) =>
    line.words
      .filter((w) => w.charType === "word" && w.text)
      .map((w) => ({ surah: w.surah, verse: w.verse, position: w.position, text: w.text }))
  );
  writeFileSync(join(OUT_DIR, `${page.pageNumber}.json`), JSON.stringify(words), "utf8");
  totalWords += words.length;
}

console.log(`${pages.length} pages, ${totalWords} words`);
