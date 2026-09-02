"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { listSeries, myAttempts, startExercise, submitExercise } from "@/lib/series/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** m:ss — a bare count of seconds is hard to read while working. */
function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * One series, run exercise by exercise.
 *
 * This screen never holds the answers: it is given one side — the word, or the
 * place — and the server keeps the other until the copy is handed in. Which is
 * also why a finished exercise cannot be marked twice: the mark belongs to the
 * attempt, not to this screen.
 */
export default function SeriesRunner({ seriesId }) {
  const [plan, setPlan] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");

  /** Null until an exercise is opened. */
  const [live, setLive] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Which exercise is being opened — only its own button should say so. */
  const [opening, setOpening] = useState(null);
  const [marked, setMarked] = useState(null);
  const handingIn = useRef(false);
  const { t } = useI18n();

  const refreshAttempts = useCallback(() => {
    myAttempts()
      .then(setAttempts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    listSeries()
      .then((rows) => {
        if (cancelled) return;
        const found = rows.find((row) => row.id === seriesId);
        if (found) setPlan(found);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    refreshAttempts();
    return () => {
      cancelled = true;
    };
  }, [seriesId, refreshAttempts]);

  const handIn = useCallback(
    async (seconds) => {
      if (!live || handingIn.current) return;
      handingIn.current = true;
      setBusy(true);
      setError("");
      try {
        const result = await submitExercise(seriesId, live.attemptId, answers, seconds);
        setMarked(result);
        setLive(null);
        refreshAttempts();
        // The mark appears above the list the student was just working in, so
        // without this it lands off-screen and reads as nothing having happened.
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        console.error("Handing in the exercise failed:", err);
        setError(err.message || t("series.submitFailed"));
        handingIn.current = false;
      } finally {
        setBusy(false);
      }
    },
    [live, answers, seriesId, refreshAttempts, t]
  );

  // The clock belongs to the exercise, not to this component: it starts when
  // the exercise opens and stops when the copy is handed in.
  useEffect(() => {
    if (!live) return undefined;
    const started = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [live]);

  // Time up hands the copy in as it stands, which is what a time limit means.
  useEffect(() => {
    if (!live || !live.limite) return;
    if (elapsed >= live.limite * 60) handIn(Math.round(elapsed));
  }, [elapsed, live, handIn]);

  const open = async (num) => {
    setError("");
    setMarked(null);
    setOpening(num);
    try {
      const started = await startExercise(seriesId, num);
      handingIn.current = false;
      setAnswers(started.prompts.map(() => (started.ecrire_mot ? "" : { line: "", rank: "" })));
      setElapsed(0);
      setLive(started);
    } catch (err) {
      console.error("Opening the exercise failed:", err);
      setError(err.message || t("series.startFailed"));
    } finally {
      setOpening(null);
    }
  };

  if (failed) {
    return (
      <Card>
        <EmptyState title={t("common.loadFailedTitle")} description={t("common.loadFailedDesc")}>
          <Button variant="outline" href="/student/series">
            {t("series.backToList")}
          </Button>
        </EmptyState>
      </Card>
    );
  }

  if (!plan) return <Skeleton className="h-40 w-full" />;

  // ---- Working on an exercise ---------------------------------------------
  if (live) {
    const remaining = live.limite ? live.limite * 60 - elapsed : null;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink">
            {plan.nom} — {t("series.exercise", { num: live.num })}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="info">
              {t("series.page")} {live.page}
            </Badge>
            <Badge variant={remaining !== null && remaining < 30 ? "warning" : "neutral"}>
              {remaining !== null
                ? `${t("series.timeLeft")} ${clock(remaining)}`
                : `${t("series.elapsed")} ${clock(elapsed)}`}
            </Badge>
          </div>
        </div>

        <Card>
          <p className="text-sm text-ink-muted">
            {live.ecrire_mot ? t("series.writeHint") : t("series.positionHint")}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{t("series.orderNote")}</p>

          <ul className="mt-5 space-y-3">
            {live.prompts.map((prompt) => (
              <li
                key={prompt.i}
                className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface-2 px-3 py-3"
              >
                <span className="w-6 shrink-0 text-sm text-ink-muted">{prompt.i + 1}.</span>

                {live.ecrire_mot ? (
                  <>
                    <span className="text-sm text-ink">
                      {t("series.lineNo")} <strong>{prompt.line}</strong> · {t("series.rankNo")}{" "}
                      <strong>{prompt.rank}</strong>
                    </span>
                    <div className="min-w-[12rem] flex-1">
                      <Input
                        dir="rtl"
                        lang="ar"
                        value={answers[prompt.i] ?? ""}
                        onChange={(event) =>
                          setAnswers((prev) =>
                            prev.map((a, i) => (i === prompt.i ? event.target.value : a))
                          )
                        }
                        placeholder={t("series.word")}
                        className="text-lg"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <span dir="rtl" lang="ar" className="flex-1 text-2xl font-semibold text-ink">
                      {prompt.text}
                    </span>
                    <div className="w-24">
                      <Input
                        label={t("series.lineNo")}
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={answers[prompt.i]?.line ?? ""}
                        onChange={(event) =>
                          setAnswers((prev) =>
                            prev.map((a, i) =>
                              i === prompt.i ? { ...a, line: event.target.value } : a
                            )
                          )
                        }
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        label={t("series.rankNo")}
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={answers[prompt.i]?.rank ?? ""}
                        onChange={(event) =>
                          setAnswers((prev) =>
                            prev.map((a, i) =>
                              i === prompt.i ? { ...a, rank: event.target.value } : a
                            )
                          )
                        }
                      />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-5 flex justify-end">
            <Button onClick={() => handIn(Math.round(elapsed))} loading={busy} icon="check">
              {t("series.finish")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---- The list of exercises, and the mark just earned ---------------------
  const bestFor = (num) => {
    const mine = attempts.filter(
      (a) => a.series_id === plan.id && Number(a.exercise_num) === num
    );
    return mine.length ? Math.max(...mine.map((a) => Number(a.score) || 0)) : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">{plan.nom}</h1>
        <Button variant="outline" href="/student/series">
          {t("series.backToList")}
        </Button>
      </div>

      {marked && (
        <Card>
          <p className="text-sm text-ink-muted">{t("series.done")}</p>
          <p className="text-3xl font-semibold text-ink">{marked.note}/100</p>
          <p className="text-sm text-ink-muted">
            {t("series.correctCount", { right: marked.right, total: marked.total })} ·{" "}
            {t("series.elapsed")} {clock(marked.seconds)}
          </p>

          <ul className="mt-4 divide-y divide-border">
            {marked.corrections.map((correction) => (
              <li key={correction.i} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <Badge variant={correction.right ? "success" : "danger"}>{correction.i + 1}</Badge>
                <span className="text-ink-muted">{t("series.yourAnswer")}:</span>
                <span dir="auto" className="text-ink">
                  {!correction.answered
                    ? t("series.blank")
                    : typeof correction.given === "object" && correction.given !== null
                      ? `${t("series.lineNo")} ${correction.given.line} · ${t("series.rankNo")} ${correction.given.rank}`
                      : String(correction.given)}
                </span>
                {!correction.right && (
                  <>
                    <span className="text-ink-muted">— {t("series.expected")}:</span>
                    <strong dir="auto" className="text-ink">
                      {typeof correction.expected === "object"
                        ? `${t("series.lineNo")} ${correction.expected.line} · ${t("series.rankNo")} ${correction.expected.rank}`
                        : correction.expected}
                    </strong>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {error && !marked && <p className="text-sm text-danger">{error}</p>}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-ink-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">#</th>
                <th className="px-4 py-3 text-start font-medium">{t("series.page")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("series.words")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("series.difficulty")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("series.time")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("series.best")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plan.exercices.map((exercise) => {
                const best = bestFor(exercise.num);
                return (
                  <tr key={exercise.num}>
                    <td className="px-4 py-3 text-ink">{exercise.num}</td>
                    <td className="px-4 py-3 text-ink">{exercise.page}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {exercise.mots} ·{" "}
                      {exercise.ecrire_mot ? t("series.modeWrite") : t("series.modePosition")}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{exercise.diff}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {exercise.limite
                        ? t("series.minutes", { count: exercise.limite })
                        : t("series.noLimit")}
                    </td>
                    <td className="px-4 py-3">
                      {best === null ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <Badge variant={best >= 50 ? "success" : "warning"}>{best}/100</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        size="sm"
                        variant={best === null ? "primary" : "outline"}
                        loading={opening === exercise.num}
                        disabled={opening !== null}
                        onClick={() => open(exercise.num)}
                      >
                        {best === null ? t("series.start") : t("series.startAgain")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
