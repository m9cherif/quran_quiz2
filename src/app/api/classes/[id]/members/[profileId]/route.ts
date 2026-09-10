import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classMembers } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { isClassOwner } from "@/lib/db/classMembership";

export const runtime = "nodejs";

/**
 * Ports remove_class_member(p_class_id, p_profile_id): only the class owner
 * may remove a member; 404 (errcode 42501) covers both "not owner" and "not
 * a member" the same way the original's WHERE+EXISTS combo did.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; profileId: string }> }
) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id, profileId } = await params;

  const db = getDb();
  if (!(await isClassOwner(db, id, user.id))) {
    return NextResponse.json({ error: "Class not found", code: "42501" }, { status: 404 });
  }

  const [result] = await db
    .delete(classMembers)
    .where(and(eq(classMembers.classId, id), eq(classMembers.profileId, profileId)));
  if (result.affectedRows === 0) {
    return NextResponse.json({ error: "Class not found", code: "42501" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
