"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { listMyLiveGames } from "@/services/quizzes";
import { getGameAnalytics, getHostOverview } from "@/services/analytics";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { downloadTextFile, toCsv } from "@/lib/export";

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
  const { t } = useI18n();
  const [games, setGames] = useState(null);
  const [gamesError, setGamesError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [analyticsKey, setAnalyticsKey] = useState(0);
  const [overview, setOverview] = useState(null);

  const getStatusInfo = (status) => {
    const variants = {
      waiting: "info",
      running: "success",
      paused: "warning",
      finished: "neutral",
      cancelled: "neutral",
    };
    const labels = {
      waiting: t("host.gameBadgeWaiting"),
      running: t("host.gameBadgeRunning"),
      paused: t("host.gameBadgePaused"),
      finished: t("host.gameBadgeFinished"),
      cancelled: t("host.gameBadgeCancelled"),
    };
    return { variant: variants[status] ?? "neutral", label: labels[status] ?? status };
  };

  // Cross-game totals: one owner-scoped call, independent of the picker.
  useEffect(() => {
    let cancelled = false;
    getHostOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        console.error("Failed to load host overview:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  /** The most-missed table as CSV, for marking or a staff meeting. */
  const exportMissed = () => {
    if (!analytics) return;
    const csv = toCsv(
      [
        t("host.csvQuestionNo"),
        t("host.csvQuestion"),
        t("host.wrongAnswers"),
        t("host.averageAccuracy"),
        t("host.avgResponseTime"),
      ],
      (analytics.most_missed ?? []).map((q) => [
        q.position,
        q.text,
        q.incorrect_count,
        q.accuracy,
        q.avg_response_time_ms,
      ])
    );
    downloadTextFile(`most-missed-${analytics.code}.csv`, csv, "text/csv");
  };

  if (gamesError) {
    return (
      <Card>
        <EmptyState title={t("host.loadGamesFailed")} description={t("common.loadFailedDesc")}>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("common.tryAgain")}
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
        <h1 className="text-2xl font-bold text-ink">{t("host.analyticsTitle")}</h1>
        <Card className="mt-6">
          <EmptyState title={t("host.noGamesTitle")} description={t("host.noGamesDesc")}>
            <Button href="/host/quizzes" icon="book">{t("nav.myQuizzes")}</Button>
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("host.analyticsTitle")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t("host.analyticsSub")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportMissed} disabled={!analytics} icon="download">
            {t("host.exportCsv")}
          </Button>
          <Button variant="outline" size="sm" href="/host/games" icon="settings">
            {t("host.manageGames")}
          </Button>
        </div>
      </div>

      <section aria-label={t("host.allTimeHeading")} className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {t("host.allTimeHeading")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label={t("host.gamesLaunched")}
            value={overview ? overview.games_total : gamesCount}
            hint={overview ? t("host.gamesLiveNow", { count: overview.games_live }) : undefined}
          />
          <StatCard
            label={t("host.statStudentsReached")}
            value={overview ? overview.students_reached : "—"}
            hint={overview ? t("host.acrossPlayers", { count: overview.players_total }) : undefined}
          />
          <StatCard
            label={t("host.statAnswers")}
            value={overview ? overview.answers_total : "—"}
          />
          <StatCard
            label={t("host.averageAccuracy")}
            value={overview ? `${overview.avg_accuracy}%` : "—"}
            hint={t("host.allGames")}
          />
          <StatCard
            label={t("host.statQuestions")}
            value={overview ? overview.questions_total : "—"}
            hint={overview ? t("host.quizzesDrafted", { count: overview.quizzes_total }) : undefined}
          />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {games.map((game) => {
          const statusInfo = getStatusInfo(game.status);
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
            title={t("host.loadAnalyticsFailed")}
            description={t("host.pickAnotherGame")}
          >
            <Button variant="outline" onClick={() => setAnalyticsKey((k) => k + 1)}>
              {t("common.tryAgain")}
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
              label={t("host.averageScore")}
              value={analytics.avg_score.toLocaleString()}
              hint={analytics.answers_count === 0 ? t("host.noAnswers") : undefined}
            />
            <StatCard
              label={t("host.averageAccuracy")}
              value={`${analytics.avg_accuracy}%`}
              hint={`${analytics.answers_count} ${t("common.answerWord")}`}
            />
            <StatCard
              label={t("host.avgResponseTime")}
              value={formatDuration(analytics.avg_response_time_ms)}
            />
            <StatCard
              label={t("host.playersHeading")}
              value={analytics.participants_count}
              hint={`${analytics.questions_count} ${t("common.questionWord")}`}
            />
          </div>

          <Card className="mt-6" padding="lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{t("host.mostMissed")}</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {t("host.mostMissedSub")} {analytics.code}.
                </p>
              </div>
              <Badge variant={getStatusInfo(analytics.status).variant}>
                {getStatusInfo(analytics.status).label}
              </Badge>
            </div>

            {analytics.most_missed.length === 0 ? (
              <EmptyState
                className="mt-4"
                title={t("host.nothingMissed")}
                description={t("host.nothingMissedDesc")}
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
                        {q.incorrect_count} {t("host.wrongAnswers")} · {q.accuracy}
                        {t("host.correctPct")} · {t("common.avg")} {formatDuration(q.avg_response_time_ms)}
                      </p>
                    </div>
                    <Badge variant={q.accuracy >= 50 ? "success" : "warning"}>
                      {q.accuracy}
                      {t("host.correctPct")}
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