import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { classes, competitions, participants } from "@/lib/db/schema";
import { newId, newToken } from "@/lib/db/id";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { serializeParticipant } from "@/lib/games/serialize";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/**
 * Ports join_competition(p_code, p_display_name, p_profile_id). Anonymous
 * players just send a code + a nickname; a signed-in student additionally
 * passes their own user id (checked against the session, not trusted blind)
 * so the game links into their history.
 */
export async function POST(request: Request) {
  let body: { code?: unknown; displayName?: unknown; profileId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const displayName = typeof body.displayName === "string" ? body.displayName : "";
  const profileId = typeof body.profileId === "string" && body.profileId ? body.profileId : null;

  try {
    const db = getDb();

    // p_profile_id is only accepted when it matches the caller's own session
    // — a student cannot link a game to someone else's history.
    if (profileId) {
      const user = await getSessionUserFromCookies();
      if (!user || profileId !== user.id) {
        throw new GameError("42501", "Profile link does not match the current session");
      }
    }

    const lookup = code.trim().toUpperCase();
    const display = displayName.trim();

    const compRows = await db
      .select()
      .from(competitions)
      .where(sql`upper(${competitions.code}) = ${lookup}`)
      .limit(1);
    const comp = compRows[0] ?? null;

    if (comp && comp.status === "draft") {
      throw new GameError("P0003", "This quiz has not been launched yet");
    }
    if (!comp) {
      const classRows = await db
        .select({ id: classes.id })
        .from(classes)
        .where(sql`upper(${classes.code}) = ${lookup}`)
        .limit(1);
      if (classRows[0]) {
        throw new GameError("P0004", "That code is a class code, not a game code");
      }
    }
    if (comp && comp.joinLocked) {
      throw new GameError("P0005", "The host has locked this game");
    }
    const canJoin =
      comp && (comp.status === "waiting" || (["running", "paused"].includes(comp.status) && comp.allowLateJoin));
    if (!canJoin) {
      throw new GameError("28000", "This game is not open to join");
    }
    if (display.length < 2 || display.length > 50) {
      throw new GameError("22023", "Display name must be between 2 and 50 characters");
    }

    const id = newId();
    const participantCode = newToken(24);
    const accessToken = newToken(24);

    try {
      await db.insert(participants).values({
        id,
        competitionId: comp!.id,
        displayName: display,
        participantCode,
        accessToken,
        profileId,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "ER_DUP_ENTRY") {
        throw new GameError("23505", "That display name is already taken in this game");
      }
      throw err;
    }

    const row = await getParticipantRow(db, id);
    emit(comp!.id, { type: "participant-joined", payload: row });
    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}

async function getParticipantRow(db: Db, id: string) {
  const rows = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
  return serializeParticipant(rows[0]);
}
