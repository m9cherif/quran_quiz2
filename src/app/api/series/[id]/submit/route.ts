import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { seriesAnswers, seriesAttempts } from "@/lib/db/schema";
import { checkAnswer, noteOutOf100, pickWords } from "@/lib/series/format";
import { getSeries, pageWords } from "@/lib/series/source";
import { seedFor, userFromRequest } from "@/lib/series/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Marks a finished exercise and records the session.
 *
 * The words are drawn again from the same seed rather than stored: the draw is
 * a pure function of the attempt, so keeping a copy would only create a second
 * version of the truth that could drift from the first.
 *
 * The mark is the proportion right, out of 100 — the same as the desktop tool.
 * Time and mistakes are recorded because the report shows them, but they do not
 * change the mark.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profileId = await userFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const attemptId = String(body?.attemptId ?? "");
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  const seconds = Math.max(0, Math.round(Number(body?.seconds) || 0));

  const db = getDb();
  // An attempt id is only trusted once it is shown to belong to this person and
  // this series.
  const attemptRows = await db
    .select({ id: seriesAttempts.id, exerciseNum: seriesAttempts.exerciseNum, finishedAt: seriesAttempts.finishedAt })
    .from(seriesAttempts)
    .where(and(eq(seriesAttempts.id, attemptId), eq(seriesAttempts.profileId, profileId), eq(seriesAttempts.seriesId, id)))
    .limit(1);
  const attempt = attemptRows[0];
  if (!attempt) return NextResponse.json({ error: "Unknown attempt" }, { status: 403 });
  if (attempt.finishedAt) {
    return NextResponse.json({ error: "Already marked" }, { status: 409 });
  }

  const plan = (await getSeries())[id];
  const index = Number(attempt.exerciseNum) - 1;
  const exercise = plan?.exercices[index];
  if (!exercise) return NextResponse.json({ error: "No such exercise" }, { status: 404 });

  const chosen = pickWords(exercise, pageWords(exercise.page), seedFor(attemptId, index));
  const ecrire = Boolean(exercise.ecrire_mot);

  const corrections = chosen.map((word, i) => {
    const given = answers[i];
    const answered = ecrire ? String(given ?? "").trim() !== "" : given != null;
    const right = answered && checkAnswer(ecrire, word, given);
    return {
      i,
      right,
      answered,
      // What it should have been, now that the exercise is over.
      expected: ecrire ? word.text : { line: word.line, rank: word.rank },
      given: given ?? null,
    };
  });

  const right = corrections.filter((c) => c.right).length;
  const answered = corrections.filter((c) => c.answered).length;
  const note = noteOutOf100(right, chosen.length);

  await db
    .update(seriesAttempts)
    .set({
      finishedAt: new Date(),
      score: note,
      answered,
      total: chosen.length,
      errors: answered - right,
      seconds,
    })
    .where(eq(seriesAttempts.id, attemptId));

  if (corrections.length > 0) {
    await db
      .insert(seriesAnswers)
      .values(
        corrections.map((c) => ({
          attemptId,
          exerciseId: String(c.i),
          answer: (c.given ?? null) as unknown,
          isCorrect: c.right,
          points: c.right ? 1 : 0,
        }))
      )
      .onDuplicateKeyUpdate({
        set: {
          answer: sql`values(${seriesAnswers.answer})`,
          isCorrect: sql`values(${seriesAnswers.isCorrect})`,
          points: sql`values(${seriesAnswers.points})`,
        },
      });
  }

  return NextResponse.json({ note, right, answered, total: chosen.length, seconds, corrections });
}
