import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, competitions, participants, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/**
 * Ports game_analytics(p_competition_id) (supabase/migrations/20260810121500_analytics_history.sql
 * / 20260810121400_game_question_stats.sql lineage). Owner-only; 404 otherwise.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const compRows = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.id, id), eq(competitions.ownerId, user.id)))
    .limit(1);
  const comp = compRows[0];
  if (!comp) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const [questionRows, participantRows, answerRows] = await Promise.all([
    db.select().from(questions).where(eq(questions.competitionId, id)),
    db.select({ connected: participants.connected }).from(participants).where(eq(participants.competitionId, id)),
    db
      .select({
        participantId: answers.participantId,
        questionId: answers.questionId,
        isCorrect: answers.isCorrect,
        points: answers.points,
        bonusPoints: answers.bonusPoints,
        responseTimeMs: answers.responseTimeMs,
      })
      .from(answers)
      .where(eq(answers.competitionId, id)),
  ]);

  const questionsCount = questionRows.length;
  const participantsCount = participantRows.filter((p) => p.connected).length;
  const answersCount = answerRows.length;

  const scoreByParticipant = new Map<string, number>();
  for (const a of answerRows) {
    scoreByParticipant.set(
      a.participantId,
      (scoreByParticipant.get(a.participantId) ?? 0) + Number(a.points) + Number(a.bonusPoints)
    );
  }
  const scores = [...scoreByParticipant.values()];
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  const correctCount = answerRows.filter((a) => a.isCorrect).length;
  const avgAccuracy = answersCount > 0 ? Math.round((correctCount / answersCount) * 1000) / 10 : 0;
  const avgResponseTimeMs =
    answersCount > 0
      ? Math.round(answerRows.reduce((s, a) => s + a.responseTimeMs, 0) / answersCount)
      : 0;

  interface QAgg {
    position: number;
    text: string;
    answerCount: number;
    correctCount: number;
    totalResponseTime: number;
  }
  const byQuestion = new Map<string, QAgg>();
  for (const q of questionRows) {
    byQuestion.set(q.id, { position: q.position, text: q.text, answerCount: 0, correctCount: 0, totalResponseTime: 0 });
  }
  for (const a of answerRows) {
    const agg = byQuestion.get(a.questionId);
    if (!agg) continue;
    agg.answerCount += 1;
    if (a.isCorrect) agg.correctCount += 1;
    agg.totalResponseTime += a.responseTimeMs;
  }

  const mostMissed = [...byQuestion.values()]
    .map((q) => ({
      position: q.position,
      text: q.text,
      incorrect_count: q.answerCount - q.correctCount,
      accuracy: q.answerCount > 0 ? Math.round((q.correctCount / q.answerCount) * 1000) / 10 : 0,
      avg_response_time_ms: q.answerCount > 0 ? Math.round(q.totalResponseTime / q.answerCount) : 0,
    }))
    .filter((q) => q.incorrect_count > 0)
    .sort((a, b) => b.incorrect_count - a.incorrect_count || a.position - b.position)
    .slice(0, 5);

  return NextResponse.json({
    game_id: comp.id,
    code: comp.code,
    status: comp.status,
    finished_at: comp.finishedAt ? comp.finishedAt.toISOString() : null,
    questions_count: questionsCount,
    participants_count: participantsCount,
    answers_count: answersCount,
    avg_score: avgScore,
    avg_accuracy: avgAccuracy,
    avg_response_time_ms: avgResponseTimeMs,
    most_missed: mostMissed,
  });
}
