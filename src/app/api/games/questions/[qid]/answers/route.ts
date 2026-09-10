import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getQuestion, isOwner } from "@/lib/games/repo";
import { serializeAnswer } from "@/lib/games/serialize";

export const runtime = "nodejs";

/** Ports listQuestionAnswers(): every answer to one question — host only. */
export async function GET(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const { qid } = await params;
    const db = getDb();
    const question = await getQuestion(qid, db);
    if (!question) throw new GameError("P0002", "Question not found");
    const competition = await getCompetition(question.competitionId, db);
    const user = await getSessionUserFromCookies();
    if (!competition || !isOwner(competition, user?.id)) throw new GameError("42501", "Not authorized");

    const rows = await db
      .select()
      .from(answers)
      .where(and(eq(answers.competitionId, competition.id), eq(answers.questionId, qid)))
      .orderBy(asc(answers.submittedAt));

    return NextResponse.json(rows.map(serializeAnswer));
  } catch (err) {
    return errorResponse(err);
  }
}
