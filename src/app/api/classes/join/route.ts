import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classMembers, classes } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { dupKeyCode, toClassRowJson } from "../_lib";

export const runtime = "nodejs";

/**
 * Ports join_class(p_code) (supabase/migrations/20260810121600_classes.sql):
 * looks up by upper(code) = upper(trim(p_code)); 404s (errcode 28000, kept
 * so JoinGameForm.jsx's `err.code === "28000"` check still fires) on a
 * missing or archived class; idempotent membership insert.
 */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  const db = getDb();
  const rows = await db.select().from(classes).where(eq(classes.code, code)).limit(1);
  const row = rows[0];
  if (!row || row.archivedAt !== null) {
    return NextResponse.json(
      { error: "Class not found or no longer open", code: "28000" },
      { status: 404 }
    );
  }

  try {
    await db.insert(classMembers).values({ classId: row.id, profileId: user.id });
  } catch (err: unknown) {
    // Composite PK (class_id, profile_id) — already a member is a no-op
    // success, same as the old `on conflict do nothing`. Drizzle wraps the
    // driver error, so the mysql2 error code can be on the wrapper or on
    // its `cause`.
    const code = dupKeyCode(err);
    if (code !== "ER_DUP_ENTRY") throw err;
  }

  return NextResponse.json(toClassRowJson(row));
}
