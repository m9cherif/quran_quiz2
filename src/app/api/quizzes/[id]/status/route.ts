import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

const STATUSES = new Set([
  "draft",
  "scheduled",
  "waiting",
  "running",
  "paused",
  "finished",
  "cancelled",
]);

/** Ports setQuizStatus — a plain owner-gated status update (no other side effects, same as the old code). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({ ownerId: competitions.ownerId })
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.ownerId !== user.id) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 403 });
  }

  await db.update(competitions).set({ status }).where(eq(competitions.id, id));
  return NextResponse.json({ ok: true });
}
