#!/usr/bin/env node
/**
 * Imports the surah and hizb tables published in flutter_quran_data.
 *
 * Two small tables are enough to say where any passage sits: where each surah
 * begins (with its ayah count) and where each hizb quarter begins. The word
 * index upstream is 1.6 MB and does not line up with the annotation words
 * one-for-one, so it is deliberately not used — the annotations already carry
 * the ayah number of every word, and the surah follows from where the ayah
 * numbering restarts.
 *
 * Run: node scripts/fetch-quran-meta.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://raw.githubusercontent.com/m9cherif/flutter_quran_data/main";
const OUT_DIR = join(process.cwd(), "public", "quran");

const surahs = await (await fetch(`${BASE}/surah_index.json`)).json();
const quarters = await (await fetch(`${BASE}/hizb_quarters.json`)).json();

const out = {
  surahs: surahs
    .map((s) => ({
      n: Number(s.num_soura),
      name: String(s.soura ?? "").trim(),
      page: Number(s.num_page),
      ayas: Number(s.nbr_aya),
    }))
    .filter((s) => Number.isFinite(s.n) && Number.isFinite(s.page))
    .sort((a, b) => a.n - b.n),
  quarters: quarters
    .map((q) => ({ hizb: Number(q.hizb), quarter: Number(q.quarter), page: Number(q.page) }))
    .filter((q) => Number.isFinite(q.hizb) && Number.isFinite(q.page))
    .sort((a, b) => a.page - b.page || a.hizb - b.hizb || a.quarter - b.quarter),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "meta.json"), JSON.stringify(out), "utf8");
console.log(`${out.surahs.length} surahs, ${out.quarters.length} hizb quarters`);
