import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  classMembers,
  classes,
  competitions,
  participants,
  seriesAnswers,
  seriesAttempts,
  sessions,
  users,
} from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

const ROLES = new Set(["host", "student", "admin"]);

/** Ports admin_set_role(p_user_id, p_role) (supabase/migrations/20260910120000_admin_role.sql). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const role = typeof body.role === "string" ? body.role : "";
  if (!ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (id === user.id && role !== "admin") {
    return NextResponse.json({ error: "Cannot demote your own account" }, { status: 403 });
  }

  const db = getDb();
  const [result] = await db.update(users).set({ role }).where(eq(users.id, id));
  if (result.affectedRows === 0) {
    return NextResponse.json({ error: "No such user" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Ports the user-deletion cascade the old Postgres FK map did automatically
 * (ON DELETE CASCADE/SET NULL — see supabase/migrations/20260810120000_profiles.sql
 * and friends). MySQL here has no FK constraints defined in schema.ts, so
 * every step below is explicit, innermost-table-first, in one transaction:
 *
 *   1. sessions            — kill their other logged-in sessions
 *   2. series_answers/series_attempts — CASCADE in the old schema, deleted
 *   3. participants.profile_id -> null — was NO ACTION (never cascaded in
 *      production); anonymize instead of delete, preserving game history
 *   4. class_members       — CASCADE: memberships in others' classes vanish
 *   5. classes the user owns — CASCADE: memberships in *their* classes
 *      vanish too, and competitions attached to those classes are detached
 *      (class_id -> null, SET NULL) before the classes themselves are deleted
 *   6. competitions.owner_id -> null — SET NULL: their quizzes/games survive,
 *      ownerless
 *   7. the user row itself
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUserFromCookies();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.userId, id));

      const attemptRows = await tx
        .select({ id: seriesAttempts.id })
        .from(seriesAttempts)
        .where(eq(seriesAttempts.profileId, id));
      const attemptIds = attemptRows.map((r) => r.id);
      if (attemptIds.length > 0) {
        await tx.delete(seriesAnswers).where(inArray(seriesAnswers.attemptId, attemptIds));
      }
      await tx.delete(seriesAttempts).where(eq(seriesAttempts.profileId, id));

      await tx.update(participants).set({ profileId: null }).where(eq(participants.profileId, id));

      await tx.delete(classMembers).where(eq(classMembers.profileId, id));

      const ownedClassRows = await tx.select({ id: classes.id }).from(classes).where(eq(classes.ownerId, id));
      const ownedClassIds = ownedClassRows.map((r) => r.id);
      if (ownedClassIds.length > 0) {
        await tx.delete(classMembers).where(inArray(classMembers.classId, ownedClassIds));
        await tx.update(competitions).set({ classId: null }).where(inArray(competitions.classId, ownedClassIds));
        await tx.delete(classes).where(eq(classes.ownerId, id));
      }

      await tx.update(competitions).set({ ownerId: null }).where(eq(competitions.ownerId, id));

      const [result] = await tx.delete(users).where(eq(users.id, id));
      if (result.affectedRows === 0) {
        throw new Error("NOT_FOUND");
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "No such user" }, { status: 404 });
    }
    console.error("Admin user delete failed:", err);
    return NextResponse.json({ error: "Could not delete the account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
