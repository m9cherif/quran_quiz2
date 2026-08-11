"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { getMyHistory } from "@/services/analytics";
import { useI18n } from "@/lib/i18n/I18nProvider";

function StatusBadge({ status }) {
  const { t } = useI18n();
  const map = {
    finished: { variant: "neutral", label: t("common.finished") },
    cancelled: { variant: "neutral", label: t("common.cancelled") },
    running: { variant: "success", label: t("common.running") },
    waiting: { variant: "info", label: t("common.waiting") },
    paused: { variant: "warning", label: t("common.paused") },
  };
  const info = map[status] ?? { variant: "neutral", label: status };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

/**
 * StudentHistory — full table of the signed-in user's games with score,
 * correct answers and accuracy per game (my_history, own rows only).
 */
export default function StudentHistory() {
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();

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
        <EmptyState title={t("common.loadFailedTitle")} description={t("common.loadFailedDesc")}>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("common.tryAgain")}
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
          <h1 className="text-2xl font-bold text-ink">{t("student.historyTitle")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{t("student.historySub")}</p>
        </div>
        <Button href="/join">{t("nav.joinGame")}</Button>
      </div>

      {history.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            title={t("student.noGamesTitle")}
            description={t("student.noGamesDesc")}
          >
            <Button href="/join">{t("nav.joinGame")}</Button>
          </EmptyState>
        </Card>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {history.map((h) => (
            <li key={h.competition_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {t("common.code")} {h.code} · {t("student.joined")}{" "}
                  {new Date(h.joined_at).toLocaleString()}
                  {h.finished_at &&
                    ` · ${t("common.finished")} ${new Date(h.finished_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-ink-muted">
                  {h.correct_count}/{h.answered_count} {t("student.correctOf")}
                </span>
                <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-md bg-surface-3 px-2 font-semibold text-ink">
                  {h.accuracy}%
                </span>
                <span className="font-semibold text-ink">
                  {h.score.toLocaleString()} {t("common.points")}
                </span>
                <StatusBadge status={h.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}