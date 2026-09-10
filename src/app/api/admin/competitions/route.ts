import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions, participants, questions, users } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/** Ports admin_list_competitions() (supabase/migrations/20260910120000_admin_role.sql). */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: competitions.id,
      code: competitions.code,
      title: competitions.title,
      status: competitions.status,
      ownerId: competitions.ownerId,
      ownerName: users.name,
      createdAt: competitions.createdAt,
    })
    .from(competitions)
    .leftJoin(users, eq(users.id, competitions.ownerId))
    .orderBy(desc(competitions.createdAt));

  if (rows.length === 0) return NextResponse.json([]);

  const ids = rows.map((r) => r.id);
  const [questionCounts, participantCounts] = await Promise.all([
    db.select({ competitionId: questions.competitionId, id: questions.id }).from(questions).where(inArray(questions.competitionId, ids)),
    db.select({ competitionId: participants.competitionId, id: participants.id }).from(participants).where(inArray(participants.competitionId, ids)),
  ]);
  const qCount = new Map<string, number>();
  for (const r of questionCounts) qCount.set(r.competitionId, (qCount.get(r.competitionId) ?? 0) + 1);
  const pCount = new Map<string, number>();
  for (const r of participantCounts) pCount.set(r.competitionId, (pCount.get(r.competitionId) ?? 0) + 1);

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      status: r.status,
      owner_id: r.ownerId,
      owner_name: r.ownerName,
      created_at: r.createdAt.toISOString(),
      question_count: qCount.get(r.id) ?? 0,
      participant_count: pCount.get(r.id) ?? 0,
    }))
  );
}
