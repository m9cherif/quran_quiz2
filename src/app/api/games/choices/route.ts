import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, questions } from "@/lib/db/schema";
import { participantTokenFromRequest } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getParticipantByToken } from "@/lib/games/repo";
import { serializeChoicePublic } from "@/lib/games/serialize";

export const runtime = "nodejs";

const PARTICIPANT_VISIBLE_STATUSES = new Set(["running", "paused", "finished"]);

/**
 * Ports listChoices() — participant-token gated, is_correct never sent. The
 * old call took only question ids (RLS worked out the competition from the
 * question → participant_from_header join); this resolves the same way,
 * from the token alone, so the client-side signature can stay unchanged.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const questionIds = (url.searchParams.get("questionIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (questionIds.length === 0) return NextResponse.json([]);

    const token = participantTokenFromRequest(request);
    const db = getDb();
    const participant = await getParticipantByToken(token, db);
    if (!participant) throw new GameError("42501", "Not authorized");

    const competition = await getCompetition(participant.competitionId, db);
    if (!competition || !PARTICIPANT_VISIBLE_STATUSES.has(competition.status)) {
      throw new GameError("42501", "Not authorized");
    }

    const rows = await db
      .select({ choice: choices })
      .from(choices)
      .innerJoin(questions, eq(questions.id, choices.questionId))
      .where(and(eq(questions.competitionId, competition.id), inArray(choices.questionId, questionIds)))
      .orderBy(asc(choices.position));

    return NextResponse.json(rows.map((r) => serializeChoicePublic(r.choice)));
  } catch (err) {
    return errorResponse(err);
  }
}
