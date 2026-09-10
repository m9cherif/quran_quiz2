import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { seriesAttempts } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ports the RLS-scoped `series_attempts_own` read (profile_id = auth.uid()):
 * the signed-in student's own finished attempts, newest-marked first.
 */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(seriesAttempts)
    .where(and(eq(seriesAttempts.profileId, user.id), isNotNull(seriesAttempts.finishedAt)))
    .orderBy(desc(seriesAttempts.finishedAt))
    .limit(400);

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      series_id: r.seriesId,
      profile_id: r.profileId,
      exercise_num: r.exerciseNum,
      page: r.page,
      score: r.score,
      answered: r.answered,
      total: r.total,
      errors: r.errors,
      seconds: r.seconds,
      started_at: r.startedAt.toISOString(),
      finished_at: r.finishedAt ? r.finishedAt.toISOString() : null,
    }))
  );
}
