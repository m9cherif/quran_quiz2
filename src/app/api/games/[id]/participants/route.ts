import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";
import { serializeParticipant } from "@/lib/games/serialize";

export const runtime = "nodejs";

/** Ports listParticipants() — host (owner) only, full rows, joined_at ascending. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const db = getDb();
    const competition = await getCompetition(competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");

    const user = await getSessionUserFromCookies();
    if (!isOwner(competition, user?.id)) throw new GameError("42501", "Not authorized");

    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.competitionId, competitionId))
      .orderBy(asc(participants.joinedAt));

    return NextResponse.json(rows.map(serializeParticipant));
  } catch (err) {
    return errorResponse(err);
  }
}
