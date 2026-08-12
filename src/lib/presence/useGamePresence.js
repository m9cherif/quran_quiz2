"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Who is actually in the game right now.
 *
 * `participants.connected` could never answer this: update_presence only ever
 * wrote `true`, and nothing wrote `false`, so every player who had ever joined
 * showed as online for the rest of the game. Realtime Presence knows the
 * difference — a closed tab, a refresh or a dead connection drops out of the
 * roster on its own.
 *
 * Students call it with their participant id to appear; the host calls it with
 * none and just watches.
 */
export function useGamePresence(competitionId, { participantId, name } = {}) {
  const [onlineIds, setOnlineIds] = useState([]);

  useEffect(() => {
    if (!competitionId) return;

    const channel = getSupabase().channel(`presence-${competitionId}`, {
      config: { presence: { key: participantId || `watcher-${Math.random().toString(36).slice(2)}` } },
    });

    const readRoster = () => {
      const state = channel.presenceState();
      const ids = [];
      for (const entries of Object.values(state)) {
        const meta = entries[entries.length - 1];
        // Watchers (the host) carry no participant id and are not players.
        if (meta?.pid) ids.push(meta.pid);
      }
      setOnlineIds(ids);
    };

    channel
      .on("presence", { event: "sync" }, readRoster)
      .on("presence", { event: "join" }, readRoster)
      .on("presence", { event: "leave" }, readRoster)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        // Only players announce themselves.
        if (participantId) await channel.track({ pid: participantId, name: name ?? "" });
      });

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [competitionId, participantId, name]);

  return useMemo(() => new Set(onlineIds), [onlineIds]);
}

export default useGamePresence;
