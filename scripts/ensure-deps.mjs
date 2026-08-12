#!/usr/bin/env node
/**
 * Install dependencies when the tree does not match package-lock.json.
 *
 * Render's build command for this service is just `npm run build`, and the
 * platform restores a node_modules cache before running it — so when the lock
 * file changes, the build silently compiles against the *previous* dependency
 * tree (that is how a Next 16 commit got built with the cached Next 15 and a
 * missing `qrcode`). npm runs this automatically via the `prebuild` script.
 *
 * A stamp holding the hash of package-lock.json is written into node_modules
 * after a successful install: when the cache is stale (or absent) the hash
 * differs and we reinstall; otherwise this is a no-op costing a few ms, so
 * local builds are unaffected.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lockPath = join(root, "package-lock.json");
const stampPath = join(root, "node_modules", ".deps-stamp");

if (!existsSync(lockPath)) {
  console.log("[deps] no package-lock.json — skipping dependency check");
  process.exit(0);
}

const lockHash = createHash("sha256").update(readFileSync(lockPath)).digest("hex");
const currentStamp = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : null;

if (currentStamp === lockHash) {
  console.log("[deps] dependencies match package-lock.json");
  process.exit(0);
}

console.log(
  currentStamp === null
    ? "[deps] no install stamp found — installing dependencies"
    : "[deps] package-lock.json changed since the last install — reinstalling"
);

const args = ["ci", "--no-audit", "--no-fund"];
const npmCli = process.env.npm_execpath;

if (npmCli && npmCli.endsWith(".js")) {
  // Running as an npm script (Render, `npm run build`): call npm's own CLI with
  // the current node binary — no shell, so nothing to escape.
  execFileSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: "inherit" });
} else {
  // Direct `node scripts/ensure-deps.mjs`: Node refuses to spawn .cmd shims
  // without a shell on Windows (EINVAL).
  const isWindows = process.platform === "win32";
  execFileSync(isWindows ? "npm.cmd" : "npm", args, {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  });
}
writeFileSync(stampPath, lockHash, "utf8");
console.log("[deps] dependencies installed");
