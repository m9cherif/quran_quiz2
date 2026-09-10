import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { classMembers, competitions, participants, questions } from "@/lib/db/schema";

export async function getCompetition(id: string, db: Db = getDb()) {
  const rows = await db.select().from(competitions).where(eq(competitions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getQuestion(id: string, db: Db = getDb()) {
  const rows = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getParticipantById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Ports is_class_member(class_id, profile_id). */
export async function isClassMember(classId: string, profileId: string, db: Db = getDb()) {
  const rows = await db
    .select({ classId: classMembers.classId })
    .from(classMembers)
    .where(and(eq(classMembers.classId, classId), eq(classMembers.profileId, profileId)))
    .limit(1);
  return rows.length > 0;
}

/** True when `user` may act as this competition's host. */
export function isOwner(competition: { ownerId: string | null }, userId: string | undefined | null): boolean {
  return Boolean(competition.ownerId && userId && competition.ownerId === userId);
}
