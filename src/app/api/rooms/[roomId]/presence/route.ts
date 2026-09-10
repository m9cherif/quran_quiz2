import { NextResponse } from "next/server";
import { touch, leave, snapshot } from "@/lib/realtime/presence";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/**
 * Generic presence room, backing both the game roster (useGamePresence.js,
 * roomId = competitionId) and the call roster (useCall.js, roomId =
 * `call-${competitionId}`) — one Map-backed primitive, two independent
 * namespaces that fall out for free from the string key.
 *
 * No auth check on any of these, mirroring Supabase Presence/Broadcast,
 * which had none either: anyone who can reach the SSE stream for a
 * competition could already track/broadcast on it.
 */

/** A `call-${id}` room's underlying competition id — that's what the SSE bus is keyed by. */
function competitionIdFor(roomId: string): string {
  return roomId.startsWith("call-") ? roomId.slice("call-".length) : roomId;
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  let body: { key?: unknown; meta?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key : "";
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  touch(roomId, key, body.meta ?? null);
  emit(competitionIdFor(roomId), { type: "presence", payload: {} });
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return NextResponse.json(snapshot(roomId));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key : "";
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  leave(roomId, key);
  emit(competitionIdFor(roomId), { type: "presence", payload: {} });
  return NextResponse.json({ ok: true });
}
