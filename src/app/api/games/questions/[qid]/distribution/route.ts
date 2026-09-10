import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getQuestion, isOwner } from "@/lib/games/repo";

export const runtime = "nodejs";

interface DistributionRow {
  choice_id: string;
  choice_text: string;
  position_number: number;
  votes: number;
  is_correct: boolean;
}

/** Ports game_choice_distribution(): live answer spread for one question — host only. */
export async function GET(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const { qid } = await params;
    const db = getDb();
    const question = await getQuestion(qid, db);
    if (!question) throw new GameError("P0002", "Question not found");
    const competition = await getCompetition(question.competitionId, db);
    const user = await getSessionUserFromCookies();
    if (!competition || !isOwner(competition, user?.id)) {
      throw new GameError("42501", "Only the game host can read the answer spread");
    }

    const [rows] = (await db.execute(sql`
      SELECT ch.id AS choice_id, ch.text AS choice_text, ch.position AS position_number,
        COUNT(a.id) AS votes, ch.is_correct AS is_correct
      FROM choices ch
      LEFT JOIN answers a ON a.choice_id = ch.id
      WHERE ch.question_id = ${qid}
      GROUP BY ch.id, ch.text, ch.position, ch.is_correct
      ORDER BY ch.position
    `)) as unknown as [DistributionRow[], unknown];

    return NextResponse.json(
      rows.map((r) => ({
        choice_id: r.choice_id,
        choice_text: r.choice_text,
        position_number: Number(r.position_number),
        votes: Number(r.votes),
        is_correct: Boolean(r.is_correct),
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
