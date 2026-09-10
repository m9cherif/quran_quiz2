"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to /api/games/[id]/events (Server-Sent Events) for as long as
 * the component is mounted and `enabled` is true. `onEvent` is called with
 * `{type, payload}` for every event the corresponding write route emitted.
 *
 * This is push, not the only signal: every screen that uses this already
 * keeps its own polling fallback (a periodic re-fetch) alongside it, exactly
 * as it did when Supabase Realtime was the push channel — an SSE connection
 * can drop (proxy timeout, network blip) without the caller finding out
 * except by that fallback noticing state has gone stale.
 */
export function useRealtimeEvents(competitionId, onEvent, enabled = true) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !competitionId) return undefined;

    const source = new EventSource(`/api/games/${encodeURIComponent(competitionId)}/events`);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        onEventRef.current?.(event);
      } catch {
        // A comment/heartbeat line, or a malformed payload — either way, skip it.
      }
    };
    // No onerror handling beyond letting the browser's built-in reconnect
    // retry: the polling fallback already covers the gap while it does.

    return () => source.close();
  }, [competitionId, enabled]);
}

export default useRealtimeEvents;
