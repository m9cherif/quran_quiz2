import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { computeAnswerGrade } from "@/lib/games/grade";
import { getCompetition, getQuestion } from "@/lib/games/repo";
import { serializeAnswer } from "@/lib/games/serialize";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

const ACTIVE_STATUSES = new Set(["running", "paused"]);

/**
 * Ports submit_answer(): the FIRST answer wins — a repeat submit for the
 * same question just returns the row that's already there, unchanged,
 * regraded or not. Uses `INSERT ... ON DUPLICATE KEY UPDATE id = id` (a
 * no-op) against answers_one_per_question_uidx as the MySQL idiom for the
 * old `ON CONFLICT (...) DO NOTHING`, then always re-selects — same
 * "insert, or find what's already there" shape as the original.
 */
export async function POST(request: Request) {
  try {
    let body: {
      competitionId?: unknown;
      questionId?: unknown;
      choiceId?: unknown;
      answerText?: unknown;
      responseTimeMs?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const competitionId = typeof body.competitionId === "string" ? body.competitionId : "";
    const questionId = typeof body.questionId === "string" ? body.questionId : "";
    const choiceId = typeof body.choiceId === "string" && body.choiceId ? body.choiceId : null;
    // Only a missing/non-string value maps to null — an empty string is a
    // provided (if odd) answer, same as the original's `is null` check.
    const answerText = typeof body.answerText === "string" ? body.answerText : null;
    let responseTimeMs = Math.round(Number(body.responseTimeMs));
    if (!Number.isFinite(responseTimeMs) || responseTimeMs < 0) responseTimeMs = 0;

    const token = participantTokenFromRequest(request);
    const participant = await resolveParticipant(competitionId, token);
    if (!participant) throw new GameError("28000", "Not a participant of this game");
    if (!choiceId && answerText === null) throw new GameError("22023", "Provide a choice or an answer");

    const db = getDb();
    const question = await getQuestion(questionId, db);
    if (!question) throw new GameError("P0002", "Question not found");
    if (question.competitionId !== competitionId) {
      throw new GameError("23503", "Question does not belong to this game");
    }
    const competition = await getCompetition(competitionId, db);
    if (!competition) throw new GameError("P0002", "Competition does not exist");
    if (!ACTIVE_STATUSES.has(competition.status)) throw new GameError("28000", "Game is not active");
    const now = new Date();
    if (!question.startedAt || now.getTime() < question.startedAt.getTime()) {
      throw new GameError("28000", "Question is not open yet");
    }

    const row = await db.transaction(async (tx) => {
      const grade = await computeAnswerGrade(tx, question, competition, {
        choiceId,
        answerText,
        responseTimeMs,
        submittedAt: now,
      });

      await tx
        .insert(answers)
        .values({
          id: newId(),
          competitionId,
          questionId,
          participantId: participant.id,
          choiceId,
          answerText,
          submittedAt: now,
          responseTimeMs,
          isCorrect: grade.isCorrect,
          points: grade.points,
          bonusPoints: grade.bonusPoints,
        })
        .onDuplicateKeyUpdate({ set: { id: sql`id` } });

      const rows = await tx
        .select()
        .from(answers)
        .where(and(eq(answers.competitionId, competitionId), eq(answers.questionId, questionId), eq(answers.participantId, participant.id)))
        .limit(1);
      return rows[0];
    });

    const serialized = serializeAnswer(row);
    emit(competitionId, { type: "answer-received", payload: serialized });
    return NextResponse.json(serialized);
  } catch (err) {
    return errorResponse(err);
  }
}
