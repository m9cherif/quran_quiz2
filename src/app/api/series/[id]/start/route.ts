import { NextResponse } from "next/server";

import { getServiceClient } from "@/lib/auth/server";
import { pickWords, wordCount } from "@/lib/series/format";
import { getSeries, pageWords } from "@/lib/series/source";
import { seedFor, userFromRequest } from "@/lib/series/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens one exercise of a series and hands back only the half the student is
 * meant to have.
 *
 * When the word is given, the student answers with its place; when the place is
 * given, the student writes the word. Sending both would be sending the answer
 * key, so each mode sends one side and the server keeps the other.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profileId = await userFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const index = Number(body?.num) - 1;
  const plan = (await getSeries())[id];
  if (!plan) return NextResponse.json({ error: "No such series" }, { status: 404 });

  const exercise = plan.exercices[index];
  if (!exercise) return NextResponse.json({ error: "No such exercise" }, { status: 404 });

  const page = pageWords(exercise.page);
  if (page.length === 0) {
    return NextResponse.json({ error: `Page ${exercise.page} has no annotations` }, { status: 409 });
  }

  const db = getServiceClient();
  const { data: attempt, error } = await db
    .from("series_attempts")
    .insert({
      series_id: id,
      profile_id: profileId,
      exercise_num: index + 1,
      page: Number(exercise.page),
      ecrire_mot: Boolean(exercise.ecrire_mot),
      total: wordCount(exercise),
      max_score: 100,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[series] could not start:", error.message);
    return NextResponse.json({ error: "Could not start" }, { status: 500 });
  }

  const chosen = pickWords(exercise, page, seedFor(attempt.id, index));

  return NextResponse.json({
    attemptId: attempt.id,
    num: index + 1,
    page: Number(exercise.page),
    diff: Number(exercise.diff) || 0,
    limite: Number(exercise.limite) || 0,
    ecrire_mot: Boolean(exercise.ecrire_mot),
    // One side only. The other side is the answer.
    prompts: chosen.map((w, i) =>
      exercise.ecrire_mot
        ? { i, line: w.line, rank: w.rank }
        : { i, text: w.text }
    ),
  });
}
