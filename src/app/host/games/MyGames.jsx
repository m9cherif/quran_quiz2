"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { listMyLiveGames, setQuizStatus } from "@/services/quizzes";

const STATUS_BADGE = {
  waiting: { variant: "info", label: "Waiting for players" },
  running: { variant: "success", label: "Running" },
  paused: { variant: "warning", label: "Paused" },
  finished: { variant: "neutral", label: "Finished" },
  cancelled: { variant: "neutral", label: "Cancelled" },
};

/**
 * MyGames — live games owned by this host (non-draft competitions).
 * The control room opens from here; launching a draft happens from the
 * quiz editor (Phase 7).
 */
export default function MyGames() {
  const { toast } = useToast();
  const [games, setGames] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMyLiveGames()
      .then((items) => {
        if (!cancelled) setGames(items);
      })
      .catch((err) => {
        console.error("Failed to load live games:", err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cancel = async (game) => {
    try {
      await setQuizStatus(game.id, "cancelled");
      setGames((prev) => (prev ?? []).map((g) => (g.id === game.id ? { ...g, status: "cancelled" } : g)));
      toast({ title: "Game cancelled", description: `${game.name} was stopped.`, variant: "info" });
    } catch (err) {
      console.error("Cancel failed:", err);
      toast({ title: "Could not cancel", description: "Try again.", variant: "error" });
    }
  };

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Couldn't load your games"
          description="Check your connection and try again."
        >
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </EmptyState>
      </Card>
    );
  }

  if (games === null) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Live games</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Games you launched. Open a control room to run a round.
          </p>
        </div>
        <Button href="/host/quizzes">Browse quizzes</Button>
      </div>

      {games.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title="No live games yet"
            description="Pick a quiz from your library and launch it — students join with the room code."
          >
            <Button href="/host/quizzes">Open my quizzes</Button>
          </EmptyState>
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {games.map((game) => {
            const statusInfo = STATUS_BADGE[game.status] ?? { variant: "neutral", label: game.status };
            return (
            <li key={game.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-sm font-semibold text-ink-muted">
                  {game.code.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{game.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="neutral">Code {game.code}</Badge>
                    <Badge variant={statusInfo.variant} dot>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(game.status === "waiting" || game.status === "paused" || game.status === "running") && (
                  <Button variant="ghost" size="sm" onClick={() => cancel(game)}>
                    Cancel
                  </Button>
                )}
                <Button size="sm" href={`/host/games/${game.code}`}>
                  Open control room
                </Button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}