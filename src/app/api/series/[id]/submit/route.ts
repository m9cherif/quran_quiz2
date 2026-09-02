import { NextResponse } from "next/server";

import { getServiceClient } from "@/lib/auth/server";
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

  const db = getServiceClient();
  // An attempt id is only trusted once it is shown to belong to this person and
  // this series.
  const { data: attempt } = await db
    .from("series_attempts")
    .select("id, exercise_num, finished_at")
    .eq("id", attemptId)
    .eq("profile_id", profileId)
    .eq("series_id", id)
    .maybeSingle();
  if (!attempt) return NextResponse.json({ error: "Unknown attempt" }, { status: 403 });
  if (attempt.finished_at) {
    return NextResponse.json({ error: "Already marked" }, { status: 409 });
  }

  const plan = (await getSeries())[id];
  const index = Number(attempt.exercise_num) - 1;
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
    .from("series_attempts")
    .update({
      finished_at: new Date().toISOString(),
      score: note,
      answered,
      total: chosen.length,
      errors: answered - right,
      seconds,
    })
    .eq("id", attemptId);

  await db.from("series_answers").upsert(
    corrections.map((c) => ({
      attempt_id: attemptId,
      exercise_id: String(c.i),
      answer: (c.given ?? null) as never,
      is_correct: c.right,
      points: c.right ? 1 : 0,
    })),
    { onConflict: "attempt_id,exercise_id" }
  );

  return NextResponse.json({ note, right, answered, total: chosen.length, seconds, corrections });
}
