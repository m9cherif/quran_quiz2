import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";

export const PARTICIPANT_TOKEN_HEADER = "x-participant-token";

/**
 * Ports participant_from_header() (supabase/migrations/20260810120200_rls_security.sql):
 * an anonymous player is identified purely by a random access_token sent in a
 * header — no Supabase Auth session, never was. Returns the participant row,
 * scoped to the given competition so a token from one game can't be replayed
 * against another.
 */
export async function resolveParticipant(competitionId: string, token: string | null) {
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(participants)
    .where(and(eq(participants.competitionId, competitionId), eq(participants.accessToken, token)))
    .limit(1);
  return rows[0] ?? null;
}

export function participantTokenFromRequest(request: Request): string | null {
  return request.headers.get(PARTICIPANT_TOKEN_HEADER);
}
