#!/usr/bin/env node
/**
 * Installs a timeline authored in the builder (/host/timeline) and keeps
 * public/timeline/index.json in step.
 *
 * The builder writes annotation ids directly, so nothing is translated here —
 * unlike fetch-timelines.mjs, which converts the upstream files' word ordinals.
 * What this does is check: every event must name a word that actually exists on
 * that page, and the marks must run forwards. A timeline that fails those is
 * worse than no timeline, because every drill downstream trusts it silently.
 *
 * Run: node scripts/import-timeline.mjs ~/Downloads/553.json
 *      node scripts/import-timeline.mjs ~/Downloads/553.json --force
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "timeline");
const ANNOTATION_DIR = join(process.cwd(), "public", "annotations");

const args = process.argv.slice(2);
const force = args.includes("--force");
const source = args.find((a) => !a.startsWith("--"));

if (!source) {
  console.error("usage: node scripts/import-timeline.mjs <file.json> [--force]");
  process.exit(1);
}

const data = JSON.parse(readFileSync(resolve(source), "utf8"));
const page = Number(data.page);
if (!Number.isFinite(page)) throw new Error("the file has no page number");
if (!Array.isArray(data.events) || data.events.length === 0) throw new Error("no events");

const annotationFile = join(ANNOTATION_DIR, `${page}.json`);
if (!existsSync(annotationFile)) throw new Error(`no annotations for page ${page}`);
const raw = JSON.parse(readFileSync(annotationFile, "utf8"));
const words = Array.isArray(raw) ? raw : (raw.words ?? []);
const ids = new Set(words.map((w) => w.id));

const problems = [];
const unknown = data.events.filter((e) => !ids.has(e.w));
if (unknown.length) problems.push(`${unknown.length} event(s) name a word not on page ${page}`);
const backwards = data.events.filter((e, i) => i > 0 && e.t < data.events[i - 1].t);
if (backwards.length) problems.push(`${backwards.length} event(s) run backwards in time`);
const seen = new Set();
const repeats = data.events.filter((e) => (seen.has(e.w) ? true : (seen.add(e.w), false)));
if (repeats.length) console.warn(`note: ${repeats.length} repeated word(s) — fine if the reciter repeats`);

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  if (!force) {
    console.error("refusing to install; pass --force if you know better");
    process.exit(1);
  }
}

const target = join(OUT_DIR, `${page}.json`);
if (existsSync(target)) {
  copyFileSync(target, `${target}.bak`);
  console.log(`kept the previous file as ${page}.json.bak`);
}

const out = {
  page,
  audio: data.audio ?? null,
  start: Math.max(0, Math.round(Number(data.start) || 0)),
  duration: Math.round(Number(data.duration) || 0),
  events: data.events
    .map((e) => ({ t: Math.max(0, Math.round(Number(e.t))), w: Number(e.w) }))
    .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.w))
    .sort((a, b) => a.t - b.t),
};
writeFileSync(target, JSON.stringify(out), "utf8");

const indexFile = join(OUT_DIR, "index.json");
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : {};
index[page] = { audio: out.audio, words: out.events.length, duration: out.duration };
writeFileSync(indexFile, JSON.stringify(index), "utf8");

console.log(
  `page ${page}: ${out.events.length}/${words.length} words marked, audio ${out.audio}, ` +
    `${(out.duration / 1000).toFixed(1)}s`
);
