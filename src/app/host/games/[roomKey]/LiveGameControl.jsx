"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Countdown from "@/components/ui/Countdown";
import { Dialog } from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import HostDashboard from "@/components/host/HostDashboard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { getSupabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { deleteQuiz, setQuizStatus } from "@/services/quizzes";
import {
  beginQuestion,
  endQuestion,
  getGameByCode,
  getHostQuestionFull,
  getLeaderboard,
  getQuestionStats,
  listGameQuestions,
  listParticipants,
} from "@/services/games";

export default function LiveGameControl({ roomKey }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();

  const statusInfoOf = (status) => {
    const map = {
      waiting: { variant: "success", label: t("host.lobbyOpen") },
      running: { variant: "success", label: t("common.running") },
      paused: { variant: "warning", label: t("common.paused") },
      finished: { variant: "neutral", label: t("common.finished") },
      cancelled: { variant: "neutral", label: t("common.cancelled") },
      draft: { variant: "neutral", label: t("common.draft") },
    };
    return map[status] ?? { variant: "neutral", label: status };
  };

/**
 * LiveGameControl — host control room for a running game.
 * Loads the competition by room code, subscribes to realtime changes on
 * the competition, its questions, answers and participants, and drives
 * the round: start → questions (server timestamps) → reveal → finish.
 */
  const [state, setState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [participants, setParticipants] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questionStats, setQuestionStats] = useState([]);
  const [reveal, setReveal] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const channelRef = useRef(null);

  const loadAll = useCallback(async (code, fetchReveal = true) => {
    const competition = await getGameByCode(code);
    if (!competition) {
      throw new Error(t("host.gameNotFound"));
    }
    const items = await listGameQuestions(competition.id);
    const players = await listParticipants(competition.id);
    const [board, stats] = await Promise.all([
      getLeaderboard(competition.id).catch(() => []),
      competition.status === "finished" || competition.status === "cancelled"
        ? getQuestionStats(competition.id).catch(() => [])
        : Promise.resolve([]),
    ]);
    setGame(competition);
    setQuestions(items);
    setParticipants(players);
    setLeaderboard(board);
    setQuestionStats(stats);
    const active = items
      .filter((q) => q.started_at && q.ends_at && new Date(q.ends_at).getTime() > Date.now())
      .sort((a, b) => a.position - b.position)[0];
    if (fetchReveal && active) {
      try {
        setReveal(await getHostQuestionFull(active.id));
      } catch {
        setReveal(null);
      }
    } else if (!fetchReveal) {
      setReveal(null);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      setLoadError("");
      try {
        await loadAll(String(roomKey), false);
        if (!cancelled) setState("ready");
      } catch (err) {
        console.error("Failed to load game:", err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : t("host.couldNotOpen"));
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomKey, loadAll]);

  // Realtime: game status, question timing, answers, players.
  useEffect(() => {
    if (state !== "ready" || !game) return;
    const client = getSupabase();
    const channel = client.channel(`control-${game.id}`);

    channel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "competitions", filter: `id=eq.${game.id}` },
        (payload) => {
          setGame((prev) => ({ ...prev, ...payload.new }));
          if (payload.new.status === "finished" || payload.new.status === "cancelled") {
            getQuestionStats(game.id)
              .then(setQuestionStats)
              .catch(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "questions", filter: `competition_id=eq.${game.id}` },
        (payload) => {
          const updated = payload.new;
          setQuestions((prev) =>
            prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q))
          );
          if (updated.started_at && updated.ends_at) {
            getHostQuestionFull(updated.id)
              .then(setReveal)
              .catch(() => setReveal(null));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `competition_id=eq.${game.id}` },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "participants", filter: `competition_id=eq.${game.id}` },
        (payload) => {
          setParticipants((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `competition_id=eq.${game.id}` },
        (payload) => {
          const row = payload.new;
          setAnswers((prev) => ({ ...prev, [`${row.participant_id}:${row.question_id}`]: true }));
          getLeaderboard(game.id)
            .then(setLeaderboard)
            .catch(() => {});
        }
      )
      .subscribe();

    channelRef.current = channel;

    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(timer);
      client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [state, game]);

  const current = useMemo(
    () =>
      questions.find(
        (q) => q.started_at && q.ends_at && new Date(q.ends_at).getTime() > now
      ) ??
      [...questions]
        .filter((q) => q.started_at)
        .sort((a, b) => a.position - b.position)
        .pop(),
    [questions, now]
  );
  const upNext = useMemo(
    () =>
      [...questions]
        .filter((q) => !q.started_at)
        .sort((a, b) => a.position - b.position)[0],
    [questions]
  );
  const answeredCount = current
    ? Object.keys(answers).filter((key) => key.endsWith(`:${current.id}`)).length
    : 0;

  const effectiveSeconds = (q) =>
    Math.min(q.duration_seconds, Math.max(1, game?.minutes_per_question ?? 1) * 60);

  const phase = !game
    ? "lobby"
    : game.status === "running"
      ? "active"
      : game.status === "paused"
        ? "paused"
        : game.status === "finished"
          ? "finished"
          : game.status === "cancelled"
            ? "cancelled"
            : "lobby";

  const copyCode = () => {
    navigator.clipboard
      .writeText(String(roomKey))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast({
          title: t("host.copyFailed"),
          variant: "error",
          description: t("host.couldNotCopy"),
        });
      });
  };

  const run = async (action, fn) => {
    setBusyAction(action);
    try {
      await fn();
    } catch (err) {
      console.error(`${action} failed:`, err);
      toast({
        title: t("host.actionFailed"),
        description: err instanceof Error ? err.message : t("common.tryAgain"),
        variant: "error",
      });
    } finally {
      setBusyAction("");
    }
  };

  const startGame = () =>
    run("start", async () => {
      await setQuizStatus(game.id, "running");
      if (upNext) await beginQuestion(upNext.id);
    });

  const nextQuestion = () =>
    run("next", async () => {
      if (current && new Date(current.ends_at).getTime() > now) {
        await endQuestion(current.id);
      }
      if (upNext) await beginQuestion(upNext.id);
    });

  const endCurrent = () =>
    run("end", async () => {
      if (current) await endQuestion(current.id);
    });

  const pauseGame = () => run("pause", () => setQuizStatus(game.id, "paused"));
  const resumeGame = () => run("resume", () => setQuizStatus(game.id, "running"));

  const finishGame = () =>
    run("finish", async () => {
      if (current && new Date(current.ends_at).getTime() > now) {
        await endQuestion(current.id);
      }
      await setQuizStatus(game.id, "finished");
    });

  const cancelGame = () =>
    run("cancel", async () => {
      await setQuizStatus(game.id, "cancelled");
      setCancelOpen(false);
    });

  const deleteRoom = () =>
    run("delete", async () => {
      await deleteQuiz(game.id);
      toast({
        title: t("host.gameDeleted"),
        description: t("host.gameDeletedDesc"),
        variant: "success",
      });
      router.push("/host/games");
    });

  if (state === "loading") {
    return (
      <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
        <Skeleton className="h-80" />
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <EmptyState
        icon={<Spinner size={20} />}
        title={t("host.couldNotOpen")}
        description={loadError}
      >
        <Button variant="outline" onClick={() => router.push("/host/games")}>
          {t("host.backToGames")}
        </Button>
        <Button onClick={() => window.location.reload()}>{t("common.tryAgain")}</Button>
      </EmptyState>
    );
  }

  const statusInfo = statusInfoOf(game.status);
  const activeEnds = current && new Date(current.ends_at).getTime() > now ? current.ends_at : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" href="/host/games">
            ← {t("nav.liveGames")}
          </Button>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">{game.title}</h1>
          <Badge variant={statusInfo.variant} dot>
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase === "lobby" && (
            <>
              <Button variant="outline" onClick={pauseGame} disabled>
                {t("host.pause")}
              </Button>
              <Button loading={busyAction === "start"} onClick={startGame} disabled={!upNext}>
                {t("host.startGame")}
              </Button>
            </>
          )}
          {phase === "active" && (
            <>
              <Button variant="outline" loading={busyAction === "pause"} onClick={pauseGame}>
                {t("host.pause")}
              </Button>
              {current && new Date(current.ends_at).getTime() > now ? (
                <Button variant="outline" loading={busyAction === "end"} onClick={endCurrent}>
                  {t("host.endQuestionNow")}
                </Button>
              ) : upNext ? (
                <Button loading={busyAction === "next"} onClick={nextQuestion}>
                  {t("host.nextQuestion")}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                loading={busyAction === "finish"}
                onClick={finishGame}
                disabled={Boolean(upNext)}
              >
                {t("host.finishGame")}
              </Button>
            </>
          )}
          {phase === "paused" && (
            <Button loading={busyAction === "resume"} onClick={resumeGame}>
              {t("host.resumeGame")}
            </Button>
          )}
          {(phase === "finished" || phase === "cancelled") && (
            <Button variant="outline" onClick={() => router.push("/host/games")}>
              {t("host.backToGames")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {phase === "lobby" && <HostDashboard game={game} />}

          {current ? (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  {t("host.questionOfCtrl", { position: current.position, total: questions.length })}
                </h2>
                {activeEnds && (
                  <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
                    <Countdown endsAt={activeEnds} now={now} size="lg" />
                    {t("host.remaining")}
                  </span>
                )}
                {!activeEnds && <Badge variant="neutral">{t("host.closed")}</Badge>}
              </div>
              <p className="text-lg font-medium text-ink">{current.text}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <Badge variant="info">{current.type}</Badge>
                <Badge variant="neutral">
                  +{current.points ?? game.default_points} {t("common.points")}
                </Badge>
                {answeredCount > 0 && (
                  <Badge variant="success">
                    {answeredCount} {t("host.answered")}
                  </Badge>
                )}
              </div>

              {reveal && reveal.id === current.id && !activeEnds && (
                <div className="rounded-md border-s-4 border-s-success bg-surface-2 px-4 py-3">
                  <p className="text-sm font-semibold text-success-strong">{t("host.correctAnswer")}</p>
                  {reveal.choices.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {reveal.choices.map((c) => (
                        <li
                          key={c.id}
                          className={`text-sm ${c.is_correct ? "font-semibold text-success-strong" : "text-ink-muted"}`}
                        >
                          {c.is_correct ? "●" : "○"} {c.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-ink">{reveal.correct_answer_text ?? "—"}</p>
                  )}
                  {reveal.explanation && (
                    <p className="mt-2 text-sm text-ink-muted">{reveal.explanation}</p>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card className="flex flex-col items-center gap-2 py-12 text-center">
              <Spinner size={22} className="text-ink-faint" />
              <p className="text-sm text-ink-muted">{t("host.noActiveQuestion")}</p>
            </Card>
          )}

          {phase !== "finished" && phase !== "cancelled" && (
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">{t("host.questionDeck")}</h2>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {questions.map((q) => {
                const isCurrent = current?.id === q.id;
                const done = Boolean(q.started_at);
                return (
                  <li
                    key={q.id}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      isCurrent
                        ? "border-primary bg-primary-soft/40"
                        : done
                          ? "border-border bg-surface-2 text-ink-muted"
                          : "border-border bg-surface text-ink"
                    }`}
                  >
                    <span className="font-medium">{q.position}. </span>
                    <span className="line-clamp-1">{q.text}</span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {done
                        ? isCurrent
                          ? t("host.active")
                          : t("host.done")
                        : t("host.upcoming")}{" "}
                      · {effectiveSeconds(q)}s
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        {(phase === "finished" || phase === "cancelled") && (
          <Card className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{t("host.results")}</h2>
              <Badge variant="neutral">
                {leaderboard.length} {t("common.players")}
              </Badge>
            </div>

            {leaderboard.length >= 3 && (
              <div className="grid grid-cols-3 items-end gap-2">
                {[1, 0, 2].map((slot) => {
                  const row = leaderboard[slot];
                  const medal =
                    slot === 0
                      ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      : slot === 1
                        ? "border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        : "border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200";
                  return (
                    <div
                      key={row.participant_id}
                      className={`rounded-md border px-3 py-4 text-center ${medal} ${slot === 0 ? "order-2 scale-105" : slot === 1 ? "order-1" : "order-3"}`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wide opacity-70">
                        {slot === 0
                          ? `${t("game.firstPlace")} ${t("host.place")}`
                          : slot === 1
                            ? `${t("game.secondPlace")} ${t("host.place")}`
                            : `${t("game.thirdPlace")} ${t("host.place")}`}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold">{row.display_name}</p>
                      <p className="mt-0.5 text-lg font-bold">{Math.round(row.total_points)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              {leaderboard.map((row) => (
                <div
                  key={row.participant_id}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-2 text-sm"
                >
                  <span className="w-6 text-center text-xs font-bold text-ink-faint">{row.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.display_name}</span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {row.correct_count}/{row.answered_count} {t("student.correctOf")}
                  </span>
                  <span className="shrink-0 font-semibold text-ink">{Math.round(row.total_points)}</span>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink">{t("host.perQuestionBreakdown")}</h3>
              {questionStats.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">{t("host.noQuestionData")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {questionStats.map((row) => (
                    <li
                      key={row.position_number}
                      className="rounded-md border border-border bg-surface-2 px-4 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">
                          {row.position_number}. {row.text}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {row.correct_count}/{row.answered_count} {t("student.correctOf")} ·{" "}
                          {row.accuracy}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{
                            width: `${Math.min(100, Math.max(0, row.accuracy))}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}
        </div>

        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">{t("host.shareCode")}</h2>
              <Badge variant="success" dot>
                {t("host.lobbyOpen")}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p
                className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-ink"
                aria-label={t("common.code")}
              >
                {roomKey}
              </p>
              <Button variant="outline" onClick={copyCode}>
                {copied ? t("host.copied") : t("common.copy")}
              </Button>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              {t("host.studentsGoJoin", { path: "/join" })}
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{t("host.playersHeading")}</h2>
              <Badge variant="neutral">{participants.length}</Badge>
            </div>
            {participants.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">
                {t("host.waitingPlayers")}
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${p.connected ? "bg-success" : "bg-ink-faint"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.display_name}</span>
                    <span className="text-xs text-ink-faint">
                      {p.connected ? t("host.online") : t("host.away")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {phase !== "finished" && phase !== "cancelled" && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">{t("game.leaderboard")}</h2>
                <Badge variant="neutral">
                  {leaderboard.length} {t("common.players")}
                </Badge>
              </div>
              {leaderboard.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">{t("host.noScoresYet")}</p>
              ) : (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                  {leaderboard.map((row) => (
                    <li key={row.participant_id} className="flex items-center gap-3 py-2">
                      <span className="w-6 text-center text-xs font-bold text-ink-faint">
                        {row.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {row.display_name}
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {row.correct_count}/{row.answered_count} ·{" "}
                        <span className="font-semibold text-ink">
                          {Math.round(row.total_points)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card padding="lg" className="space-y-3">
            <h2 className="text-base font-semibold text-ink">{t("host.dangerZone")}</h2>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCancelOpen(true)}
              disabled={game.status === "finished" || game.status === "cancelled"}
            >
              {t("host.cancelGame")}
            </Button>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => setDeleteOpen(true)}
              disabled={game.status !== "finished" && game.status !== "cancelled"}
            >
              {t("host.deleteGame")}
            </Button>
          </Card>
        </div>
      </div>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        size="sm"
        title={t("host.cancelTitle")}
        description={t("host.cancelDesc")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={Boolean(busyAction)}>
              {t("host.keepPlaying")}
            </Button>
            <Button variant="danger" loading={busyAction === "cancel"} onClick={cancelGame}>
              {t("host.cancelGame")}
            </Button>
          </>
        }
      />

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title={t("host.deleteGameTitle")}
        description={t("host.deleteGameDesc")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={Boolean(busyAction)}>
              {t("host.keepIt")}
            </Button>
            <Button variant="danger" loading={busyAction === "delete"} onClick={deleteRoom}>
              {t("host.deletePermanently")}
            </Button>
          </>
        }
      />
    </div>
  );
}