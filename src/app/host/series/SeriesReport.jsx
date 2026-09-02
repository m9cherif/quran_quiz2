"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { listMyClasses, listClassMembers } from "@/services/classes";
import { attemptsForStudents, listSeries } from "@/lib/series/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

/**
 * How a class is doing on every series.
 *
 * The marks come straight from the table under the teacher's own session: the
 * policy there already limits the rows to members of classes this account owns,
 * so the report cannot show a stranger's marks even if it asked for them. Only
 * the names need the class RPC, because a profile is otherwise private.
 */
export default function SeriesReport() {
  const [classes, setClasses] = useState(null);
  const [classId, setClassId] = useState("");
  const [members, setMembers] = useState([]);
  const [series, setSeries] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMyClasses(), listSeries()])
      .then(([rows, plans]) => {
        if (cancelled) return;
        setClasses(rows);
        setSeries(plans);
        if (rows.length > 0) setClassId(rows[0].id);
      })
      .catch((error) => {
        console.error("Loading the report failed:", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!classId) return undefined;
    let cancelled = false;
    setLoading(true);
    listClassMembers(classId)
      .then(async (rows) => {
        if (cancelled) return;
        setMembers(rows);
        const marks = await attemptsForStudents(rows.map((m) => m.profile_id));
        if (!cancelled) setAttempts(marks);
      })
      .catch((error) => {
        console.error("Loading the class results failed:", error);
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const byStudent = useMemo(() => {
    const names = new Map(members.map((m) => [m.profile_id, m.name]));
    return members.map((member) => {
      const mine = attempts.filter((a) => a.profile_id === member.profile_id);
      const perSeries = new Map();
      for (const plan of series) {
        const marks = mine
          .filter((a) => a.series_id === plan.id)
          .map((a) => Number(a.score) || 0);
        perSeries.set(plan.id, { average: average(marks), attempts: marks.length });
      }
      return {
        id: member.profile_id,
        name: names.get(member.profile_id) ?? member.profile_id,
        perSeries,
        overall: average(mine.map((a) => Number(a.score) || 0)),
        attempts: mine.length,
        last: mine[0]?.finished_at ?? null,
      };
    });
  }, [members, attempts, series]);

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

  if (!classes) return <Skeleton className="h-40 w-full" />;

  if (classes.length === 0) {
    return (
      <Card>
        <EmptyState title={t("series.reportTitle")} description={t("series.noClasses")}>
          <Button href="/host/classes">{t("nav.classes")}</Button>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t("series.reportTitle")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("series.reportSubtitle")}</p>
        </div>
        <div className="w-56">
          <Select
            label={t("series.chooseClass")}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </div>
      </header>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : attempts.length === 0 ? (
        <Card>
          <EmptyState title={t("series.noAttempts")} />
        </Card>
      ) : (
        <>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">{t("series.student")}</th>
                    {series.map((plan) => (
                      <th key={plan.id} className="px-4 py-3 text-start font-medium">
                        {plan.nom}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-start font-medium">{t("series.average")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byStudent.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 font-medium text-ink">{student.name}</td>
                      {series.map((plan) => {
                        const cell = student.perSeries.get(plan.id);
                        return (
                          <td key={plan.id} className="px-4 py-3">
                            {!cell || cell.average === null ? (
                              <span className="text-ink-muted">—</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Badge variant={cell.average >= 50 ? "success" : "warning"}>
                                  {cell.average}/100
                                </Badge>
                                <span className="text-xs text-ink-muted">×{cell.attempts}</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3">
                        {student.overall === null ? (
                          <span className="text-ink-muted">{t("series.notYet")}</span>
                        ) : (
                          <strong className="text-ink">{student.overall}/100</strong>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padding="none">
            <h2 className="px-4 pt-4 text-sm font-semibold text-ink">{t("series.recent")}</h2>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-sm">
                <thead className="border-b border-border text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">{t("series.student")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("series.title")}</th>
                    <th className="px-4 py-3 text-start font-medium">#</th>
                    <th className="px-4 py-3 text-start font-medium">{t("series.page")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("series.score")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("series.mistakes")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("series.time")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("series.lastAttempt")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attempts.slice(0, 50).map((attempt) => {
                    const student = byStudent.find((s) => s.id === attempt.profile_id);
                    const plan = series.find((p) => p.id === attempt.series_id);
                    return (
                      <tr key={attempt.id}>
                        <td className="px-4 py-3 text-ink">{student?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {plan?.nom ?? attempt.series_id}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{attempt.exercise_num ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-muted">{attempt.page ?? "—"}</td>
                        <td className="px-4 py-3 text-ink">
                          {attempt.score ?? 0}/100
                          <span className="ms-2 text-xs text-ink-muted">
                            {attempt.total
                              ? `${(attempt.answered ?? 0) - (attempt.errors ?? 0)}/${attempt.total}`
                              : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{attempt.errors ?? 0}</td>
                        <td className="px-4 py-3 text-ink-muted">{clock(attempt.seconds)}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {attempt.finished_at
                            ? new Date(attempt.finished_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
