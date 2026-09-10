#!/usr/bin/env node
/**
 * Cutover step 2: read the JSON files export-supabase.mjs produced and load
 * them into the target MySQL database (Hostinger, or a local dev instance
 * for a dry run) in FK-safe order.
 *
 * Every insert is `ON DUPLICATE KEY UPDATE` on the primary key, so this
 * script is safe to re-run against the same target (a re-run just overwrites
 * each row with the freshly exported values) — useful for a dry run against
 * local MySQL before the real cutover, and for re-running the real cutover
 * if it's interrupted partway through.
 *
 * Column-for-column mapping notes (see src/lib/db/schema.ts for the target
 * shape, and the plan this session wrote for the full rationale):
 *   - uuid primary keys carry over unchanged (both sides are string ids —
 *     Postgres uuid, MySQL CHAR(36) — no regeneration needed).
 *   - timestamptz -> DATETIME(3), always written as UTC (this connection
 *     uses timezone:"Z", matching src/lib/db/client.ts).
 *   - jsonb -> JSON, serialized with JSON.stringify() before binding (mysql2
 *     does not auto-serialize plain objects/arrays in query params).
 *   - questions.regions (a Supabase-branch-only compatibility column, see
 *     src/lib/db/schema.ts's comment) is intentionally dropped — the target
 *     schema has no such column.
 *   - users.phone: Supabase's auth.users.phone is stored WITHOUT a leading
 *     "+" (its own internal convention); the new schema stores E.164 WITH
 *     "+" everywhere (matching normalizePhone()'s output) — this script adds
 *     the "+" back on import.
 *   - admin_keys, phone_verifications, email_verifications, sessions are
 *     never imported — see export-supabase.mjs's header for why.
 *
 * Usage:
 *   MYSQL_HOST=... MYSQL_PORT=3306 MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=... \
 *     node scripts/migrate/import-mysql.mjs
 *
 * For a local dry run, the repo's .env.local already has working
 * MYSQL_* values for the dev MariaDB instance — just:
 *   node -r dotenv/config scripts/migrate/import-mysql.mjs dotenv_config_path=.env.local
 */
import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const dataDir = join(root, "scripts", "migrate", "data");

