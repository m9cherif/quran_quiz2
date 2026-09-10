import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, isOwner } from "@/lib/games/repo";

export const runtime = "nodejs";

interface MatrixRow {
  display_name: string;
  position_number: number;
  question_text: string;
  answer_text: string | null;
  is_correct: boolean | null;
  points: number | null;
  response_time_ms: number | null;
}

/** Ports game_answer_matrix(): every player x question result — host only; backs the CSV export. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const db = getDb();
    const competition = await getCompetition(competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");
    const user = await getSessionUserFromCookies();
    if (!isOwner(competition, user?.id)) throw new GameError("42501", "Only the game host can export results");

    const [rows] = (await db.execute(sql`
      SELECT
        p.display_name AS display_name,
        q.position AS position_number,
        q.text AS question_text,
        COALESCE(ch.text, a.answer_text) AS answer_text,
        a.is_correct AS is_correct,
        COALESCE(a.points, 0) + COALESCE(a.bonus_points, 0) AS points,
        a.response_time_ms AS response_time_ms
      FROM participants p
      CROSS JOIN questions q
      LEFT JOIN answers a ON a.participant_id = p.id AND a.question_id = q.id
      LEFT JOIN choices ch ON ch.id = a.choice_id
      WHERE p.competition_id = ${competitionId} AND q.competition_id = ${competitionId}
      ORDER BY p.display_name, q.position
    `)) as unknown as [MatrixRow[], unknown];

    return NextResponse.json(
      rows.map((r) => ({
        display_name: r.display_name,
        position_number: Number(r.position_number),
        question_text: r.question_text,
        answer_text: r.answer_text,
        is_correct: r.is_correct === null ? null : Boolean(r.is_correct),
        points: r.points === null ? null : Number(r.points),
        response_time_ms: r.response_time_ms === null ? null : Number(r.response_time_ms),
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
