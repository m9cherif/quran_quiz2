#!/usr/bin/env node
/**
 * Cutover step 1: export every table this app still cares about from the
 * live Supabase Postgres database to JSON files, for import-mysql.mjs to
 * read.
 *
 * Deliberately NOT exported (regenerated fresh instead — see import-mysql.mjs):
 * admin_keys (a fresh key should be issued post-cutover), phone_verifications
 * and email_verifications (ephemeral, always expired by the time this runs),
 * sessions (Supabase sessions mean nothing to the new backend — everyone signs
 * back in through the same phone/email flow they already use; see the plan's
 * "Everyone gets signed out once" note).
 *
 * auth.users and public.profiles are merged into one `users` export here,
 * mirroring the schema simplification in src/lib/db/schema.ts. A profile-less
 * auth.users row (an abandoned/incomplete signup — normal in an app with a
 * two-step phone/email flow) is skipped, not guessed at, and listed in
 * skipped_users_without_profile.json for a human to review before cutover.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:[password]@[host]:5432/postgres" \
 *     node scripts/migrate/export-supabase.mjs
 *
 * SUPABASE_DB_URL is the project's direct (or pooler) Postgres connection
 * string — Supabase dashboard → Project Settings → Database → Connection
 * string. Requires network access to Supabase's Postgres from wherever this
 * runs (this sandbox's egress is restricted and cannot reach it — run this
 * from an environment that can, e.g. the user's own machine or a session
 * with unrestricted network).
 */
import { Client } from "pg";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const outDir = join(root, "scripts", "migrate", "data");

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("[export] SUPABASE_DB_URL is not set — see the usage comment at the top of this file.");
  process.exit(1);
}

const TABLES = [
  "classes",
  "class_members",
  "competitions",
  "questions",
  "choices",
  "participants",
  "answers",
  "series_attempts",
  "series_answers",
];

async function main() {
  mkdirSync(outDir, { recursive: true });
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log("[export] connected");

  try {
    // users: merge auth.users + public.profiles, same shape src/lib/db/schema.ts's
    // `users` table expects (camelCase keys added by import-mysql.mjs later — this
    // stays snake_case/raw here, matching every other table's export).
    const usersRes = await client.query(`
      select u.id, u.email, u.phone, p.name, p.role, p.avatar_url,
             u.created_at, coalesce(p.updated_at, u.created_at) as updated_at
      from auth.users u
      join public.profiles p on p.id = u.id
      order by u.created_at
    `);
    writeFileSync(join(outDir, "users.json"), JSON.stringify(usersRes.rows, null, 2));
    console.log(`[export] users: ${usersRes.rowCount} rows`);

    const skippedRes = await client.query(`
      select u.id, u.email, u.phone, u.created_at
      from auth.users u
      left join public.profiles p on p.id = u.id
      where p.id is null
      order by u.created_at
    `);
    writeFileSync(
      join(outDir, "skipped_users_without_profile.json"),
      JSON.stringify(skippedRes.rows, null, 2)
    );
    if (skippedRes.rowCount > 0) {
      console.log(
        `[export] WARNING: ${skippedRes.rowCount} auth user(s) have no profile row and were skipped — see skipped_users_without_profile.json. Anything owned by these ids (there shouldn't be any, since every owning table's FK requires a profile) will not migrate.`
      );
    }

    for (const table of TABLES) {
      // No ORDER BY: not every table has a created_at column, and row order
      // within a table doesn't matter for correctness — only the FK-safe
      // table-by-table import order (handled in import-mysql.mjs) does.
      const res = await client.query(`select * from public.${table}`);
      writeFileSync(join(outDir, `${table}.json`), JSON.stringify(res.rows, null, 2));
      console.log(`[export] ${table}: ${res.rowCount} rows`);
    }

    console.log(`[export] done — wrote JSON to ${outDir}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[export] failed:", err);
  process.exit(1);
});
