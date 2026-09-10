import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/** Ports archive_quiz (supabase/migrations/20260810121100_quiz_library_rpcs.sql): owner + draft only. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const rows = await db
    .select({ ownerId: competitions.ownerId, status: competitions.status })
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.ownerId !== user.id || row.status !== "draft") {
    return NextResponse.json({ error: "Quiz not found or not editable" }, { status: 403 });
  }

  await db
    .update(competitions)
    .set({ archivedAt: new Date() })
    .where(
      and(eq(competitions.id, id), eq(competitions.ownerId, user.id), eq(competitions.status, "draft"))
    );
  return NextResponse.json({ ok: true });
}
