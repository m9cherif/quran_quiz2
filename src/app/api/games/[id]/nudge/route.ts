import { NextResponse } from "next/server";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/**
 * Replaces the old raw Supabase broadcast("deck-updated") the host UI sent
 * after any deck-changing action not already covered by a more specific
 * emit() elsewhere (add question, toggle calls_enabled, and a general
 * "just in case" nudge after advance/endCurrent/finishGame/addTime). Owner
 * gated the same way every other host-only mutation route is.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const competition = await getCompetition(competitionId);
    if (!competition) throw new GameError("P0002", "Game not found");
    const user = await getSessionUserFromCookies();
    if (!isOwner(competition, user?.id)) throw new GameError("42501", "Only the game host can do that");

    emit(competitionId, { type: "deck-updated", payload: {} });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
