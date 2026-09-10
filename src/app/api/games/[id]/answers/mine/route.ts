import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers } from "@/lib/db/schema";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { serializeAnswer } from "@/lib/games/serialize";

export const runtime = "nodejs";

/** Ports getMyAnswers(): my own answers in this game, oldest first. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const token = participantTokenFromRequest(request);
    const participant = await resolveParticipant(competitionId, token);
    if (!participant) throw new GameError("28000", "Not a participant of this game");

    const db = getDb();
    const rows = await db
      .select()
      .from(answers)
      .where(and(eq(answers.competitionId, competitionId), eq(answers.participantId, participant.id)))
      .orderBy(asc(answers.submittedAt));

    return NextResponse.json(rows.map(serializeAnswer));
  } catch (err) {
    return errorResponse(err);
  }
}
