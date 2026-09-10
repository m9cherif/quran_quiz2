import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { errorResponse } from "@/lib/games/errors";
import { serializeCompetition } from "@/lib/games/serialize";

export const runtime = "nodejs";

const VISIBLE_STATUSES = new Set(["waiting", "running", "paused", "finished"]);

/**
 * Ports getGameByCode() + the RLS visibility rule on `competitions`
 * ("competitions_select_visible"): owner always sees their own row; anyone
 * else only sees it once it's out of draft. Not found or not (yet) visible
 * both come back as `null`, same as the old .maybeSingle() call.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const db = getDb();
    const rows = await db
      .select()
      .from(competitions)
      .where(sql`upper(${competitions.code}) = ${code.trim().toUpperCase()}`)
      .limit(1);
    const comp = rows[0];
    if (!comp) return NextResponse.json(null);

    const user = await getSessionUserFromCookies();
    const visible = comp.ownerId === null || (user && comp.ownerId === user.id) || VISIBLE_STATUSES.has(comp.status);
    if (!visible) return NextResponse.json(null);

    return NextResponse.json(serializeCompetition(comp));
  } catch (err) {
    return errorResponse(err);
  }
}
