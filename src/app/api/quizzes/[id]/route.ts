import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, choices, competitions, participants, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { toCompetitionJson } from "@/lib/quiz/mappers";

export const runtime = "nodejs";

const VISIBLE_STATUSES = ["waiting", "running", "paused", "finished"] as const;

/** Ports getQuiz — RLS parity with "competitions_select_visible": owner, ownerless, or a visible-status game. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const rows = await db.select().from(competitions).where(eq(competitions.id, id)).limit(1);
  const row = rows[0];
  if (
    !row ||
    !(row.ownerId === null || row.ownerId === user.id || VISIBLE_STATUSES.includes(row.status as never))
  ) {
    return NextResponse.json({ quiz: null });
  }
  return NextResponse.json({ quiz: toCompetitionJson(row) });
}

const PATCHABLE: Record<string, string> = {
  name: "name",
  title: "title",
  description: "description",
  instructions: "instructions",
  minutes_per_question: "minutesPerQuestion",
  language: "language",
  category: "category",
  difficulty: "difficulty",
  default_points: "defaultPoints",
  default_negative_points: "defaultNegativePoints",
  speed_bonus_enabled: "speedBonusEnabled",
  visibility: "visibility",
  class_id: "classId",
  calls_enabled: "callsEnabled",
  join_locked: "joinLocked",
  allow_late_join: "allowLateJoin",
  class_can_join: "classCanJoin",
};

/** Ports updateQuizMeta — "competitions_update_owner" RLS: owner only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({ ownerId: competitions.ownerId })
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.ownerId !== user.id) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(PATCHABLE)) {
    if (key in body) patch[column] = body[key];
  }
  if (Object.keys(patch).length > 0) {
    await db.update(competitions).set(patch).where(eq(competitions.id, id));
  }
  return NextResponse.json({ ok: true });
}

/**
 * Ports deleteQuiz — "competitions_delete_owner" RLS + the FK cascades from
 * 20260810120900_quiz_management_rpcs_and_cascades.sql. MySQL has no FK
 * constraints wired up on these tables (verified against information_schema
 * on the dev DB), so children are removed explicitly in one transaction.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const rows = await db
    .select({ ownerId: competitions.ownerId })
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.ownerId !== user.id) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    const qRows = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.competitionId, id));
    const qIds = qRows.map((q) => q.id);

    await tx.delete(answers).where(eq(answers.competitionId, id));
    if (qIds.length > 0) {
      await tx.delete(choices).where(inArray(choices.questionId, qIds));
    }
    await tx.delete(questions).where(eq(questions.competitionId, id));
    await tx.delete(participants).where(eq(participants.competitionId, id));
    await tx.delete(competitions).where(eq(competitions.id, id));
  });

  return NextResponse.json({ ok: true });
}
