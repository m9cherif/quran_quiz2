import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { toQuestionFullJson } from "@/lib/quiz/mappers";

export const runtime = "nodejs";

/**
 * Ports get_quiz_questions_full — latest body from
 * supabase/migrations/20260909194500_restore_regions_compat_for_old_branch.sql
 * (word_locations only; the "regions" compat column in that migration is a
 * shim for a different deployed branch, not this one — see that file's own
 * comment).
 *
 * Deviation: also returns audio_url and hint, which are not in any committed
 * get_quiz_questions_full body but which src/components/quiz/QuizEditor.jsx
 * reads off every row (f.audio_url, f.hint) to rebuild the editor's audio
 * and hint fields — this is the same schema-drift pattern the task's given
 * save_ordering_question body documents elsewhere; the columns already exist
 * on `questions`, so this fills in what the frontend already expects rather
 * than guessing at unrelated new behavior.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const compRows = await db
    .select({ ownerId: competitions.ownerId })
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);
  const comp = compRows[0];
  if (!comp || comp.ownerId !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const qRows = await db
    .select()
    .from(questions)
    .where(eq(questions.competitionId, id))
    .orderBy(questions.position);

  const qIds = qRows.map((q) => q.id);
  const cRows = qIds.length
    ? await db.select().from(choices).where(inArray(choices.questionId, qIds)).orderBy(choices.position)
    : [];
  const byQuestion = new Map<string, typeof cRows>();
  for (const c of cRows) {
    const list = byQuestion.get(c.questionId) ?? [];
    list.push(c);
    byQuestion.set(c.questionId, list);
  }

  return NextResponse.json(
    qRows.map((q) => toQuestionFullJson(q, byQuestion.get(q.id) ?? []))
  );
}
