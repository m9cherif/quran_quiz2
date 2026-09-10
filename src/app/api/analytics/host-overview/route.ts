import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, classes, competitions, participants, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

const LIVE_STATUSES = new Set(["waiting", "running", "paused"]);

/**
 * Ports host_overview() (supabase/migrations/20260810121500_analytics_history.sql):
 * cross-game totals for the caller's own competitions. avg_accuracy and
 * students_reached deliberately look across ALL of the caller's competitions
 * (no archived filter — separate subqueries in the original), every other
 * count is scoped to non-archived competitions.
 */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();

  const allComp = await db
    .select({ id: competitions.id, status: competitions.status, archivedAt: competitions.archivedAt })
    .from(competitions)
    .where(eq(competitions.ownerId, user.id));

  const nonArchived = allComp.filter((c) => c.archivedAt === null);
  const nonArchivedIds = nonArchived.map((c) => c.id);
  const allIds = allComp.map((c) => c.id);

  const quizzesTotal = nonArchived.filter((c) => c.status === "draft").length;
  const gamesTotal = nonArchived.filter((c) => c.status !== "draft").length;
  const gamesFinished = nonArchived.filter((c) => c.status === "finished").length;
  const gamesLive = nonArchived.filter((c) => LIVE_STATUSES.has(c.status)).length;

  let playersTotal = 0;
  let questionsTotal = 0;
  let answersTotal = 0;
  if (nonArchivedIds.length > 0) {
    const [participantRows, questionRows, answerRows] = await Promise.all([
      db.select({ id: participants.id }).from(participants).where(inArray(participants.competitionId, nonArchivedIds)),
      db.select({ id: questions.id }).from(questions).where(inArray(questions.competitionId, nonArchivedIds)),
      db.select({ id: answers.id }).from(answers).where(inArray(answers.competitionId, nonArchivedIds)),
    ]);
    playersTotal = participantRows.length;
    questionsTotal = questionRows.length;
    answersTotal = answerRows.length;
  }

  let avgAccuracy = 0;
  let studentsReached = 0;
  if (allIds.length > 0) {
    const [allAnswerRows, allParticipantRows] = await Promise.all([
      db.select({ isCorrect: answers.isCorrect }).from(answers).where(inArray(answers.competitionId, allIds)),
      db.select({ displayName: participants.displayName }).from(participants).where(inArray(participants.competitionId, allIds)),
    ]);
    const total = allAnswerRows.length;
    const correct = allAnswerRows.filter((a) => a.isCorrect).length;
    avgAccuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
    studentsReached = new Set(allParticipantRows.map((p) => p.displayName.toLowerCase())).size;
  }

  const classRows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.ownerId, user.id), isNull(classes.archivedAt)));

  return NextResponse.json({
    quizzes_total: quizzesTotal,
    games_total: gamesTotal,
    games_finished: gamesFinished,
    games_live: gamesLive,
    players_total: playersTotal,
    questions_total: questionsTotal,
    answers_total: answersTotal,
    avg_accuracy: avgAccuracy,
    students_reached: studentsReached,
    classes_total: classRows.length,
  });
}
