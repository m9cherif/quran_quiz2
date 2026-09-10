import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { generateCompetitionCode } from "@/lib/db/competitionCode";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/**
 * Ports duplicate_quiz — latest body from
 * supabase/migrations/20260812020000_game_dashboard_columns.sql (carries
 * title/instructions/minutes_per_question along, added after the original
 * 20260810121100 definition).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const srcRows = await db
    .select()
    .from(competitions)
    .where(
      and(eq(competitions.id, id), eq(competitions.ownerId, user.id), isNull(competitions.archivedAt))
    )
    .limit(1);
  const src = srcRows[0];
  if (!src) return NextResponse.json({ error: "Quiz not found" }, { status: 403 });

  const newQuizId = newId();
  const code = await generateCompetitionCode(db);

  await db.transaction(async (tx) => {
    await tx.insert(competitions).values({
      id: newQuizId,
      code,
      name: `${src.name} (copy)`,
      title: `${src.title || src.name} (copy)`,
      description: src.description,
      instructions: src.instructions,
      minutesPerQuestion: src.minutesPerQuestion,
      status: "draft",
      defaultPoints: src.defaultPoints,
      defaultNegativePoints: src.defaultNegativePoints,
      speedBonusEnabled: src.speedBonusEnabled,
      ownerId: src.ownerId,
      visibility: src.visibility,
      coverUrl: src.coverUrl,
      language: src.language,
      category: src.category,
      difficulty: src.difficulty,
    });

    const srcQuestions = await tx
      .select()
      .from(questions)
      .where(eq(questions.competitionId, id))
      .orderBy(questions.position);

    for (const q of srcQuestions) {
      const newQid = newId();
      await tx.insert(questions).values({
        id: newQid,
        competitionId: newQuizId,
        position: q.position,
        text: q.text,
        type: q.type,
        durationSeconds: q.durationSeconds,
        points: q.points,
        negativePoints: q.negativePoints,
        explanation: q.explanation,
        correctAnswerText: q.correctAnswerText,
        audioUrl: q.audioUrl,
        surahNumber: q.surahNumber,
        ayahNumber: q.ayahNumber,
        pageNumber: q.pageNumber,
        juzNumber: q.juzNumber,
        hizbNumber: q.hizbNumber,
        wordLocations: q.wordLocations,
        hint: q.hint,
      });

      const srcChoices = await tx
        .select()
        .from(choices)
        .where(eq(choices.questionId, q.id))
        .orderBy(choices.position);
      for (const c of srcChoices) {
        await tx.insert(choices).values({
          id: newId(),
          questionId: newQid,
          text: c.text,
          position: c.position,
          isCorrect: c.isCorrect,
        });
      }
    }
  });

  return NextResponse.json({ id: newQuizId });
}
