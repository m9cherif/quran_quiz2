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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const index = {};

for (const file of listing) {
  const match = /^page(\d{1,3})\.json$/i.exec(file.name || "");
  if (!match) continue;
  const page = Number(match[1]);

  const raw = await (await fetch(file.download_url)).json();
  const ids = annotationIds(page);
  const events = (raw.events ?? [])
    .filter((e) => e && e.action === "show" && Number.isFinite(Number(e.time)))
    .map((e) => ({
      t: Math.max(0, Math.round(Number(e.time))),
      // ordinal -> annotation id
      w: ids[Number(e.word_id) - 1],
    }))
    .filter((e) => Number.isFinite(e.w))
    .sort((a, b) => a.t - b.t);

  if (events.length === 0) continue;

  const dropped = (raw.events ?? []).length - events.length;
  if (dropped > 0) console.warn(`page ${page}: ${dropped} events outside the annotated words`);

  // "C:/trav_quran2/audio/trabelsi/062.mp3" -> "062.mp3": only the file name is
  // portable, the rest is the author's machine.
  const audio = String(raw.audio_file ?? "").split(/[\\/]/).pop() || null;

  const out = {
    page,
    audio,
    start: Math.max(0, Math.round(Number(raw.audio_start_pos) || 0)),
    duration: Math.round(Number(raw.recording_duration) || 0),
    events,
  };

  writeFileSync(join(OUT_DIR, `${page}.json`), JSON.stringify(out), "utf8");
  index[page] = { audio, words: events.length, duration: out.duration };
  console.log(`page ${page}: ${events.length} events, audio ${audio}`);
}

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index), "utf8");
console.log(`pages with a recitation: ${Object.keys(index).length}`);
