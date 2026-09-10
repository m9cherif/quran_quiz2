/**
 * Same-process heartbeat+TTL presence, replacing Supabase Presence (which
 * auto-detected disconnects via the WebSocket closing — SSE has no
 * equivalent, since it's server->client only and a dropped connection isn't
 * distinguishable from a quiet one without extra plumbing). Callers touch()
 * on an interval; an entry not touched within TTL_MS is treated as gone.
 *
 * Same same-process-only limitation as bus.ts: this is a module-level Map,
 * not shared across processes. Fine for this hosting tier (one persistent
 * process); would need a real store (e.g. Redis) if that ever changes.
 */

interface Entry {
  meta: unknown;
  lastSeen: number;
}

const rooms = new Map<string, Map<string, Entry>>();
export const TTL_MS = 15000;

function roomFor(roomId: string): Map<string, Entry> {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Map();
    rooms.set(roomId, room);
  }
  return room;
}

/** Upsert a room member and refresh its lastSeen (call on join and on every heartbeat). */
export function touch(roomId: string, key: string, meta: unknown): void {
  roomFor(roomId).set(key, { meta, lastSeen: Date.now() });
}

/** Remove a room member immediately (best-effort explicit leave). */
export function leave(roomId: string, key: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.delete(key);
  if (room.size === 0) rooms.delete(roomId);
}

/** Members touched within the last TTL_MS; stale entries are opportunistically pruned while reading. */
export function snapshot(roomId: string): Array<{ key: string; meta: unknown }> {
  const room = rooms.get(roomId);
  if (!room) return [];
  const now = Date.now();
  const out: Array<{ key: string; meta: unknown }> = [];
  for (const [key, entry] of room) {
    if (now - entry.lastSeen > TTL_MS) {
      room.delete(key);
      continue;
    }
    out.push({ key, meta: entry.meta });
  }
  if (room.size === 0) rooms.delete(roomId);
  return out;
}
