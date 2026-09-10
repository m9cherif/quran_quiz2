import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { classMembers } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/** Ports leave_class(p_class_id): silent no-op if not a member, matching the original. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  await db.delete(classMembers).where(and(eq(classMembers.classId, id), eq(classMembers.profileId, user.id)));
  return NextResponse.json({ ok: true });
}
