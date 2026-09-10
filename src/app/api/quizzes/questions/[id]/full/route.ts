import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { toQuestionFullJson } from "@/lib/quiz/mappers";

export const runtime = "nodejs";

/**
 * Ports get_question_full
 * (supabase/migrations/20260810120900_quiz_management_rpcs_and_cascades.sql).
 * Also used by src/services/games.ts's getHostQuestionFull (host reveal
 * view) — same RPC in the old code, so the same route here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const qRows = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  const q = qRows[0];
  if (!q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const compRows = await db
    .select({ ownerId: competitions.ownerId })
    .from(competitions)
    .where(eq(competitions.id, q.competitionId))
    .limit(1);
  if (compRows[0]?.ownerId !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const cRows = await db
    .select()
    .from(choices)
    .where(eq(choices.questionId, id))
    .orderBy(choices.position);

  return NextResponse.json(toQuestionFullJson(q, cRows));
}
