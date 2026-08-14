/**
 * Reading the upstream recitation timelines — the one copy of that knowledge.
 *
 * Two consumers share it: the build-time importer, which writes public/timeline
 * so the site has something to serve when GitHub is unreachable, and the API
 * route, which reads the same folder while the site is running so an edit
 * upstream shows up without a deploy. They must agree about what a file means,
 * which is why the parsing lives here and not in either of them.
 */
const REPO = "m9cherif/flutter_quran_data";
const API = `https://api.github.com/repos/${REPO}/contents/timeline`;
const RAW = `https://raw.githubusercontent.com/${REPO}/main/timeline`;

/**
 * Which numbering a file uses for its words — and it is asked, never assumed.
 *
 * The older upstream files count a word's rank on its page, 1..n. The newer
 * ones use the annotation id, which also numbers the ayah marks and therefore
 * skips values and runs past n. Guessing wrong is silent: the highlight shifts
 * by a word, or the end of the page stops existing.
 */
export function toAnnotationId(numbers, ids) {
  const idSet = new Set(ids);
  const looksLikeIds = numbers.every((n) => idSet.has(n));
  const looksLikeOrdinals = numbers.every((n) => n >= 1 && n <= ids.length);
  return looksLikeIds && !looksLikeOrdinals ? (n) => n : (n) => ids[n - 1];
}

/** One stretch of recording: what the app calls a part. */
export function convertPart(rawEvents, raw, ids) {
  const shown = rawEvents.filter(
    (e) => e && e.action === "show" && Number.isFinite(Number(e.time))
  );
  const toId = toAnnotationId(shown.map((e) => Number(e.word_id)), ids);
  const events = shown
    .map((e) => ({ t: Math.max(0, Math.round(Number(e.time))), w: toId(Number(e.word_id)) }))
    .filter((e) => Number.isFinite(e.w))
    .sort((a, b) => a.t - b.t);

  return {
    // "G:/trav_quran2/audio/trabelsi/062.mp3" -> "062.mp3": only the file name
    // is portable, the rest is the author's machine.
    audio: String(raw.audio_file ?? "").split(/[\\/]/).pop() || null,
    start: Math.max(0, Math.round(Number(raw.audio_start_pos) || 0)),
    duration: Math.round(Number(raw.recording_duration) || 0),
    events,
    dropped: shown.length - events.length,
  };
}

/**
 * Every page the data repo covers, keyed by page number.
 *
 * `annotationIds(page)` must return that page's word ids in reading order.
 * `fetchOptions` is passed to every request — the API route uses it to say how
 * long a response may be reused.
 */
/**
 * The names of the files in the timeline folder.
 *
 * Listing a folder means the GitHub API, which allows sixty calls an hour per
 * IP address without a token — and a shared hosting IP has usually spent them
 * on somebody else. So the listing is asked for, and when it is refused the
 * names remembered at build time are used instead. Only the *names* need that
 * fallback: the contents come from raw.githubusercontent, which is a CDN with
 * no such limit, so an edited file is still read fresh.
 *
 * The cost is that a brand-new file appears at the next build rather than
 * immediately. Edits and deletions to files we know about are live.
 */
export async function listTimelineFiles({ fetchOptions = {}, token, known = [], log = () => {} }) {
  try {
    const headers = { "User-Agent": "quran-quiz" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const listing = await (await fetch(API, { headers, ...fetchOptions })).json();
    if (Array.isArray(listing)) return listing.map((f) => f.name).filter(Boolean);
    log(`could not list the data repo (${listing?.message ?? "unexpected response"}) — using the names from the last build`);
  } catch (error) {
    log(`could not list the data repo (${error.message}) — using the names from the last build`);
  }
  return known;
}

export async function buildTimelines({
  annotationIds,
  fetchOptions = {},
  token,
  known = [],
  log = () => {},
}) {
  const names = await listTimelineFiles({ fetchOptions, token, known, log });
  if (names.length === 0) throw new Error("no timeline files to read");

  // A file per recording (062.json) covers every page that recording spans and
  // knows where the page boundaries fall, so it wins over the older file per
  // page (page553.json) for the pages it covers.
  const perRecording = names.filter((n) => /^\d{1,3}\.json$/i.test(n));
  const perPage = names.filter((n) => /^page\d{1,3}\.json$/i.test(n));

  const pages = new Map();
  const claimed = new Set();

  const add = (page, part) => {
    if (part.events.length === 0) return;
    if (part.dropped > 0) log(`  page ${page}: ${part.dropped} event(s) outside the annotated words`);
    delete part.dropped;
    pages.set(page, [...(pages.get(page) ?? []), part]);
  };

  for (const name of perRecording) {
    const raw = await readUpstream(name, fetchOptions);
    // A file we knew about that has since been deleted: 404, and it simply
    // stops contributing pages.
    if (!raw) {
      log(`${name}: gone from the data repo`);
      continue;
    }
    const all = raw.events ?? [];
    const covered = [...new Set(all.map((e) => Number(e.page)).filter(Number.isFinite))];
    log(`${name}: ${all.length} events over page(s) ${covered.join(", ")}`);
    for (const page of covered) {
      const ids = annotationIds(page);
      if (!ids.length) continue;
      add(page, convertPart(all.filter((e) => Number(e.page) === page), raw, ids));
      claimed.add(page);
    }
  }

  for (const name of perPage) {
    const page = Number(/^page(\d{1,3})\.json$/i.exec(name)[1]);
    if (claimed.has(page)) {
      log(`${name}: skipped — that page comes from a per-recording file now`);
      continue;
    }
    const ids = annotationIds(page);
    if (!ids.length) continue;
    const raw = await readUpstream(name, fetchOptions);
    if (!raw) {
      log(`${name}: gone from the data repo`);
      continue;
    }
    add(page, convertPart(raw.events ?? [], raw, ids));
  }

  return { pages, names };
}

/** One upstream file, or null when it is no longer there. */
async function readUpstream(name, fetchOptions) {
  const res = await fetch(`${RAW}/${name}`, fetchOptions);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

/** Assemble the file the app reads, oldest readers included. */
export function assemble(page, parts) {
  const first = parts[0];
  const out = {
    page,
    audio: first.audio,
    start: first.start,
    duration: first.duration,
    events: first.events,
  };
  if (parts.length > 1) out.parts = parts;
  return out;
}
