#!/usr/bin/env node
/**
 * Pull the Quran data from the upstream repo before every build.
 *
 * The site does not read GitHub at runtime: the annotations, the timelines and
 * the surah/hizb tables are imported into public/ and served from there. That
 * is deliberate — it keeps page rendering off the network — but it means an
 * edit upstream changes nothing until someone re-imports. Deleting a file
 * upstream and seeing the site carry on unchanged is the same story.
 *
 * So the import runs at build time. Every deploy ships what the data repo says
 * today, and no one has to remember a step.
 *
 * Failure is not fatal. A network hiccup during a deploy should not take the
 * site down: what is already committed is a complete, working copy, and the
 * build carries on with it. Set SKIP_DATA_REFRESH=1 to work offline.
 *
 * Order matters — timelines are keyed by annotation ids, so the annotations
 * have to be current first.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const STEPS = [
  ["annotations", "fetch-annotations.mjs"],
  ["timelines", "fetch-timelines.mjs"],
  ["surah & hizb tables", "fetch-quran-meta.mjs"],
];

if (process.env.SKIP_DATA_REFRESH === "1") {
  console.log("[data] SKIP_DATA_REFRESH=1 — using the committed copies");
  process.exit(0);
}

let failed = 0;
for (const [label, script] of STEPS) {
  console.log(`[data] refreshing ${label} …`);
  const run = spawnSync(process.execPath, [join(HERE, script)], { stdio: "inherit" });
  if (run.status !== 0) {
    failed += 1;
    console.warn(`[data] could not refresh ${label} — keeping what is committed`);
  }
}

console.log(
  failed === 0
    ? "[data] up to date with the data repo"
    : `[data] ${failed} of ${STEPS.length} step(s) failed; the build continues with the committed data`
);
