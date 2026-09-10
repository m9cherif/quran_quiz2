import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, choices, competitions, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/**
 * Ports deleteQuestion — "questions_delete_owner" RLS + FK cascades to
 * choices/answers. Keyed by question id only, matching the old
 * deleteQuestion(questionId) signature (no competition id in scope at its
 * one call site, src/components/quiz/QuizEditor.jsx's saveAll). No FK
 * constraints exist on the MySQL side (see src/app/api/quizzes/[id]/route.ts's
 * DELETE for the same note), so children are cleaned up explicitly here.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const rows = await db
    .select({ ownerId: competitions.ownerId })
    .from(questions)
    .innerJoin(competitions, eq(competitions.id, questions.competitionId))
    .where(eq(questions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.ownerId !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(answers).where(eq(answers.questionId, id));
    await tx.delete(choices).where(eq(choices.questionId, id));
    await tx.delete(questions).where(eq(questions.id, id));
  });

  return NextResponse.json({ ok: true });
}
