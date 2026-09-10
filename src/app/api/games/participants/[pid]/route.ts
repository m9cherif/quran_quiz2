import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getParticipantById, isOwner } from "@/lib/games/repo";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

async function requireHostOfParticipant(pid: string) {
  const db = getDb();
  const participant = await getParticipantById(pid, db);
  if (!participant) throw new GameError("P0002", "Player not found");
  const competition = await getCompetition(participant.competitionId, db);
  const user = await getSessionUserFromCookies();
  if (!competition || !isOwner(competition, user?.id)) {
    throw new GameError("42501", "Only the game host can manage players");
  }
  return { db, participant, competition };
}

/** Ports remove_participant(): host removes a player from the game. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ pid: string }> }) {
  try {
    const { pid } = await params;
    const { db, participant } = await requireHostOfParticipant(pid);

    await db.delete(participants).where(eq(participants.id, pid));

    emit(participant.competitionId, { type: "participant-left", payload: { participant_id: pid } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Ports set_participant_team(): host puts one player on a team (empty string clears it). */
export async function PATCH(request: Request, { params }: { params: Promise<{ pid: string }> }) {
  try {
    const { pid } = await params;
    const { db, participant } = await requireHostOfParticipant(pid);

    let body: { team?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const team = typeof body.team === "string" ? body.team.trim() : "";

    await db
      .update(participants)
      .set({ team: team === "" ? null : team })
      .where(eq(participants.id, pid));

    emit(participant.competitionId, {
      type: "participant-updated",
      payload: { participant_id: pid, team: team === "" ? null : team },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
