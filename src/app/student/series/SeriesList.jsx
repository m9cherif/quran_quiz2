"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { listSeries, myAttempts } from "@/lib/series/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * The series on offer, and how far this student has got with each.
 *
 * The mark shown per series is the best of the marks already earned on its
 * exercises, not the last: an exercise is meant to be repeated, and a student
 * who improves should see the improvement rather than their most recent slip.
 */
export default function SeriesList() {
  const [series, setSeries] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    listSeries()
      .then((rows) => {
        if (!cancelled) setSeries(rows);
      })
      .catch((error) => {
        console.error("Loading the series failed:", error);
        if (!cancelled) setFailed(true);
      });
    // Past marks are a nicety: the list is still useful without them.
    myAttempts()
      .then((rows) => {
        if (!cancelled) setAttempts(rows);
      })
      .catch(() => {});
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

  if (!series) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">{t("series.title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("series.subtitle")}</p>
      </header>

      {series.length === 0 ? (
        <Card>
          <EmptyState title={t("series.none")} description={t("series.noneDesc")} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {series.map((plan) => {
            const mine = attempts.filter((a) => a.series_id === plan.id);
            const best = mine.length
              ? Math.max(...mine.map((a) => Number(a.score) || 0))
              : null;
            const pages = [...new Set(plan.exercices.map((e) => e.page))];
            return (
              <Card key={plan.id} interactive className="flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-ink">{plan.nom}</h2>
                    {best === null ? (
                      <Badge variant="neutral">{t("series.notYet")}</Badge>
                    ) : (
                      <Badge variant={best >= 50 ? "success" : "warning"}>
                        {t("series.best")} {best}/100
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {plan.exercices.length} {t("series.exercises")} · {t("series.page")}{" "}
                    {pages.length > 3
                      ? `${Math.min(...pages)}–${Math.max(...pages)}`
                      : pages.join(", ")}
                  </p>
                  {mine.length > 0 && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {t("series.attemptsCount", { count: mine.length })}
                    </p>
                  )}
                </div>
                <Button href={`/student/series/${encodeURIComponent(plan.id)}`} className="w-full">
                  {t("series.start")}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
