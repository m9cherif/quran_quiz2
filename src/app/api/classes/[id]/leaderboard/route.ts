import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { answers, competitions, participants, users } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { isClassOwner } from "@/lib/db/classMembership";

export const runtime = "nodejs";

/**
 * Ports class_leaderboard(p_class_id): owner-only aggregate across every
 * participant in every competition attached to the class. Grouping key is
 * the resolved student name — a linked participant's profile name, or the
 * raw display name — so two participants that resolve to the same profile
 * name merge, matching the original's `group by coalesce(pr.name, p.display_name)`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  if (!(await isClassOwner(db, id, user.id))) {
    return NextResponse.json({ error: "Only the class owner can read this", code: "42501" }, { status: 403 });
  }

  const compRows = await db.select({ id: competitions.id }).from(competitions).where(eq(competitions.classId, id));
  if (compRows.length === 0) return NextResponse.json([]);
  const compIds = compRows.map((c) => c.id);

  const partRows = await db
    .select({
      id: participants.id,
      competitionId: participants.competitionId,
      displayName: participants.displayName,
      profileId: participants.profileId,
      bonusAward: participants.bonusAward,
    })
    .from(participants)
    .where(inArray(participants.competitionId, compIds));
  if (partRows.length === 0) return NextResponse.json([]);

  const profileIds = [...new Set(partRows.map((p) => p.profileId).filter((v): v is string => !!v))];
  const profileNames = new Map<string, string>();
  if (profileIds.length > 0) {
    const profileRows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, profileIds));
    for (const p of profileRows) profileNames.set(p.id, p.name);
  }

  const participantIds = partRows.map((p) => p.id);
  const answerRows = await db
    .select({
      participantId: answers.participantId,
      isCorrect: answers.isCorrect,
      points: answers.points,
      bonusPoints: answers.bonusPoints,
    })
    .from(answers)
    .where(inArray(answers.participantId, participantIds));

  const answersByParticipant = new Map<string, typeof answerRows>();
  for (const a of answerRows) {
    const list = answersByParticipant.get(a.participantId) ?? [];
    list.push(a);
    answersByParticipant.set(a.participantId, list);
  }

  interface Agg {
    games: Set<string>;
    totalPoints: number;
    correctCount: number;
    answeredCount: number;
  }
  const byStudent = new Map<string, Agg>();

  for (const p of partRows) {
    const student = (p.profileId && profileNames.get(p.profileId)) || p.displayName;
    let agg = byStudent.get(student);
    if (!agg) {
      agg = { games: new Set(), totalPoints: 0, correctCount: 0, answeredCount: 0 };
      byStudent.set(student, agg);
    }
    agg.games.add(p.competitionId);
    // Each participant's bonus_award counts once, not once per answer row.
    agg.totalPoints += Number(p.bonusAward) || 0;
    for (const a of answersByParticipant.get(p.id) ?? []) {
      agg.totalPoints += Number(a.points) + Number(a.bonusPoints);
      agg.answeredCount += 1;
      if (a.isCorrect) agg.correctCount += 1;
    }
  }

  const result = [...byStudent.entries()].map(([student, agg]) => ({
    student,
    games_played: agg.games.size,
    total_points: agg.totalPoints,
    correct_count: agg.correctCount,
    answered_count: agg.answeredCount,
    accuracy: agg.answeredCount > 0 ? Math.round((agg.correctCount / agg.answeredCount) * 1000) / 10 : 0,
  }));

  result.sort((a, b) => b.total_points - a.total_points || b.correct_count - a.correct_count);

  return NextResponse.json(result);
}
