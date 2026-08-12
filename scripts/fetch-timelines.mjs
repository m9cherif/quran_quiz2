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
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.github.com/repos/m9cherif/flutter_quran_data/contents/timeline";
const OUT_DIR = join(process.cwd(), "public", "timeline");

const listing = await (await fetch(API, { headers: { "User-Agent": "quran-quiz" } })).json();
if (!Array.isArray(listing)) throw new Error("unexpected listing");

mkdirSync(OUT_DIR, { recursive: true });

const index = {};

for (const file of listing) {
  const match = /^page(\d{1,3})\.json$/i.exec(file.name || "");
  if (!match) continue;
  const page = Number(match[1]);

  const raw = await (await fetch(file.download_url)).json();
  const events = (raw.events ?? [])
    .filter((e) => e && e.action === "show" && Number.isFinite(Number(e.time)))
    .map((e) => ({ t: Math.max(0, Math.round(Number(e.time))), w: Number(e.word_id) }))
    .filter((e) => Number.isFinite(e.w))
    .sort((a, b) => a.t - b.t);

  if (events.length === 0) continue;

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
