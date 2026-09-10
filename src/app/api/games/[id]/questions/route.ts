import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";
import { serializeQuestionSafe } from "@/lib/games/serialize";

export const runtime = "nodejs";

const PARTICIPANT_VISIBLE_STATUSES = new Set(["running", "paused", "finished"]);

/**
 * Ports listGameQuestions() (host, any status) and listStudentQuestions()
 * (participant token, only once the game is running/paused/finished — see
 * "questions_select_participant") as one endpoint: same safe column list
 * either way (never correct_answer_text/explanation), gated by who's asking.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const db = getDb();
    const competition = await getCompetition(competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");

    const user = await getSessionUserFromCookies();
    let authorized = isOwner(competition, user?.id);

    if (!authorized) {
      const token = participantTokenFromRequest(request);
      const participant = await resolveParticipant(competitionId, token);
      authorized = Boolean(participant) && PARTICIPANT_VISIBLE_STATUSES.has(competition.status);
    }
    if (!authorized) throw new GameError("42501", "Not authorized");

    const rows = await db
      .select()
      .from(questions)
      .where(eq(questions.competitionId, competitionId))
      .orderBy(asc(questions.position));

    return NextResponse.json(rows.map(serializeQuestionSafe));
  } catch (err) {
    return errorResponse(err);
  }
}
