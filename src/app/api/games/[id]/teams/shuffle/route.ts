import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

const TEAM_NAMES = ["Team A", "Team B", "Team C", "Team D", "Team E", "Team F"];

/** Ports shuffle_teams(): random Fisher-Yates shuffle, then round-robin across N teams. 0 disbands them. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const db = getDb();
    const competition = await getCompetition(competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");
    const user = await getSessionUserFromCookies();
    if (!isOwner(competition, user?.id)) throw new GameError("42501", "Only the game host can set teams");

    let body: { teamCount?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const teamCount = Number(body.teamCount);
    if (!Number.isInteger(teamCount) || teamCount < 0 || teamCount > 6) {
      throw new GameError("22023", "Between 0 and 6 teams");
    }

    await db.transaction(async (tx) => {
      if (teamCount === 0) {
        await tx.update(participants).set({ team: null }).where(eq(participants.competitionId, competitionId));
        return;
      }
      const rows = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(eq(participants.competitionId, competitionId));
      const ids = rows.map((r) => r.id);
      // Fisher-Yates.
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      for (let seat = 0; seat < ids.length; seat++) {
        await tx.update(participants).set({ team: TEAM_NAMES[seat % teamCount] }).where(eq(participants.id, ids[seat]));
      }
    });

    emit(competitionId, { type: "participant-updated", payload: { shuffled: true, team_count: teamCount } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
