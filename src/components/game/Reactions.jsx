"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { playCue } from "@/lib/sound";
import { useI18n } from "@/lib/i18n/I18nProvider";

export const REACTIONS = ["👏", "🔥", "😮", "🤲", "😀"];

/**
 * Reactions — lightweight classroom presence.
 * Emoji travel over the realtime broadcast channel the control room already
 * opens for deck nudges, so they cost no database writes and disappear on
 * their own. Send is rate limited per client: a tap-happy student cannot
 * flood the room.
 */
export function useReactions(competitionId, { listen = true } = {}) {
  const [floating, setFloating] = useState([]);
  const channelRef = useRef(null);
  const lastSentRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    if (!competitionId) return;
    // Its own topic on purpose: the control room and the student screen both
    // already hold a `room-{id}` channel for deck nudges, and a second channel
    // with the same topic on one client is not delivered — which is why
    // reactions never reached the host.
    const channel = getSupabase().channel(`reactions-${competitionId}`, {
      config: { broadcast: { self: false } },
    });
    if (listen) {
      channel.on("broadcast", { event: "reaction" }, (payload) => {
        const emoji = payload?.payload?.emoji;
        if (!REACTIONS.includes(emoji)) return;
        const id = ++idRef.current;
        setFloating((prev) => [...prev.slice(-24), { id, emoji, left: 5 + Math.random() * 90 }]);
        setTimeout(() => {
          setFloating((prev) => prev.filter((f) => f.id !== id));
        }, 2600);
      });
    }
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      getSupabase().removeChannel(channel);
      channelRef.current = null;
    };
  }, [competitionId, listen]);

  const send = useCallback((emoji) => {
    const now = Date.now();
    if (now - lastSentRef.current < 900) return; // ~1 per second per device
    lastSentRef.current = now;
    playCue("pop");
    channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
  }, []);

  return { floating, send };
}

/** The floating emoji layer — drop it inside a `relative` container. */
export function ReactionLayer({ floating }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {floating.map((f) => (
        <span
          key={f.id}
          className="absolute bottom-0 animate-[reaction-rise_2.4s_ease-out_forwards] text-3xl"
          style={{ left: `${f.left}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}

/** The student's tap bar. */
export function ReactionBar({ onSend, className = "" }) {
  const { t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("react.aria")}
      className={`flex flex-wrap justify-center gap-2 ${className}`}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSend(emoji)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xl transition-transform hover:scale-110 active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default ReactionBar;
