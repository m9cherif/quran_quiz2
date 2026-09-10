import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";

export const runtime = "nodejs";

/**
 * Ports update_presence(): heartbeat, marks the caller online with a server
 * timestamp. Deliberately does not emit() — a player heartbeats every few
 * seconds (see GameLobby.jsx/GameQuestion.jsx polling), and broadcasting
 * every one of those to every SSE listener would flood the stream for a
 * signal nothing currently subscribes to (host presence is still driven by
 * the separate Supabase Realtime presence channel in useGamePresence.js,
 * which a later pass migrates). connected/last_seen_at stay a plain
 * best-effort store for now.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const token = participantTokenFromRequest(request);
    const participant = await resolveParticipant(competitionId, token);
    if (!participant) throw new GameError("28000", "Not a participant of this game");

    await getDb()
      .update(participants)
      .set({ connected: true, lastSeenAt: new Date() })
      .where(eq(participants.id, participant.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
