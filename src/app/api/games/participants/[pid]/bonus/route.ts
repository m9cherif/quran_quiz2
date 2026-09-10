import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getParticipantById, isOwner } from "@/lib/games/repo";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/** Ports award_bonus(): host adjusts a player's score by hand, outside graded answers. */
export async function POST(request: Request, { params }: { params: Promise<{ pid: string }> }) {
  try {
    const { pid } = await params;
    const db = getDb();
    const participant = await getParticipantById(pid, db);
    if (!participant) throw new GameError("P0002", "Player not found");
    const competition = await getCompetition(participant.competitionId, db);
    const user = await getSessionUserFromCookies();
    if (!competition || !isOwner(competition, user?.id)) {
      throw new GameError("42501", "Only the game host can award points");
    }

    let body: { points?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const points = Number(body.points);
    if (!Number.isFinite(points) || points < -1000 || points > 1000) {
      throw new GameError("22023", "Out of range");
    }

    const total = await db.transaction(async (tx) => {
      const rows = await tx.select({ bonusAward: participants.bonusAward }).from(participants).where(eq(participants.id, pid)).limit(1);
      const next = (rows[0]?.bonusAward ?? 0) + points;
      await tx.update(participants).set({ bonusAward: next }).where(eq(participants.id, pid));
      return next;
    });

    emit(participant.competitionId, {
      type: "participant-updated",
      payload: { participant_id: pid, bonus_award: total },
    });
    return NextResponse.json(total);
  } catch (err) {
    return errorResponse(err);
  }
}
