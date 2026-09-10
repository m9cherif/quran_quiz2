import { NextResponse } from "next/server";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions, participants } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { isClassMember, isClassOwner } from "@/lib/db/classMembership";
import { emit } from "@/lib/realtime/bus";
import { dupKeyCode } from "../../_lib";

export const runtime = "nodejs";

/** Ports list_class_games(p_class_id): caller must be a member of the class OR its owner. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const db = getDb();
  const allowed = (await isClassMember(db, id, user.id)) || (await isClassOwner(db, id, user.id));
  if (!allowed) {
    return NextResponse.json({ error: "Class not found", code: "42501" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.classId, id), ne(competitions.status, "draft"), isNull(competitions.archivedAt)))
    .orderBy(desc(competitions.createdAt));

  if (rows.length === 0) return NextResponse.json([]);

  const joinedRows = await db
    .select({ competitionId: participants.competitionId })
    .from(participants)
    .where(and(eq(participants.profileId, user.id)));
  const joined = new Set(joinedRows.map((r) => r.competitionId));

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      name: row.name,
      status: row.status,
      created_at: row.createdAt.toISOString(),
      already_joined: joined.has(row.id),
      class_can_join: row.classCanJoin,
    }))
  );
}

const JOINABLE_STATUSES = new Set(["waiting", "running", "paused"]);

/**
 * Ports join_class_game(p_competition_id, p_display_name): membership is the
 * invitation, so a rejoin (existing participant row for this caller) ignores
 * the class_can_join/status gates entirely, matching the original.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await params; // route grouping only — join_class_game is keyed off the competition, not this path segment

  let body: { competitionId?: unknown; displayName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const competitionId = typeof body.competitionId === "string" ? body.competitionId : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

  const db = getDb();
  const compRows = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  const comp = compRows[0];
  if (!comp || !comp.classId) {
    return NextResponse.json({ error: "This game does not belong to a class" }, { status: 404 });
  }

  if (!(await isClassMember(db, comp.classId, user.id))) {
    return NextResponse.json({ error: "You are not a member of this class", code: "42501" }, { status: 403 });
  }

  const existingRows = await db
    .select()
    .from(participants)
    .where(and(eq(participants.competitionId, comp.id), eq(participants.profileId, user.id)))
    .limit(1);
  if (existingRows[0]) {
    return NextResponse.json(toParticipantJson(existingRows[0]));
  }

  if (!comp.classCanJoin) {
    return NextResponse.json(
      { error: "The teacher has closed class entry for this game", code: "28000" },
      { status: 403 }
    );
  }
  if (!JOINABLE_STATUSES.has(comp.status)) {
    return NextResponse.json({ error: "This game is not running", code: "28000" }, { status: 409 });
  }
  if (displayName.length < 2 || displayName.length > 50) {
    return NextResponse.json(
      { error: "Display name must be between 2 and 50 characters", code: "22023" },
      { status: 400 }
    );
  }

  const id = newId();
  try {
    await db.insert(participants).values({
      id,
      competitionId: comp.id,
      displayName,
      participantCode: newId(),
      accessToken: newId(),
      profileId: user.id,
    });
  } catch (err: unknown) {
    if (dupKeyCode(err) === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "That display name is already taken in this game", code: "23505" },
        { status: 409 }
      );
    }
    throw err;
  }

  const rows = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
  const row = rows[0];
  const json = toParticipantJson(row);
  emit(comp.id, { type: "participant-joined", payload: json });
  return NextResponse.json(json);
}

function toParticipantJson(row: typeof participants.$inferSelect) {
  return {
    id: row.id,
    competition_id: row.competitionId,
    display_name: row.displayName,
    first_name: row.firstName,
    last_name: row.lastName,
    participant_code: row.participantCode,
    access_token: row.accessToken,
    connected: row.connected,
    joined_at: row.joinedAt.toISOString(),
    last_seen_at: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    status: row.status,
    profile_id: row.profileId,
    team: row.team,
    bonus_award: row.bonusAward,
    avatar: row.avatar,
  };
}
