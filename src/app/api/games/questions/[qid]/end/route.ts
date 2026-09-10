import { NextResponse } from "next/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getQuestion, isOwner } from "@/lib/games/repo";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/** Ports end_question(): force-close the window early, host (strict owner match) only. */
export async function POST(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const { qid } = await params;
    const db = getDb();

    const question = await getQuestion(qid, db);
    if (!question) throw new GameError("P0002", "Question not found");

    const competition = await getCompetition(question.competitionId, db);
    const user = await getSessionUserFromCookies();
    if (!competition || !isOwner(competition, user?.id)) {
      throw new GameError("42501", "Only the game host can close questions");
    }

    const now = new Date();
    await db
      .update(questions)
      .set({ endsAt: now })
      .where(and(eq(questions.id, qid), or(isNull(questions.endsAt), gt(questions.endsAt, now))));

    emit(competition.id, { type: "question-ended", payload: { question_id: qid, ends_at: now.toISOString() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
