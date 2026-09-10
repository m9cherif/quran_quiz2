import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, competitions, participants } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/** Ports my_history() (supabase/migrations/20260810121500_analytics_history.sql): the caller's own participant rows, newest-joined first. */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select({
      participantId: participants.id,
      joinedAt: participants.joinedAt,
      competitionId: competitions.id,
      code: competitions.code,
      name: competitions.name,
      status: competitions.status,
      finishedAt: competitions.finishedAt,
    })
    .from(participants)
    .innerJoin(competitions, eq(competitions.id, participants.competitionId))
    .where(eq(participants.profileId, user.id))
    .orderBy(desc(participants.joinedAt));

  if (rows.length === 0) return NextResponse.json([]);

  const participantIds = rows.map((r) => r.participantId);
  const answerRows = await db
    .select({
      participantId: answers.participantId,
      isCorrect: answers.isCorrect,
      points: answers.points,
      bonusPoints: answers.bonusPoints,
    })
    .from(answers)
    .where(inArray(answers.participantId, participantIds));

  const byParticipant = new Map<string, { score: number; answered: number; correct: number }>();
  for (const a of answerRows) {
    const agg = byParticipant.get(a.participantId) ?? { score: 0, answered: 0, correct: 0 };
    agg.score += Number(a.points) + Number(a.bonusPoints);
    agg.answered += 1;
    if (a.isCorrect) agg.correct += 1;
    byParticipant.set(a.participantId, agg);
  }

  return NextResponse.json(
    rows.map((r) => {
      const agg = byParticipant.get(r.participantId) ?? { score: 0, answered: 0, correct: 0 };
      return {
        competition_id: r.competitionId,
        code: r.code,
        name: r.name,
        status: r.status,
        finished_at: r.finishedAt ? r.finishedAt.toISOString() : null,
        joined_at: r.joinedAt.toISOString(),
        score: agg.score,
        answered_count: agg.answered,
        correct_count: agg.correct,
        accuracy: agg.answered > 0 ? Math.round((agg.correct / agg.answered) * 1000) / 10 : 0,
      };
    })
  );
}
