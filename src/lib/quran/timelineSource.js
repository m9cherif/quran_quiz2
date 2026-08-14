import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assemble, buildTimelines } from "./importTimelines.mjs";

/**
 * The timelines as the data repo has them *now* — server side.
 *
 * The committed copies under public/timeline are a floor, not the truth: they
 * are whatever the data repo said the last time someone built the site. Editing
 * a timeline upstream does not build anything here, so without this the change
 * would sit unused until the next deploy — which is exactly the surprise it is
 * worth spending a network call to remove.
 *
 * The result is held for a few minutes, so a busy page costs the data repo one
 * request rather than one per visitor, and a failure falls back to the files on
 * disk rather than leaving the practice page empty.
 */
const TTL_MS = 3 * 60 * 1000;
const PUBLIC = join(process.cwd(), "public");

let cache = { at: 0, index: null, pages: null };
let inflight = null;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function annotationIds(page) {
  const raw = readJson(join(PUBLIC, "annotations", `${page}.json`));
  if (!raw) return [];
  const words = Array.isArray(raw) ? raw : (raw.words ?? []);
  return words.map((w) => w.id).filter((id) => Number.isFinite(id));
}

/** What is on disk, used when the data repo cannot be reached. */
function fromDisk() {
  const index = readJson(join(PUBLIC, "timeline", "index.json")) ?? {};
  const pages = {};
  for (const page of Object.keys(index)) {
    const file = readJson(join(PUBLIC, "timeline", `${page}.json`));
    if (file) pages[page] = file;
  }
  return { index, pages, stale: true };
}

async function build() {
  const { pages: built } = await buildTimelines({
    annotationIds,
    // Next keeps each upstream response this long; the memo above keeps the
    // assembled result, so the two together bound the traffic either way.
    fetchOptions: { next: { revalidate: 120 } },
    // A token lifts the listing quota from sixty an hour to five thousand;
    // without one the names from the last build are used, and the contents are
    // still read fresh.
    token: process.env.GITHUB_TOKEN,
    known: readJson(join(PUBLIC, "timeline", "sources.json")) ?? [],
    log: (line) => console.log("[timelines]", line),
  });

  const index = {};
  const pages = {};
  for (const [page, parts] of built) {
    // A stretch timed in this repo, in a recording the data repo never mentions,
    // is merged back in — page 554's second half exists nowhere upstream.
    const committed = readJson(join(PUBLIC, "timeline", `${page}.json`));
    if (committed) {
      const fresh = new Set(parts.map((p) => p.audio));
      for (const part of (committed.parts ?? [committed]).filter(
        (p) => p.audio && !fresh.has(p.audio)
      )) {
        parts.push(part);
      }
    }
    pages[page] = assemble(page, parts);
    index[page] = {
      audio: parts[0].audio,
      words: parts.reduce((total, p) => total + p.events.length, 0),
      duration: parts[0].duration,
    };
  }
  return { index, pages, stale: false };
}

export async function getTimelines() {
  const now = Date.now();
  if (cache.index && now - cache.at < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = build()
    .then((fresh) => {
      cache = { ...fresh, at: now };
      return cache;
    })
    .catch((error) => {
      console.warn("[timelines] the data repo could not be read:", error.message);
      // Serve what is committed, and try again on the next request rather than
      // holding a failure for the full window.
      return { ...fromDisk(), at: 0 };
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
