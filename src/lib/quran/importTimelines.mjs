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
export async function buildTimelines({ annotationIds, fetchOptions = {}, log = () => {} }) {
  const listing = await (
    await fetch(API, { headers: { "User-Agent": "quran-quiz" }, ...fetchOptions })
  ).json();
  if (!Array.isArray(listing)) throw new Error("unexpected listing from the data repo");

  // A file per recording (062.json) covers every page that recording spans and
  // knows where the page boundaries fall, so it wins over the older file per
  // page (page553.json) for the pages it covers.
  const perRecording = listing.filter((f) => /^\d{1,3}\.json$/i.test(f.name || ""));
  const perPage = listing.filter((f) => /^page\d{1,3}\.json$/i.test(f.name || ""));

  const pages = new Map();
  const claimed = new Set();

  const add = (page, part) => {
    if (part.events.length === 0) return;
    if (part.dropped > 0) log(`  page ${page}: ${part.dropped} event(s) outside the annotated words`);
    delete part.dropped;
    pages.set(page, [...(pages.get(page) ?? []), part]);
  };

  for (const file of perRecording) {
    const raw = await (await fetch(file.download_url ?? `${RAW}/${file.name}`, fetchOptions)).json();
    const all = raw.events ?? [];
    const covered = [...new Set(all.map((e) => Number(e.page)).filter(Number.isFinite))];
    log(`${file.name}: ${all.length} events over page(s) ${covered.join(", ")}`);
    for (const page of covered) {
      const ids = annotationIds(page);
      if (!ids.length) continue;
      add(page, convertPart(all.filter((e) => Number(e.page) === page), raw, ids));
      claimed.add(page);
    }
  }

  for (const file of perPage) {
    const page = Number(/^page(\d{1,3})\.json$/i.exec(file.name)[1]);
    if (claimed.has(page)) {
      log(`${file.name}: skipped — that page comes from a per-recording file now`);
      continue;
    }
    const ids = annotationIds(page);
    if (!ids.length) continue;
    const raw = await (await fetch(file.download_url ?? `${RAW}/${file.name}`, fetchOptions)).json();
    add(page, convertPart(raw.events ?? [], raw, ids));
  }

  return pages;
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
