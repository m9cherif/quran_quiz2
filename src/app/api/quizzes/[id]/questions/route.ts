import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { toQuestionListItemJson } from "@/lib/quiz/mappers";

export const runtime = "nodejs";

/** Ports listQuizQuestions — the editor sidebar's safe-column, owner-only question list. */
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

  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.competitionId, id))
    .orderBy(questions.position);

  return NextResponse.json(rows.map(toQuestionListItemJson));
}
