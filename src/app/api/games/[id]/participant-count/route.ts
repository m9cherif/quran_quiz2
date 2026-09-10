import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";

export const runtime = "nodejs";

/** Ports game_participant_count() — aggregate only, admits the owner or any participant. */
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
      authorized = Boolean(await resolveParticipant(competitionId, token));
    }
    if (!authorized) throw new GameError("42501", "Not authorized");

    const rows = await db.select({ n: count() }).from(participants).where(eq(participants.competitionId, competitionId));
    return NextResponse.json(Number(rows[0]?.n ?? 0));
  } catch (err) {
    return errorResponse(err);
  }
}
