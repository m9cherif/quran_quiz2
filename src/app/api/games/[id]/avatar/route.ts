import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/** Ports set_my_avatar(): a single emoji, token-scoped to the caller's own row. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const token = participantTokenFromRequest(request);
    const participant = await resolveParticipant(competitionId, token);
    if (!participant) throw new GameError("28000", "Not a participant of this game");

    let body: { avatar?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const clean = typeof body.avatar === "string" ? body.avatar.trim() : "";
    if (clean.length > 4) throw new GameError("22023", "Avatar must be a single emoji");

    const db = getDb();
    await db
      .update(participants)
      .set({ avatar: clean === "" ? null : clean })
      .where(eq(participants.id, participant.id));

    emit(competitionId, {
      type: "participant-updated",
      payload: { participant_id: participant.id, avatar: clean === "" ? null : clean },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
