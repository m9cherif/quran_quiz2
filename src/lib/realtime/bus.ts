import { EventEmitter } from "node:events";

/**
 * Same-process realtime bus, replacing Supabase Realtime's postgres_changes
 * + broadcast + presence channels. One EventEmitter per competition id,
 * kept in a module-level map for the life of the server process.
 *
 * Deliberate limitation: this only works correctly on a single Node
 * process — an event emitted from a request handled by process A never
 * reaches an SSE connection held open on process B. Fine for this hosting
 * tier (one persistent process); would need a real pub/sub (e.g. Redis) if
 * that ever changes.
 *
 * Every write route calls emit() after its DB write succeeds; the SSE route
 * (src/app/api/games/[id]/events/route.ts) is the only subscriber.
 */

const buses = new Map<string, EventEmitter>();
// Emitters with many listeners (a popular live game) shouldn't warn.
const MAX_LISTENERS = 500;

function busFor(competitionId: string): EventEmitter {
  let bus = buses.get(competitionId);
  if (!bus) {
    bus = new EventEmitter();
    bus.setMaxListeners(MAX_LISTENERS);
    buses.set(competitionId, bus);
  }
  return bus;
}

export type RealtimeEventType =
  | "status-changed"
  | "question-started"
  | "question-updated"
  | "question-ended"
  | "deck-updated"
  | "participant-joined"
  | "participant-left"
  | "participant-updated"
  | "answer-received"
  | "presence"
  | "call-signal";

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: unknown;
}

/** Called by write routes right after a successful DB change. */
export function emit(competitionId: string, event: RealtimeEvent): void {
  busFor(competitionId).emit("event", event);
}

/** Called by the SSE route; returns an unsubscribe function. */
export function subscribe(competitionId: string, onEvent: (event: RealtimeEvent) => void): () => void {
  const bus = busFor(competitionId);
  bus.on("event", onEvent);
  return () => {
    bus.off("event", onEvent);
    // Nothing listening and nothing left to emit for — let it be
    // garbage-collected rather than accumulating one entry per game forever.
    if (bus.listenerCount("event") === 0) buses.delete(competitionId);
  };
}
