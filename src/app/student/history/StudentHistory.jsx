"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { getMyHistory } from "@/services/analytics";

const STATUS_BADGE = {
  finished: { variant: "neutral", label: "Finished" },
  cancelled: { variant: "neutral", label: "Cancelled" },
  running: { variant: "success", label: "Running" },
  waiting: { variant: "info", label: "Waiting" },
  paused: { variant: "warning", label: "Paused" },
};

function StatusBadge({ status }) {
  const info = STATUS_BADGE[status] ?? { variant: "neutral", label: status };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

/**
 * StudentHistory — full table of the signed-in user's games with score,
 * correct answers and accuracy per game (my_history, own rows only).
 */
export default function StudentHistory() {
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyHistory()
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((err) => {
        console.error("Failed to load history:", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <Card>
        <EmptyState
          title="Couldn't load your history"
          description="Check your connection and try again."
        >
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </EmptyState>
      </Card>
    );
  }

  if (history === null) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
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
          <h1 className="text-2xl font-bold text-ink">Game history</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Every game you joined while signed in, with your score and accuracy.
          </p>
        </div>
        <Button href="/join">Join a game</Button>
      </div>

      {history.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title="No games recorded"
            description="Sign in and join a live game to start building your history."
          >
            <Button href="/join">Join a game</Button>
          </EmptyState>
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {history.map((h) => (
            <li key={h.competition_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Code {h.code} · joined {new Date(h.joined_at).toLocaleString()}
                  {h.finished_at && ` · finished ${new Date(h.finished_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-ink-muted">
                  {h.correct_count}/{h.answered_count} correct
                </span>
                <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-md bg-surface-3 px-2 font-semibold text-ink">
                  {h.accuracy}%
                </span>
                <span className="font-semibold text-ink">{h.score.toLocaleString()} pts</span>
                <StatusBadge status={h.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}