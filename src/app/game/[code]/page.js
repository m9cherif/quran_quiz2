"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import useSupabase from "@/app/hooks/useSupabase";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

/**
 * GameLobby — student waiting room. Listens for the host's "Start"
 * broadcast on the game code channel, then moves to the question screen.
 */
export default function GameLobby() {
  const supabase = useSupabase();
  const router = useRouter();
  const [error, setError] = useState("");
  const participant = useSelector((state) => state.participant.Participant);

  const roomKey = typeof participant?.room_key === "string" ? participant.room_key : null;

  useEffect(() => {
    if (!roomKey) return;

    const channel = supabase.channel(roomKey);

    channel.on("broadcast", { event: "cursor-pos" }, (payload) => {
      const message = payload?.payload?.message;
      if (message === "Start") {
        router.push(`/game/${roomKey}/question`);
      }
    });

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setError("Lost connection to the game server. Please refresh.");
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, roomKey, router]);

  if (!roomKey) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">Session expired</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your game session is missing. Join again with the game code.
          </p>
          <Button href="/join" className="mt-6 w-full">
            Join a game
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 px-4">
      <Card padding="lg" className="w-full max-w-sm text-center">
        <p className="text-sm font-medium text-ink-muted">Game code</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-primary">
          {String(roomKey)}
        </p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <p className="text-sm font-medium text-ink">Waiting for the host to start…</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="primary">{participant.name || "You"}</Badge>
          <Badge>Not yet started</Badge>
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </Card>

      <Link
        href="/join"
        className="mt-4 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Leave the lobby
      </Link>
    </div>
  );
}