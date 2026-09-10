import { NextResponse } from "next/server";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { errorResponse } from "@/lib/games/errors";
import { serializeParticipant } from "@/lib/games/serialize";

export const runtime = "nodejs";

/** Ports my_participant(): restore/validate my own participant row from the header token. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const token = participantTokenFromRequest(request);
    const participant = await resolveParticipant(competitionId, token);
    return NextResponse.json(participant ? serializeParticipant(participant) : null);
  } catch (err) {
    return errorResponse(err);
  }
}
