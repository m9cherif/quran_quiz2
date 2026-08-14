#!/usr/bin/env node
/**
 * Imports the recitation timelines published in flutter_quran_data/timeline.
 *
 * The parsing itself lives in src/lib/quran/importTimelines.mjs, shared with the
 * API route that serves the same folder while the site is running — the two have
 * to agree about what an upstream file means.
 *
 * What this adds is the copy on disk: something complete to serve when GitHub is
 * unreachable, kept in step with the data repo including its deletions. The mp3s
 * are 4-6 MB each and are never copied; they stream from raw GitHub at playback.
 *
 * Run: node scripts/fetch-timelines.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assemble, buildTimelines } from "../src/lib/quran/importTimelines.mjs";

const OUT_DIR = join(process.cwd(), "public", "timeline");
const ANNOTATION_DIR = join(process.cwd(), "public", "annotations");

function annotationIds(page) {
  try {
    const raw = JSON.parse(readFileSync(join(ANNOTATION_DIR, `${page}.json`), "utf8"));
    const words = Array.isArray(raw) ? raw : (raw.words ?? []);
    return words.map((w) => w.id).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const known = (() => {
  try {
    return JSON.parse(readFileSync(join(OUT_DIR, "sources.json"), "utf8"));
  } catch {
    return [];
  }
})();

const { pages, names } = await buildTimelines({
  annotationIds,
  token: process.env.GITHUB_TOKEN,
  known,
  log: (line) => console.log(line),
});

// The names are remembered for the running site: listing a folder needs the
// GitHub API, whose anonymous quota a shared hosting IP rarely has to spare.
writeFileSync(join(OUT_DIR, "sources.json"), JSON.stringify(names), "utf8");

const index = {};
for (const [page, parts] of [...pages].sort((a, b) => a[0] - b[0])) {
  // A part timed here, in a recording no upstream file mentions, is kept: page
  // 554's second half was built locally and re-importing must not drop it.
  const target = join(OUT_DIR, `${page}.json`);
  const fresh = new Set(parts.map((p) => p.audio));
  if (existsSync(target)) {
    const previous = JSON.parse(readFileSync(target, "utf8"));
    for (const part of (previous.parts ?? [previous]).filter((p) => p.audio && !fresh.has(p.audio))) {
      console.log(`page ${page}: keeping ${part.events.length} words timed here in ${part.audio}`);
      parts.push(part);
    }
  }

  writeFileSync(target, JSON.stringify(assemble(page, parts)), "utf8");
  const words = parts.reduce((total, p) => total + p.events.length, 0);
  index[page] = { audio: parts[0].audio, words, duration: parts[0].duration };
  console.log(
    `page ${page}: ${words} words over ${parts.length} recording(s) — ${parts.map((p) => p.audio).join(", ")}`
  );
}

// A page the data repo no longer covers should stop existing here too —
// otherwise deleting a file upstream changes nothing, which is the surprise this
// import exists to remove. A page holding work timed here and found in no
// upstream file is left alone and reported: that work would be gone for good.
for (const name of readdirSync(OUT_DIR)) {
  const match = /^(\d{1,3})\.json$/.exec(name);
  if (!match) continue;
  const page = Number(match[1]);
  if (pages.has(page)) continue;
  const previous = JSON.parse(readFileSync(join(OUT_DIR, name), "utf8"));
  if (previous.parts?.length > 1) {
    console.warn(`page ${page}: gone from the data repo, but it holds work timed here — kept`);
    index[page] = {
      audio: previous.audio,
      words: previous.parts.reduce((total, part) => total + part.events.length, 0),
      duration: previous.duration,
    };
  } else {
    rmSync(join(OUT_DIR, name));
    console.log(`page ${page}: removed — no longer in the data repo`);
  }
}

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index), "utf8");
console.log(`pages with a recitation: ${Object.keys(index).length}`);
