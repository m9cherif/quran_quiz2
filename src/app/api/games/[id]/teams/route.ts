import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";

export const runtime = "nodejs";

interface TeamRow {
  team: string;
  players: number;
  total_points: number;
  correct_count: number;
}

/** Ports team_standings(): owner or any participant. */
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

    const [rows] = (await db.execute(sql`
      SELECT
        p.team AS team,
        COUNT(DISTINCT p.id) AS players,
        COALESCE(SUM(a.points + a.bonus_points), 0) + COALESCE(SUM(DISTINCT p.bonus_award), 0) AS total_points,
        SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct_count
      FROM participants p
      LEFT JOIN answers a ON a.participant_id = p.id
      WHERE p.competition_id = ${competitionId} AND p.team IS NOT NULL
      GROUP BY p.team
      ORDER BY total_points DESC
    `)) as unknown as [TeamRow[], unknown];

    return NextResponse.json(
      rows.map((r) => ({
        team: r.team,
        players: Number(r.players),
        total_points: Number(r.total_points),
        correct_count: Number(r.correct_count ?? 0),
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
