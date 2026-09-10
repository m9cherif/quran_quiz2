import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, choices, competitions, participants, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/**
 * Ports admin_delete_competition(p_id) (supabase/migrations/20260910120000_admin_role.sql).
 * The old FKs (questions/choices/participants/answers -> competitions, all
 * ON DELETE CASCADE) are replicated by hand here, innermost-table-first, in
 * one transaction — MySQL has no FK constraints defined in schema.ts.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.delete(answers).where(eq(answers.competitionId, id));
      await tx.delete(participants).where(eq(participants.competitionId, id));

      const questionRows = await tx.select({ id: questions.id }).from(questions).where(eq(questions.competitionId, id));
      const questionIds = questionRows.map((r) => r.id);
      if (questionIds.length > 0) {
        await tx.delete(choices).where(inArray(choices.questionId, questionIds));
      }
      await tx.delete(questions).where(eq(questions.competitionId, id));

      const [result] = await tx.delete(competitions).where(eq(competitions.id, id));
      if (result.affectedRows === 0) {
        throw new Error("NOT_FOUND");
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "No such competition" }, { status: 404 });
    }
    console.error("Admin competition delete failed:", err);
    return NextResponse.json({ error: "Could not delete the competition" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
