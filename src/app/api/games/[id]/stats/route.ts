import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";

export const runtime = "nodejs";

interface StatRow {
  position_number: number;
  text: string;
  duration_seconds: number;
  answered_count: number;
  correct_count: number;
  accuracy: number;
}

/** Ports game_question_stats(): per-question answered/correct/accuracy — host only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const db = getDb();
    const competition = await getCompetition(competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");
    const user = await getSessionUserFromCookies();
    if (!isOwner(competition, user?.id)) throw new GameError("42501", "Only the game host can view question stats");

    const rows = (await db.execute(sql`
      SELECT
        q.position AS position_number,
        q.text AS text,
        q.duration_seconds AS duration_seconds,
        COUNT(a.id) AS answered_count,
        SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct_count,
        CASE WHEN COUNT(a.id) > 0
          THEN ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(a.id), 1)
          ELSE 0 END AS accuracy
      FROM questions q
      LEFT JOIN answers a ON a.question_id = q.id
      WHERE q.competition_id = ${competitionId}
      GROUP BY q.id, q.position, q.text, q.duration_seconds
      ORDER BY q.position
    `)) as unknown as StatRow[];

    return NextResponse.json(
      rows.map((r) => ({
        position_number: Number(r.position_number),
        text: r.text,
        duration_seconds: Number(r.duration_seconds),
        answered_count: Number(r.answered_count),
        correct_count: Number(r.correct_count ?? 0),
        accuracy: Number(r.accuracy ?? 0),
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
