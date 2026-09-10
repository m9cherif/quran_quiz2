import { NextResponse } from "next/server";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions } from "@/lib/db/schema";
import { errorResponse } from "@/lib/games/errors";

export const runtime = "nodejs";

/** Ports listOpenGames(): waiting lobbies, plus late-joinable running/paused games. */
export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: competitions.id,
        code: competitions.code,
        title: competitions.title,
        name: competitions.name,
        language: competitions.language,
        category: competitions.category,
        status: competitions.status,
        createdAt: competitions.createdAt,
      })
      .from(competitions)
      .where(
        and(
          or(eq(competitions.status, "waiting"), and(eq(competitions.allowLateJoin, true), inArray(competitions.status, ["running", "paused"]))),
          eq(competitions.joinLocked, false),
          ne(competitions.visibility, "private")
        )
      )
      .orderBy(desc(competitions.createdAt))
      .limit(30);

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        name: r.name,
        language: r.language,
        category: r.category,
        status: r.status,
        created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
