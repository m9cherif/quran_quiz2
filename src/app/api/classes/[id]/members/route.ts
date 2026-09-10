import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classMembers, users } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { isClassMember, isClassOwner } from "@/lib/db/classMembership";

export const runtime = "nodejs";

/** Ports list_class_members(p_class_id): caller must be the owner or a member. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const allowed = (await isClassOwner(db, id, user.id)) || (await isClassMember(db, id, user.id));
  if (!allowed) {
    return NextResponse.json({ error: "Class not found", code: "42501" }, { status: 404 });
  }

  const rows = await db
    .select({ profileId: classMembers.profileId, name: users.name, joinedAt: classMembers.joinedAt })
    .from(classMembers)
    .innerJoin(users, eq(users.id, classMembers.profileId))
    .where(eq(classMembers.classId, id))
    .orderBy(asc(classMembers.joinedAt));

  return NextResponse.json(
    rows.map((r) => ({
      profile_id: r.profileId,
      name: r.name,
      joined_at: r.joinedAt.toISOString(),
    }))
  );
}
