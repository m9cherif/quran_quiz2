import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, questions } from "@/lib/db/schema";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition } from "@/lib/games/repo";
import { serializeChoicePublic } from "@/lib/games/serialize";

export const runtime = "nodejs";

const PARTICIPANT_VISIBLE_STATUSES = new Set(["running", "paused", "finished"]);

/**
 * Ports listChoices() — participant-token gated, is_correct never sent (see
 * "choices_select_participant" / the column-level grant that used to hide
 * it). ?questionIds=a,b,c narrows to a set of questions, same as the old
 * `.in("question_id", questionIds)` call.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const url = new URL(request.url);
    const questionIds = (url.searchParams.get("questionIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (questionIds.length === 0) return NextResponse.json([]);

    const db = getDb();
    const competition = await getCompetition(competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");

    const token = participantTokenFromRequest(request);
    const participant = await resolveParticipant(competitionId, token);
    if (!participant || !PARTICIPANT_VISIBLE_STATUSES.has(competition.status)) {
      throw new GameError("42501", "Not authorized");
    }

    const rows = await db
      .select({ choice: choices })
      .from(choices)
      .innerJoin(questions, eq(questions.id, choices.questionId))
      .where(and(eq(questions.competitionId, competitionId), inArray(choices.questionId, questionIds)))
      .orderBy(asc(choices.position));

    return NextResponse.json(rows.map((r) => serializeChoicePublic(r.choice)));
  } catch (err) {
    return errorResponse(err);
  }
}
