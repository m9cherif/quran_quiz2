import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { participantTokenFromRequest, resolveParticipant } from "@/lib/db/participant";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isClassMember, isOwner } from "@/lib/games/repo";

export const runtime = "nodejs";

interface LeaderboardRow {
  rank: number;
  id: string;
  display_name: string;
  correct_count: number;
  answered_count: number;
  total_points: number;
  team: string | null;
  avatar: string | null;
}

/**
 * Ports game_leaderboard(): ranked aggregates, admits the owner, any
 * participant of the game, or a member of the class this game belongs to.
 */
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
    if (!authorized && competition.classId && user) {
      authorized = await isClassMember(competition.classId, user.id, db);
    }
    if (!authorized) throw new GameError("42501", "Not authorized");

    const rows = (await db.execute(sql`
      SELECT
        ROW_NUMBER() OVER (ORDER BY total_points DESC, correct_count DESC, display_name ASC) AS \`rank\`,
        id, display_name, correct_count, answered_count, total_points, team, avatar
      FROM (
        SELECT
          pri.id AS id,
          pri.display_name AS display_name,
          COALESCE(SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END), 0) AS correct_count,
          COUNT(a.id) AS answered_count,
          COALESCE(SUM(a.points + a.bonus_points), 0) + MAX(pri.bonus_award) AS total_points,
          MAX(pri.team) AS team,
          MAX(pri.avatar) AS avatar
        FROM participants pri
        LEFT JOIN answers a ON a.participant_id = pri.id
        WHERE pri.competition_id = ${competitionId}
        GROUP BY pri.id, pri.display_name
      ) t
      ORDER BY total_points DESC, correct_count DESC, display_name ASC
    `)) as unknown as LeaderboardRow[];

    return NextResponse.json(
      rows.map((r) => ({
        rank: Number(r.rank),
        participant_id: r.id,
        display_name: r.display_name,
        correct_count: Number(r.correct_count),
        answered_count: Number(r.answered_count),
        total_points: Number(r.total_points),
        team: r.team,
        avatar: r.avatar,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
