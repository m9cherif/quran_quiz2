"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { getMyHistory } from "@/services/analytics";

function StatCard({ label, value, hint }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

function GameStatusBadge({ status }) {
  const map = {
    finished: { variant: "neutral", label: "Finished" },
    cancelled: { variant: "neutral", label: "Cancelled" },
    running: { variant: "success", label: "Running" },
    waiting: { variant: "info", label: "Waiting" },
    paused: { variant: "warning", label: "Paused" },
  };
  const info = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

/**
 * StudentDashboard — progress overview from the signed-in user's own game
 * history (my_history): games played, scores, accuracy, recent games.
 */
export default function StudentDashboard() {
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
          title="Couldn't load your progress"
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const played = history.filter((h) => h.answered_count > 0);
  const avgScore =
    played.length > 0
      ? Math.round((played.reduce((acc, h) => acc + h.score, 0) / played.length) * 10) / 10
      : 0;
  const avgAccuracy =
    played.length > 0
      ? Math.round((played.reduce((acc, h) => acc + h.accuracy, 0) / played.length) * 10) / 10
      : 0;
  const best = played.length > 0 ? Math.max(...played.map((h) => h.score)) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">My progress</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Your game history follows your account — sign in before joining to track it.
          </p>
        </div>
        <Button href="/join">Join a game</Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Games played" value={played.length} hint={`${history.length} joined`} />
        <StatCard label="Average score" value={avgScore.toLocaleString()} />
        <StatCard label="Average accuracy" value={`${avgAccuracy}%`} />
        <StatCard label="Best score" value={best.toLocaleString()} />
      </div>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg font-semibold text-ink">Recent games</h2>
        {history.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No games yet"
            description="Join a live game with the code your host shows — results will appear here."
          >
            <Button href="/join">Join a game</Button>
          </EmptyState>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {history.slice(0, 5).map((h) => (
              <li key={h.competition_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Code {h.code} · joined{" "}
                    {new Date(h.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink-muted">
                    {h.correct_count}/{h.answered_count} · {h.accuracy}%
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {h.score.toLocaleString()} pts
                  </span>
                  <GameStatusBadge status={h.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}