#!/usr/bin/env node
/**
 * Imports the recitation timelines published in flutter_quran_data/timeline.
 *
 * Each file is a recording of one page: a list of {time, word_id} events
 * marking the millisecond each word is reached, plus which mp3 it belongs to.
 * That is exactly what is needed to highlight words in time with the audio.
 *
 * Timelines are small and are committed (public/timeline). The mp3s are 4-6 MB
 * each and are NOT: they stream from the raw GitHub URL at playback time.
 *
 * Run: node scripts/fetch-timelines.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.github.com/repos/m9cherif/flutter_quran_data/contents/timeline";
const OUT_DIR = join(process.cwd(), "public", "timeline");
const ANNOTATION_DIR = join(process.cwd(), "public", "annotations");

/**
 * Upstream word_id is the word's ORDINAL on the page (1, 2, 3 …), not the
 * annotation id. The two drift apart because annotation ids also number the
 * ayah-end marks, which are not recited: on page 553 six ids are skipped, so by
 * the end of the page the ordinal is six behind the id. Reading word_id as an
 * id highlights the wrong word for most of the page, and the last words of
 * every page have no match at all.
 *
 * Translating here, once, keeps every consumer honest: what ships is annotation
 * ids, which is what the page boxes are keyed by.
 */
function annotationIds(page) {
  try {
    const raw = JSON.parse(readFileSync(join(ANNOTATION_DIR, `${page}.json`), "utf8"));
    const words = Array.isArray(raw) ? raw : (raw.words ?? []);
    return words.map((w) => w.id).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

const listing = await (await fetch(API, { headers: { "User-Agent": "quran-quiz" } })).json();
if (!Array.isArray(listing)) throw new Error("unexpected listing");

mkdirSync(OUT_DIR, { recursive: true });

/**
 * Everything the upstream folder holds, newest naming first.
 *
 * There are two shapes there now. The older one is one file per page
 * (page553.json). The newer is one file per recording (062.json), which covers
 * every page that recording spans and says on each event which page it belongs
 * to — the honest shape, since a surah's recording runs across page breaks and
 * a page can need two recordings. A per-recording file wins over a per-page one
 * for the pages it covers: it is the later work, and it knows where the page
 * boundaries fall.
 */
const perRecording = [];
const perPage = [];
for (const file of listing) {
  if (/^\d{1,3}\.json$/i.test(file.name || "")) perRecording.push(file);
  else if (/^page\d{1,3}\.json$/i.test(file.name || "")) perPage.push(file);
}

/** page -> [{ audio, start, duration, events }] */
const collected = new Map();
const claimed = new Set();

function addPart(page, part) {
  if (part.events.length === 0) return;
  const parts = collected.get(page) ?? [];
  parts.push(part);
  collected.set(page, parts);
}

function convert(page, rawEvents, raw) {
  const ids = annotationIds(page);
  const idSet = new Set(ids);
  const shown = rawEvents.filter(
    (e) => e && e.action === "show" && Number.isFinite(Number(e.time))
  );
  const numbers = shown.map((e) => Number(e.word_id));

  /**
   * Upstream files number words two different ways, and guessing wrong is
   * silent: it shifts the highlight by a word or drops the end of the page.
   *
   * The older files count the word's rank on the page, 1..n. The newer ones use
   * the annotation id, which also numbers the ayah marks and so skips values
   * and runs past n. Both are readable from the numbers themselves — ids land
   * on the gaps' neighbours and exceed the word count, ordinals never do — so
   * the file is asked rather than assumed.
   */
  const looksLikeIds = numbers.every((n) => idSet.has(n));
  const looksLikeOrdinals = numbers.every((n) => n >= 1 && n <= ids.length);
  if (!looksLikeIds && !looksLikeOrdinals) {
    console.warn(`  page ${page}: word numbering matches neither ids nor ordinals`);
  }
  const toId = looksLikeIds && !looksLikeOrdinals ? (n) => n : (n) => ids[n - 1];

  const events = shown
    .map((e) => ({ t: Math.max(0, Math.round(Number(e.time))), w: toId(Number(e.word_id)) }))
    .filter((e) => Number.isFinite(e.w))
    .sort((a, b) => a.t - b.t);

  const dropped = shown.length - events.length;
  if (dropped > 0) console.warn(`  page ${page}: ${dropped} event(s) outside the annotated words`);

  return {
    // "G:/trav_quran2/audio/trabelsi/062.mp3" -> "062.mp3": only the file name
    // is portable, the rest is the author's machine.
    audio: String(raw.audio_file ?? "").split(/[\/]/).pop() || null,
    start: Math.max(0, Math.round(Number(raw.audio_start_pos) || 0)),
    duration: Math.round(Number(raw.recording_duration) || 0),
    events,
  };
}

for (const file of perRecording) {
  const raw = await (await fetch(file.download_url)).json();
  const all = raw.events ?? [];
  const pages = [...new Set(all.map((e) => Number(e.page)).filter(Number.isFinite))];
  console.log(`${file.name}: ${all.length} events over page(s) ${pages.join(", ")}`);
  for (const page of pages) {
    addPart(page, convert(page, all.filter((e) => Number(e.page) === page), raw));
    claimed.add(page);
  }
}

for (const file of perPage) {
  const page = Number(/^page(\d{1,3})\.json$/i.exec(file.name)[1]);
  if (claimed.has(page)) {
    console.log(`${file.name}: skipped — that page comes from a per-recording file now`);
    continue;
  }
  const raw = await (await fetch(file.download_url)).json();
  addPart(page, convert(page, raw.events ?? [], raw));
}

const index = {};
for (const [page, parts] of [...collected].sort((a, b) => a[0] - b[0])) {
  // A part of this page recorded in a file upstream does not know about is kept
  // — page 554's second half was timed here, and re-importing must not drop it.
  const target = join(OUT_DIR, `${page}.json`);
  const fresh = new Set(parts.map((p) => p.audio));
  if (existsSync(target)) {
    const previous = JSON.parse(readFileSync(target, "utf8"));
    const kept = (previous.parts ?? [previous]).filter((p) => p.audio && !fresh.has(p.audio));
    for (const part of kept) {
      console.log(`page ${page}: keeping ${part.events.length} words timed here in ${part.audio}`);
      parts.push(part);
    }
  }

  const first = parts[0];
  const out = { page, audio: first.audio, start: first.start, duration: first.duration, events: first.events };
  if (parts.length > 1) out.parts = parts;
  writeFileSync(target, JSON.stringify(out), "utf8");

  const words = parts.reduce((total, p) => total + p.events.length, 0);
  index[page] = { audio: first.audio, words, duration: first.duration };
  console.log(
    `page ${page}: ${words} words over ${parts.length} recording(s) — ${parts.map((p) => p.audio).join(", ")}`
  );
}

// A page the data repo no longer covers should stop existing here too —
// otherwise deleting a file upstream changes nothing, which is exactly the
// surprise this import is meant to remove. A page carrying a part that was
// timed here and lives in no upstream file is left alone and reported: that
// work would be gone for good.
for (const name of readdirSync(OUT_DIR)) {
  const match = /^(\d{1,3})\.json$/.exec(name);
  if (!match) continue;
  const page = Number(match[1]);
  if (collected.has(page)) continue;
  const file = join(OUT_DIR, name);
  const previous = JSON.parse(readFileSync(file, "utf8"));
  if (previous.parts?.length > 1) {
    console.warn(`page ${page}: gone from the data repo, but it holds work timed here — kept`);
    index[page] = {
      audio: previous.audio,
      words: previous.parts.reduce((total, part) => total + part.events.length, 0),
      duration: previous.duration,
    };
  } else {
    rmSync(file);
    console.log(`page ${page}: removed — no longer in the data repo`);
  }
}

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index), "utf8");
console.log(`pages with a recitation: ${Object.keys(index).length}`);
