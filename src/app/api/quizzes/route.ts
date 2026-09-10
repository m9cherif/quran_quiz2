import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions, questions, participants } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { generateCompetitionCode } from "@/lib/db/competitionCode";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { toQuizSummaryJson } from "@/lib/quiz/mappers";

export const runtime = "nodejs";

/**
 * Ports list_my_quizzes (supabase/migrations/20260810121100_quiz_library_rpcs.sql):
 * owner-scoped, non-archived quizzes with question/participant counts,
 * newest-updated first.
 */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.ownerId, user.id), isNull(competitions.archivedAt)))
    .orderBy(desc(competitions.updatedAt));

  if (rows.length === 0) return NextResponse.json([]);

  const ids = rows.map((r) => r.id);
  const [questionCounts, participantCounts] = await Promise.all([
    db
      .select({ competitionId: questions.competitionId, count: questions.id })
      .from(questions)
      .where(inArray(questions.competitionId, ids)),
    db
      .select({ competitionId: participants.competitionId, count: participants.id })
      .from(participants)
      .where(inArray(participants.competitionId, ids)),
  ]);

  const qCount = new Map<string, number>();
  for (const r of questionCounts) qCount.set(r.competitionId, (qCount.get(r.competitionId) ?? 0) + 1);
  const pCount = new Map<string, number>();
  for (const r of participantCounts) pCount.set(r.competitionId, (pCount.get(r.competitionId) ?? 0) + 1);

  return NextResponse.json(
    rows.map((row) =>
      toQuizSummaryJson(row, {
        questionCount: qCount.get(row.id) ?? 0,
        participantCount: pCount.get(row.id) ?? 0,
      })
    )
  );
}

/** Ports the plain `.from("competitions").insert()` createQuiz used (owner_id from the session, code + title defaulted app-side — see src/lib/db/competitionCode.ts's note on the auto-code trigger). */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Quiz name is required" }, { status: 400 });
  const language = typeof body.language === "string" && body.language ? body.language : "en";

  const db = getDb();
  const id = newId();
  const code = await generateCompetitionCode(db);

  await db.insert(competitions).values({
    id,
    code,
    name,
    // competitions_default_title(): title defaults to name when omitted.
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : name,
    description: typeof body.description === "string" ? body.description : null,
    instructions: typeof body.instructions === "string" ? body.instructions : null,
    ...(typeof body.minutes_per_question === "number"
      ? { minutesPerQuestion: body.minutes_per_question }
      : {}),
    language,
    category: typeof body.category === "string" ? body.category : null,
    difficulty:
      typeof body.difficulty === "string" && body.difficulty ? body.difficulty : null,
    ...(typeof body.default_points === "number" ? { defaultPoints: body.default_points } : {}),
    ...(typeof body.default_negative_points === "number"
      ? { defaultNegativePoints: body.default_negative_points }
      : {}),
    ...(typeof body.speed_bonus_enabled === "boolean"
      ? { speedBonusEnabled: body.speed_bonus_enabled }
      : {}),
    ...(typeof body.visibility === "string" ? { visibility: body.visibility } : {}),
    classId: typeof body.class_id === "string" && body.class_id ? body.class_id : null,
    ...(typeof body.calls_enabled === "boolean" ? { callsEnabled: body.calls_enabled } : {}),
    ...(typeof body.join_locked === "boolean" ? { joinLocked: body.join_locked } : {}),
    ...(typeof body.allow_late_join === "boolean" ? { allowLateJoin: body.allow_late_join } : {}),
    ...(typeof body.class_can_join === "boolean" ? { classCanJoin: body.class_can_join } : {}),
    ownerId: user.id,
    status: "draft",
  });

  return NextResponse.json({ id, code });
}
