import { NextResponse } from "next/server";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/**
 * WebRTC signalling relay for useCall.js, replacing the raw Supabase
 * Broadcast channel it used to send hello/offer/answer/ice/bye/host-control
 * messages over. No auth check, matching the old broadcast channel (which
 * had none either) — students and the host relay through it symmetrically.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = await params;
  let body: { event?: unknown; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const event = typeof body.event === "string" ? body.event : "";
  if (!event) return NextResponse.json({ error: "event is required" }, { status: 400 });

  emit(competitionId, { type: "call-signal", payload: { event, payload: body.payload ?? {} } });
  return NextResponse.json({ ok: true });
}
