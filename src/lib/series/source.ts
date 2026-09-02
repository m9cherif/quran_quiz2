import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Series } from "./format";

/**
 * Series as the data repo has them now — server side only.
 *
 * Same arrangement as the timelines, and for the same reason: a teacher edits a
 * series in the data repo and it takes effect without anyone deploying this
 * site. The committed copies under public/series are the floor, served when
 * GitHub cannot be reached, so a lesson never disappears because a CDN had a
 * bad minute.
 *
 * Listing a folder costs a GitHub API call, whose anonymous quota a shared
 * hosting IP has usually spent on somebody else — so the *names* come from a
 * manifest committed at build time, and only the contents are read live.
 */
const RAW = "https://raw.githubusercontent.com/m9cherif/flutter_quran_data/main/series";
const API = "https://api.github.com/repos/m9cherif/flutter_quran_data/contents/series";
const TTL_MS = 3 * 60 * 1000;
const PUBLIC = join(process.cwd(), "public");

let cache: { at: number; series: Record<string, Series> } | null = null;
let inflight: Promise<Record<string, Series>> | null = null;

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function fromDisk(): Record<string, Series> {
  const names = readJson<string[]>(join(PUBLIC, "series", "index.json")) ?? [];
  const series: Record<string, Series> = {};
  for (const name of names) {
    const file = readJson<Series>(join(PUBLIC, "series", `${name}.json`));
    if (file?.id) series[file.id] = file;
  }
  return series;
}

async function listNames(known: string[]): Promise<string[]> {
  try {
    const headers: Record<string, string> = { "User-Agent": "quran-quiz" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const listing = await fetch(API, { headers, next: { revalidate: 120 } }).then((r) => r.json());
    if (Array.isArray(listing)) {
      return listing
        .map((f: { name?: string }) => f.name ?? "")
        .filter((n) => /^[\w-]+\.json$/.test(n) && n !== "index.json")
        .map((n) => n.replace(/\.json$/, ""));
    }
  } catch {
    // The listing is a convenience; the manifest below is the guarantee.
  }
  return known;
}

async function build(): Promise<Record<string, Series>> {
  const known = readJson<string[]>(join(PUBLIC, "series", "index.json")) ?? [];
  const names = await listNames(known);
  const series: Record<string, Series> = {};

  for (const name of names) {
    const response = await fetch(`${RAW}/${name}.json`, { next: { revalidate: 120 } });
    // A series deleted upstream simply stops existing here too.
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const file = (await response.json()) as Series;
    if (file?.id && Array.isArray(file.exercises)) series[file.id] = file;
  }

  if (Object.keys(series).length === 0) throw new Error("the data repo returned no series");
  return series;
}

export async function getSeries(): Promise<Record<string, Series>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.series;
  if (inflight) return inflight;

  inflight = build()
    .then((series) => {
      cache = { at: now, series };
      return series;
    })
    .catch((error) => {
      console.warn("[series] the data repo could not be read:", error.message);
      return fromDisk();
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** The words a page exercise blanks out, in reading order. */
export function wordsOnPage(page: number, ids: number[]): string[] {
  const raw = readJson<unknown>(join(PUBLIC, "annotations", `${page}.json`));
  const rows = (Array.isArray(raw) ? raw : (raw as { words?: unknown[] })?.words ?? []) as {
    id?: number;
    text?: string;
  }[];
  const byId = new Map(rows.filter((w) => w.id != null).map((w) => [w.id, w.text ?? ""]));
  return ids.map((id) => byId.get(id) ?? "");
}
