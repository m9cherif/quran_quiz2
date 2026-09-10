import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classMembers, classes, competitions } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { generateClassCode } from "@/lib/db/classCode";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { toClassRowJson } from "./_lib";

export const runtime = "nodejs";

/**
 * Ports list_my_classes() (supabase/migrations/20260810121600_classes.sql):
 * the caller's own classes (owner_id = caller), including archived ones,
 * with member/game counts, newest first.
 */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(classes)
    .where(eq(classes.ownerId, user.id))
    .orderBy(desc(classes.createdAt));

  if (rows.length === 0) return NextResponse.json([]);

  const ids = rows.map((r) => r.id);
  const [memberRows, gameRows] = await Promise.all([
    db.select({ classId: classMembers.classId }).from(classMembers).where(inArray(classMembers.classId, ids)),
    db.select({ classId: competitions.classId }).from(competitions).where(inArray(competitions.classId, ids)),
  ]);

  const memberCount = new Map<string, number>();
  for (const r of memberRows) memberCount.set(r.classId, (memberCount.get(r.classId) ?? 0) + 1);
  const gameCount = new Map<string, number>();
  for (const r of gameRows) {
    if (!r.classId) continue;
    gameCount.set(r.classId, (gameCount.get(r.classId) ?? 0) + 1);
  }

  return NextResponse.json(
    rows.map((row) => ({
      ...toClassRowJson(row),
      member_count: memberCount.get(row.id) ?? 0,
      game_count: gameCount.get(row.id) ?? 0,
    }))
  );
}

/** Ports create_class(p_name, p_description): 2-60 char name, code auto-generated. */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { name?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Class name must be between 2 and 60 characters", code: "22023" },
      { status: 400 }
    );
  }
  const descriptionRaw = typeof body.description === "string" ? body.description.trim() : "";
  const description = descriptionRaw ? descriptionRaw : null;

  const db = getDb();
  const id = newId();
  const code = await generateClassCode(db);
  await db.insert(classes).values({ id, ownerId: user.id, name, description, code });

  const rows = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  return NextResponse.json(toClassRowJson(rows[0]));
}
