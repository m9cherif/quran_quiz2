import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classMembers, classes, seriesAttempts } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ports the RLS-scoped `series_attempts_teacher` read: marked attempts for a
 * set of students, restricted to students who are members of a class the
 * caller owns. No class id is taken as input — same as the old policy — so a
 * requested id that fails the ownership check is silently dropped rather
 * than erroring, matching "asking for a stranger's id returns nothing".
 */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const requested: string[] = Array.isArray(body?.profileIds)
    ? body.profileIds.filter((id: unknown) => typeof id === "string")
    : [];
  if (requested.length === 0) return NextResponse.json([]);

  const db = getDb();
  const owned = await db
    .select({ profileId: classMembers.profileId })
    .from(classMembers)
    .innerJoin(classes, eq(classes.id, classMembers.classId))
    .where(and(eq(classes.ownerId, user.id), inArray(classMembers.profileId, requested)));

  const allowedIds = [...new Set(owned.map((r) => r.profileId))];
  if (allowedIds.length === 0) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(seriesAttempts)
    .where(and(inArray(seriesAttempts.profileId, allowedIds), isNotNull(seriesAttempts.finishedAt)))
    .orderBy(desc(seriesAttempts.finishedAt))
    .limit(1000);

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
