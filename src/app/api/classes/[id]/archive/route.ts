import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classes } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/** Ports archive_class(p_class_id): owner only, 404 (errcode 42501) if 0 rows affected. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const [result] = await db
    .update(classes)
    .set({ archivedAt: new Date() })
    .where(and(eq(classes.id, id), eq(classes.ownerId, user.id)));
  if (result.affectedRows === 0) {
    return NextResponse.json({ error: "Class not found", code: "42501" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
