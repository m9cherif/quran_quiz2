import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classMembers, classes } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/**
 * Ports my_classes() (supabase/migrations/20260810121600_classes.sql): the
 * caller's own memberships, active classes only (archived_at is null),
 * newest-joined first.
 */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select({
      id: classes.id,
      code: classes.code,
      name: classes.name,
      description: classes.description,
      joinedAt: classMembers.joinedAt,
    })
    .from(classMembers)
    .innerJoin(classes, eq(classMembers.classId, classes.id))
    .where(and(eq(classMembers.profileId, user.id), isNull(classes.archivedAt)))
    .orderBy(desc(classMembers.joinedAt));

  if (rows.length === 0) return NextResponse.json([]);

  const ids = rows.map((r) => r.id);
  const memberRows = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(inArray(classMembers.classId, ids));
  const memberCount = new Map<string, number>();
  for (const r of memberRows) memberCount.set(r.classId, (memberCount.get(r.classId) ?? 0) + 1);

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      member_count: memberCount.get(row.id) ?? 0,
    }))
  );
}
