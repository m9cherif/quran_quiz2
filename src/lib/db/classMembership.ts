import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { classMembers, classes } from "./schema";

/** Ports is_class_member(p_class_id, p_profile_id) (supabase/migrations/20260810121600_classes.sql). */
export async function isClassMember(db: Db, classId: string, profileId: string): Promise<boolean> {
  const rows = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(and(eq(classMembers.classId, classId), eq(classMembers.profileId, profileId)))
    .limit(1);
  return rows.length > 0;
}

/** True when profileId owns the class (owner_id = profileId), independent of membership. */
export async function isClassOwner(db: Db, classId: string, profileId: string): Promise<boolean> {
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.ownerId, profileId)))
    .limit(1);
  return rows.length > 0;
}
