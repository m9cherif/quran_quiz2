"use client";

import { useEffect, useMemo, useState } from "react";
import { useRealtimeEvents } from "@/lib/realtime/useRealtimeEvents";

const HEARTBEAT_MS = 8000;
const POLL_MS = 4000;

/** Watchers (the host) carry no participant id and are not players. */
function pidsFromRoster(entries) {
  const ids = [];
  for (const entry of entries) {
    const pid = entry?.meta?.pid;
    if (pid) ids.push(pid);
  }
  return ids;
}

/**
 * Who is actually in the game right now.
 *
 * `participants.connected` could never answer this: update_presence only ever
 * wrote `true`, and nothing wrote `false`, so every player who had ever joined
 * showed as online for the rest of the game. Supabase Realtime Presence used
 * to know the difference via the socket closing; SSE has no equivalent (it's
 * server->client only), so this is a heartbeat+TTL primitive instead
 * (src/lib/realtime/presence.ts) — push (an SSE "presence" nudge) plus a
 * polling floor that's actually correct, same pattern as the rest of this
 * app's realtime.
 *
 * Students call it with their participant id to appear; the host calls it
 * with none and just watches.
 */
export function useGamePresence(competitionId, { participantId, name } = {}) {
  const [onlineIds, setOnlineIds] = useState([]);

  useEffect(() => {
    if (!competitionId) return undefined;

    let cancelled = false;

    const fetchRoster = async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(competitionId)}/presence`);
        if (!res.ok) return;
        const entries = await res.json();
        if (cancelled) return;
        setOnlineIds(pidsFromRoster(entries));
      } catch {
        // Poll again on the next tick; the SSE nudge will also retry.
      }
    };

    fetchRoster();
    const pollTimer = setInterval(fetchRoster, POLL_MS);

    let heartbeatTimer;
    if (participantId) {
      const announce = () => {
        fetch(`/api/rooms/${encodeURIComponent(competitionId)}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: participantId, meta: { pid: participantId, name: name ?? "" } }),
        }).catch(() => {});
      };
      announce();
      heartbeatTimer = setInterval(announce, HEARTBEAT_MS);
    }

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (participantId) {
        try {
          fetch(`/api/rooms/${encodeURIComponent(competitionId)}/presence`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: participantId }),
            keepalive: true,
          });
        } catch {
          // Best-effort — the TTL in presence.ts is the real disconnect detector.
        }
      }
    };
  }, [competitionId, participantId, name]);

  useRealtimeEvents(
    competitionId,
    (event) => {
      if (event?.type !== "presence") return;
      fetch(`/api/rooms/${encodeURIComponent(competitionId)}/presence`)
        .then((res) => (res.ok ? res.json() : null))
        .then((entries) => {
          if (entries) setOnlineIds(pidsFromRoster(entries));
        })
        .catch(() => {});
    },
    Boolean(competitionId)
  );

  return useMemo(() => new Set(onlineIds), [onlineIds]);
}

export default useGamePresence;
