import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getServiceClient } from "@/lib/auth/server";
import { grade, pointsFor } from "@/lib/series/format";
import { getSeries, wordsOnPage } from "@/lib/series/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Marks one answer and records it.
 *
 * Marking is here rather than in the browser because the browser must not hold
 * the answer key, and because a client that could write `is_correct` could
 * award itself the marks — which is why the table has no insert policy at all
 * and this route writes with the service role.
 *
 * The caller proves who they are with their own Supabase session; the identity
 * comes from that token, never from the request body.
 */
async function userFromRequest(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profileId = await userFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  let body: { attemptId?: string; exerciseId?: string; answer?: unknown; finish?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const series = (await getSeries())[id];
  if (!series) return NextResponse.json({ error: "No such series" }, { status: 404 });

  const db = getServiceClient();
  const total = series.exercises.length;
  const maxScore = series.exercises.reduce((sum, e) => sum + pointsFor(e), 0);

  // One attempt per run. Reusing the id keeps a reload from starting over and
  // losing what was already answered.
  let attemptId = body.attemptId;
  if (!attemptId) {
    const { data, error } = await db
      .from("series_attempts")
      .insert({ series_id: id, profile_id: profileId, total, max_score: maxScore })
      .select("id")
      .single();
    if (error) {
      console.error("[series] could not start an attempt:", error.message);
      return NextResponse.json({ error: "Could not start" }, { status: 500 });
    }
    attemptId = data.id as string;
  } else {
    // An attempt id from the client is only trusted once it is shown to belong
    // to this person and this series.
    const { data } = await db
      .from("series_attempts")
      .select("id")
      .eq("id", attemptId)
      .eq("profile_id", profileId)
      .eq("series_id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Unknown attempt" }, { status: 403 });
  }

  let marked = null;
  if (body.exerciseId) {
    const exercise = series.exercises.find((e) => e.id === body.exerciseId);
    if (!exercise) return NextResponse.json({ error: "No such exercise" }, { status: 404 });

    const expected =
      exercise.type === "page_words" && exercise.page
        ? wordsOnPage(exercise.page, exercise.words ?? [])
        : undefined;
    marked = grade(exercise, body.answer, expected);

    const { error } = await db.from("series_answers").upsert(
      {
        attempt_id: attemptId,
        exercise_id: exercise.id,
        answer: body.answer as never,
        is_correct: marked.correct,
        points: marked.points,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,exercise_id" }
    );
    if (error) {
      console.error("[series] could not record an answer:", error.message);
      return NextResponse.json({ error: "Could not record" }, { status: 500 });
    }
  }

  // The running total is recomputed from the rows rather than added up as we
  // go: answering the same exercise twice must not count twice.
  const { data: rows } = await db
    .from("series_answers")
    .select("points")
    .eq("attempt_id", attemptId);
  const score = (rows ?? []).reduce((sum, r) => sum + Number(r.points ?? 0), 0);
  const answered = rows?.length ?? 0;

  await db
    .from("series_attempts")
    .update({
      score,
      answered,
      finished_at: body.finish || answered >= total ? new Date().toISOString() : null,
    })
    .eq("id", attemptId);

  return NextResponse.json({
    attemptId,
    correct: marked?.correct ?? null,
    points: marked?.points ?? 0,
    detail: marked?.detail ?? null,
    explanation: marked && !marked.correct ? (series.exercises.find((e) => e.id === body.exerciseId)?.explanation ?? null) : null,
    score,
    answered,
    total,
    maxScore,
    done: answered >= total,
  });
}