function readJson(name) {
  const path = join(dataDir, `${name}.json`);
  if (!existsSync(path)) {
    console.error(`[import] missing ${path} — run export-supabase.mjs first`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Postgres timestamptz (arrives as an ISO string once round-tripped through JSON) -> MySQL DATETIME(3), UTC. */
function toMysqlDatetime(value) {
  if (value === null || value === undefined) return null;
  const d = new Date(value);
  return d.toISOString().slice(0, 23).replace("T", " ");
}

function toJson(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

/** Supabase's auth.users.phone has no leading "+"; the new schema stores E.164 with one. */
function normalizeStoredPhone(phone) {
  if (!phone) return null;
  return phone.startsWith("+") ? phone : `+${phone}`;
}

async function upsert(conn, table, columns, rows, mapRow) {
  if (rows.length === 0) {
    console.log(`[import] ${table}: 0 rows, skipping`);
    return;
  }
  const placeholders = `(${columns.map(() => "?").join(", ")})`;
  const updateClause = columns
    .filter((c) => c !== columns[0]) // don't reassign the primary key
    .map((c) => `${c} = VALUES(${c})`)
    .join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${rows
    .map(() => placeholders)
    .join(", ")} ON DUPLICATE KEY UPDATE ${updateClause}`;
  const values = rows.flatMap((row) => mapRow(row));
  await conn.query(sql, values);
  console.log(`[import] ${table}: ${rows.length} rows`);
}

async function main() {
  const users = readJson("users");
  const classes = readJson("classes");
  const classMembers = readJson("class_members");
  const competitions = readJson("competitions");
  const questions = readJson("questions");
  const choices = readJson("choices");
  const participants = readJson("participants");
  const answers = readJson("answers");
  const seriesAttempts = readJson("series_attempts");
  const seriesAnswers = readJson("series_answers");

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    timezone: "Z",
    multipleStatements: false,
  });
  console.log("[import] connected");

  try {
    await conn.beginTransaction();

    // 1. users (no FK dependency)
    await upsert(
      conn,
      "users",
      ["id", "email", "phone", "name", "role", "avatar_url", "created_at", "updated_at"],
      users,
      (r) => [
        r.id,
        r.email,
        normalizeStoredPhone(r.phone),
        r.name,
        r.role,
        r.avatar_url,
        toMysqlDatetime(r.created_at),
        toMysqlDatetime(r.updated_at),
      ]
    );

    // 2. classes (owner_id -> users)
    await upsert(
      conn,
      "classes",
      ["id", "owner_id", "name", "description", "code", "created_at", "archived_at"],
      classes,
      (r) => [
        r.id,
        r.owner_id,
        r.name,
        r.description,
        r.code,
        toMysqlDatetime(r.created_at),
        toMysqlDatetime(r.archived_at),
      ]
    );

    // 3. class_members (class_id -> classes, profile_id -> users)
    await upsert(
      conn,
      "class_members",
      ["class_id", "profile_id", "joined_at"],
      classMembers,
      (r) => [r.class_id, r.profile_id, toMysqlDatetime(r.joined_at)]
    );

    // 4. competitions (owner_id -> users nullable, class_id -> classes nullable)
    await upsert(
      conn,
      "competitions",
      [
        "id", "code", "name", "title", "description", "instructions",
        "minutes_per_question", "status", "scheduled_at", "started_at", "finished_at",
        "paused_seconds", "default_points", "default_negative_points", "speed_bonus_enabled",
        "created_at", "updated_at", "owner_id", "visibility", "cover_url", "language",
        "category", "difficulty", "archived_at", "class_id", "calls_enabled",
        "join_locked", "allow_late_join", "class_can_join",
      ],
      competitions,
      (r) => [
        r.id, r.code, r.name, r.title, r.description, r.instructions,
        r.minutes_per_question, r.status, toMysqlDatetime(r.scheduled_at),
        toMysqlDatetime(r.started_at), toMysqlDatetime(r.finished_at),
        r.paused_seconds, r.default_points, r.default_negative_points, r.speed_bonus_enabled,
        toMysqlDatetime(r.created_at), toMysqlDatetime(r.updated_at), r.owner_id,
        r.visibility, r.cover_url, r.language, r.category, r.difficulty,
        toMysqlDatetime(r.archived_at), r.class_id, r.calls_enabled,
        r.join_locked, r.allow_late_join, r.class_can_join,
      ]
    );

    // 5. questions (competition_id -> competitions). `regions` is dropped — see header.
    await upsert(
      conn,
      "questions",
      [
        "id", "competition_id", "position", "text", "type", "duration_seconds",
        "points", "negative_points", "explanation", "correct_answer_text", "audio_url",
        "started_at", "ends_at", "surah_number", "ayah_number", "page_number",
        "juz_number", "hizb_number", "created_at", "word_locations", "hint",
      ],
      questions,
      (r) => [
        r.id, r.competition_id, r.position, r.text, r.type, r.duration_seconds,
        r.points, r.negative_points, r.explanation, r.correct_answer_text, r.audio_url,
        toMysqlDatetime(r.started_at), toMysqlDatetime(r.ends_at), r.surah_number,
        r.ayah_number, r.page_number, r.juz_number, r.hizb_number,
        toMysqlDatetime(r.created_at), toJson(r.word_locations ?? []), r.hint,
      ]
    );

    // 6. choices (question_id -> questions)
    await upsert(
      conn,
      "choices",
      ["id", "question_id", "text", "position", "is_correct"],
      choices,
      (r) => [r.id, r.question_id, r.text, r.position, r.is_correct]
    );

    // 7. participants (competition_id -> competitions, profile_id -> users nullable)
    await upsert(
      conn,
      "participants",
      [
        "id", "competition_id", "display_name", "first_name", "last_name",
        "participant_code", "access_token", "connected", "joined_at", "last_seen_at",
        "status", "profile_id", "team", "bonus_award", "avatar",
      ],
      participants,
      (r) => [
        r.id, r.competition_id, r.display_name, r.first_name, r.last_name,
        r.participant_code, r.access_token, r.connected, toMysqlDatetime(r.joined_at),
        toMysqlDatetime(r.last_seen_at), r.status, r.profile_id, r.team,
        r.bonus_award, r.avatar,
      ]
    );

    // 8. answers (competition_id/question_id/participant_id -> above, choice_id -> choices nullable)
    await upsert(
      conn,
      "answers",
      [
        "id", "competition_id", "question_id", "participant_id", "choice_id",
        "answer_text", "submitted_at", "response_time_ms", "is_correct", "points", "bonus_points",
      ],
      answers,
      (r) => [
        r.id, r.competition_id, r.question_id, r.participant_id, r.choice_id,
        r.answer_text, toMysqlDatetime(r.submitted_at), r.response_time_ms,
        r.is_correct, r.points, r.bonus_points,
      ]
    );

    // 9. series_attempts (profile_id -> users)
    await upsert(
      conn,
      "series_attempts",
      [
        "id", "series_id", "profile_id", "started_at", "finished_at", "score",
        "max_score", "answered", "total", "exercise_num", "page", "ecrire_mot",
        "errors", "seconds",
      ],
      seriesAttempts,
      (r) => [
        r.id, r.series_id, r.profile_id, toMysqlDatetime(r.started_at),
        toMysqlDatetime(r.finished_at), r.score, r.max_score, r.answered, r.total,
        r.exercise_num, r.page, r.ecrire_mot, r.errors, r.seconds,
      ]
    );

    // 10. series_answers (attempt_id -> series_attempts)
    await upsert(
      conn,
      "series_answers",
      ["attempt_id", "exercise_id", "answer", "is_correct", "points", "answered_at"],
      seriesAnswers,
      (r) => [
        r.attempt_id, r.exercise_id, toJson(r.answer), r.is_correct, r.points,
        toMysqlDatetime(r.answered_at),
      ]
    );

    await conn.commit();
    console.log("[import] committed");

    // Verification: row counts should match the source export exactly.
    const counts = {
      users: users.length, classes: classes.length, class_members: classMembers.length,
      competitions: competitions.length, questions: questions.length, choices: choices.length,
      participants: participants.length, answers: answers.length,
      series_attempts: seriesAttempts.length, series_answers: seriesAnswers.length,
    };
    console.log("[import] verifying row counts against the target database...");
    let mismatches = 0;
    for (const [table, expected] of Object.entries(counts)) {
      const [[{ n }]] = await conn.query(`select count(*) as n from ${table}`);
      const ok = Number(n) >= expected; // >= not ===: ON DUPLICATE KEY UPDATE means a re-run never loses rows, but the target may pre-exist rows from other imports/testing
      if (!ok) mismatches += 1;
      console.log(`  ${table}: expected >= ${expected}, found ${n} ${ok ? "OK" : "MISMATCH"}`);
    }
    if (mismatches > 0) {
      console.error(`[import] ${mismatches} table(s) have fewer rows than expected — investigate before cutting over.`);
      process.exit(1);
    }
    console.log("[import] done");
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[import] failed:", err);
  process.exit(1);
});
