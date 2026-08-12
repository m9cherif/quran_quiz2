#!/usr/bin/env node
/**
 * One-shot importer: turns the annotation workbooks published in
 * github.com/m9cherif/flutter_quran_data/annotation into JSON the quiz editor
 * can read directly.
 *
 * Each workbook holds a "Mots" sheet with one row per word: pixel box
 * (x1,y1,x2,y2) on the matching page image, the word itself (kalima_text) and
 * optional aya_no / hidden markers — the same contract exercices.py relied on.
 *
 * Coordinates stay in the workbook's pixel space here; the editor normalises
 * them against the loaded image's naturalWidth/naturalHeight, so no page PNG
 * has to be downloaded at build time.
 *
 * Run: node scripts/fetch-annotations.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

const API = "https://api.github.com/repos/m9cherif/flutter_quran_data/contents/annotation";
// Served as static files (fetched on demand by the editor), never bundled.
const OUT_DIR = join(process.cwd(), "public", "annotations");

/** Remove harakat, quranic annotation marks and tatweel; keep the letters. */
function stripTashkeel(value) {
  return value
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, "")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


const listing = await (await fetch(API, { headers: { "User-Agent": "quran-quiz" } })).json();
if (!Array.isArray(listing)) throw new Error("unexpected listing: " + JSON.stringify(listing).slice(0, 200));

mkdirSync(OUT_DIR, { recursive: true });

const pages = [];
const skipped = [];
const columnsSeen = new Set();

for (const file of listing) {
  const match = /^a?(\d{1,3})\.xlsx$/i.exec(file.name || "");
  if (!match) continue;
  const page = Number(match[1]);

  const buf = Buffer.from(await (await fetch(file.download_url)).arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames.includes("Mots") ? "Mots" : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

  const words = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) columnsSeen.add(k);
    const x1 = Number(row.x1);
    const y1 = Number(row.y1);
    const x2 = Number(row.x2);
    const y2 = Number(row.y2);
    if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) continue;
    // Words are shown to students without tashkeel: prefer the workbook's
    // plain-spelling column, and strip the marks from the vocalised one when
    // that column is missing or empty.
    const text =
      stripTashkeel(String(row.kalima_text_emlaey ?? "")) ||
      stripTashkeel(String(row.kalima_text ?? row.text ?? ""));
    if (!text) continue;
    words.push({
      x1, y1, x2, y2,
      // The recitation timelines reference this id, so it has to survive the
      // import or audio cannot be lined up with the boxes.
      id: Number.isFinite(Number(row.id)) ? Number(row.id) : null,
      text,
      aya: Number.isFinite(Number(row.aya_no)) ? Number(row.aya_no) : null,
      hidden: row.hidden === true || row.hidden === 1 || row.hidden === "1",
    });
  }

  if (words.length === 0) {
    skipped.push(`${file.name} (no usable rows in "${sheetName}")`);
    continue;
  }

  // Reading order: top line first, right-to-left within a line.
  const lineTol = Math.max(...words.map((w) => w.y2 - w.y1)) * 0.5;
  words.sort((a, b) => (Math.abs(a.y1 - b.y1) < lineTol ? b.x2 - a.x2 : a.y1 - b.y1));

  const existing = pages.find((p) => p.page === page);
  if (existing) {
    // Prefer the richer file when both "NNN.xlsx" and "aNNN.xlsx" exist.
    if (words.length <= existing.count) {
      skipped.push(`${file.name} (page ${page} already covered by a richer file)`);
      continue;
    }
  }

  writeFileSync(join(OUT_DIR, `${page}.json`), JSON.stringify(words), "utf8");
  if (existing) existing.count = words.length;
  else pages.push({ page, count: words.length });
}

pages.sort((a, b) => a.page - b.page);
writeFileSync(
  join(OUT_DIR, "index.json"),
  JSON.stringify(Object.fromEntries(pages.map((p) => [p.page, p.count]))),
  "utf8"
);

console.log(`pages written: ${pages.length}`);
console.log(`page range: ${pages[0]?.page} … ${pages[pages.length - 1]?.page}`);
console.log(`words total: ${pages.reduce((n, p) => n + p.count, 0)}`);
console.log(`columns seen: ${[...columnsSeen].join(", ")}`);
if (skipped.length) console.log(`skipped:\n  ${skipped.join("\n  ")}`);
