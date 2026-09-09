#!/usr/bin/env node
/**
 * Imports the list of page images actually published in
 * github.com/m9cherif/flutter_quran_data/png.
 *
 * The images themselves stay on GitHub — pageImageUrl() builds a
 * raw.githubusercontent.com URL straight to them, nothing here downloads a
 * single PNG — but which page numbers exist has to be known before a picker
 * can offer them, and hardcoding that range is exactly what broke: the
 * folder was renumbered upstream and every page a picker offered from the
 * old range pointed at an image that no longer exists. Importing the
 * listing at build time, the same way the annotations already are, means a
 * renumbering upstream is a bad exercise choice at worst, not a broken image
 * everywhere the app shows a page.
 *
 * Run: node scripts/fetch-pages.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.github.com/repos/m9cherif/flutter_quran_data/contents/png";
const OUT_DIR = join(process.cwd(), "public", "quran");

const listing = await (await fetch(API, { headers: { "User-Agent": "quran-quiz" } })).json();
if (!Array.isArray(listing)) throw new Error("unexpected listing: " + JSON.stringify(listing).slice(0, 200));

const pages = listing
  .map((f) => /^page(\d+)\.png$/i.exec(f.name || ""))
  .filter(Boolean)
  .map((m) => Number(m[1]))
  .sort((a, b) => a - b);

if (pages.length === 0) throw new Error("no page images found in the listing");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "pages.json"), JSON.stringify({ pages }), "utf8");
console.log(`${pages.length} page image(s), ${pages[0]} … ${pages[pages.length - 1]}`);
