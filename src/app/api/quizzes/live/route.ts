import { NextResponse } from "next/server";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

/** Ports listMyLiveGames: non-draft, non-archived competitions the caller owns. */
export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.ownerId, user.id),
        ne(competitions.status, "draft"),
        isNull(competitions.archivedAt)
      )
    )
    .orderBy(desc(competitions.createdAt));

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      visibility: row.visibility,
      cover_url: row.coverUrl,
      language: row.language,
      category: row.category,
      difficulty: row.difficulty,
      default_points: row.defaultPoints,
      default_negative_points: row.defaultNegativePoints,
      speed_bonus_enabled: row.speedBonusEnabled,
      created_at: row.createdAt ? row.createdAt.toISOString() : null,
      updated_at: row.updatedAt ? row.updatedAt.toISOString() : null,
    }))
  );
}
