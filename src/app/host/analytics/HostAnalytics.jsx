"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { listMyLiveGames } from "@/services/quizzes";
import { getGameAnalytics } from "@/services/analytics";

const STATUS_BADGE = {
  waiting: { variant: "info", label: "Waiting for players" },
  running: { variant: "success", label: "Running" },
  paused: { variant: "warning", label: "Paused" },
  finished: { variant: "neutral", label: "Finished" },
  cancelled: { variant: "neutral", label: "Cancelled" },
};

const OUTCOME_BADGE = {
  finished: { variant: "neutral", label: "Finished" },
  cancelled: { variant: "neutral", label: "Cancelled" },
  running: { variant: "success", label: "Running" },
  waiting: { variant: "info", label: "Waiting" },
  paused: { variant: "warning", label: "Paused" },
};

function formatDuration(ms) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function StatCard({ label, value, hint }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

/**
 * HostAnalytics — per-game dashboards: avg score/accuracy, response times and
 * most-missed questions, computed server-side (game_analytics, owner only).
 */
export default function HostAnalytics() {
  const { toast } = useToast();
  const [games, setGames] = useState(null);
  const [gamesError, setGamesError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [analyticsKey, setAnalyticsKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMyLiveGames()
      .then((items) => {
        if (cancelled) return;
        setGames(items);
        const first = items.find((g) => g.status === "finished") ?? items[0];
        if (first) setSelectedId(first.id);
      })
      .catch((err) => {
        console.error("Failed to load games for analytics:", err);
        if (!cancelled) setGamesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setAnalytics(null);
    setAnalyticsError(false);
    getGameAnalytics(selectedId)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        console.error("Failed to load game analytics:", err);
        if (!cancelled) setAnalyticsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, analyticsKey]);

  const gamesCount = games?.length ?? 0;

  if (gamesError) {
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
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        <Card className="mt-6">
          <EmptyState
            title="No games yet"
            description="Launch a quiz to see score, accuracy and response-time stats here."
          >
            <Button href="/host/quizzes">Open my quizzes</Button>
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Analytics</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Score, accuracy, response time and the questions your players missed.
          </p>
        </div>
        <Button variant="outline" size="sm" href="/host/games">
          Manage games
        </Button>
      </div>

      {gamesCount > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Games launched" value={gamesCount} />
          <StatCard
            label="Players"
            value={analytics ? analytics.participants_count : "—"}
            hint={analytics ? `In ${analytics.code}` : undefined}
          />
          <StatCard
            label="Questions"
            value={analytics ? analytics.questions_count : "—"}
            hint={analytics ? `In ${analytics.code}` : undefined}
          />
          <StatCard
            label="Answers"
            value={analytics ? analytics.answers_count : "—"}
            hint={analytics ? `In ${analytics.code}` : undefined}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {games.map((game) => {
          const statusInfo = STATUS_BADGE[game.status] ?? { variant: "neutral", label: game.status };
          const selected = game.id === selectedId;
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => setSelectedId(game.id)}
              className={
                selected
                  ? "inline-flex items-center gap-2 rounded-md border border-primary bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary"
                  : "inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
              }
            >
              <span>{game.name}</span>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </button>
          );
        })}
      </div>

      {analyticsError && (
        <Card className="mt-6">
          <EmptyState
            title="Couldn't load the analytics"
            description="Try again, or pick another game."
          >
            <Button variant="outline" onClick={() => setAnalyticsKey((k) => k + 1)}>
              Retry
            </Button>
          </EmptyState>
        </Card>
      )}

      {analytics === null && !analyticsError && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {analytics && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Average score"
              value={analytics.avg_score.toLocaleString()}
              hint={analytics.answers_count === 0 ? "No answers yet" : undefined}
            />
            <StatCard
              label="Average accuracy"
              value={`${analytics.avg_accuracy}%`}
              hint={`${analytics.answers_count} answers`}
            />
            <StatCard
              label="Avg response time"
              value={formatDuration(analytics.avg_response_time_ms)}
            />
            <StatCard
              label="Players"
              value={analytics.participants_count}
              hint={`${analytics.questions_count} questions`}
            />
          </div>

          <Card className="mt-6" padding="lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Most-missed questions</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Questions players got wrong most often in game {analytics.code}.
                </p>
              </div>
              <Badge variant={(OUTCOME_BADGE[analytics.status] ?? {}).variant ?? "neutral"}>
                {(OUTCOME_BADGE[analytics.status] ?? {}).label ?? analytics.status}
              </Badge>
            </div>

            {analytics.most_missed.length === 0 ? (
              <EmptyState
                className="mt-4"
                title="Nothing missed"
                description="No wrong answers recorded for this game."
              />
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {analytics.most_missed.map((q) => (
                  <li key={q.position} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        <span className="mr-1.5 text-ink-muted">Q{q.position}</span>
                        {q.text}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {q.incorrect_count} wrong · {q.accuracy}% correct · avg{" "}
                        {formatDuration(q.avg_response_time_ms)}
                      </p>
                    </div>
                    <Badge variant={q.accuracy >= 50 ? "success" : "warning"}>
                      {q.accuracy}% correct
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}