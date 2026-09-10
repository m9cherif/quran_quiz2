import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getQuestion, isOwner } from "@/lib/games/repo";

export const runtime = "nodejs";

/**
 * Ports get_question_reveal(): the host may always reveal; a participant
 * only once the question's window has actually closed.
 */
export async function GET(request: Request, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const { qid } = await params;
    const db = getDb();
    const question = await getQuestion(qid, db);
    if (!question) throw new GameError("P0002", "Question not found");
    const competition = await getCompetition(question.competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");

    const user = await getSessionUserFromCookies();
    if (!isOwner(competition, user?.id)) {
      const token = participantTokenFromRequest(request);
      const participant = await resolveParticipant(competition.id, token);
      if (!participant) throw new GameError("42501", "Not authorized");
      if (!question.endsAt || question.endsAt.getTime() > Date.now()) {
        throw new GameError("42501", "Question is still open");
      }
    }

    const choiceRows = await db
      .select()
      .from(choices)
      .where(eq(choices.questionId, qid))
      .orderBy(asc(choices.position));
    const correctChoice = choiceRows.find((c) => c.isCorrect) ?? null;

    return NextResponse.json({
      question_id: question.id,
      text: question.text,
      correct_answer_text: question.correctAnswerText,
      explanation: question.explanation,
      correct_choice: correctChoice ? { id: correctChoice.id, text: correctChoice.text } : null,
      choices: choiceRows.map((c) => ({ id: c.id, text: c.text })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
