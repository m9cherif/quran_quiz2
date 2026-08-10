"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { getSupabase } from "@/lib/supabase/client";
import { deleteQuiz, setQuizStatus } from "@/services/quizzes";
import {
  beginQuestion,
  endQuestion,
  getGameByCode,
  getHostQuestionFull,
  listGameQuestions,
  listParticipants,
  remainingMs,
} from "@/services/games";

const STATUS_BADGE = {
  waiting: { variant: "success", label: "Lobby open" },
  running: { variant: "success", label: "Running" },
  paused: { variant: "warning", label: "Paused" },
  finished: { variant: "neutral", label: "Finished" },
  cancelled: { variant: "neutral", label: "Cancelled" },
  draft: { variant: "neutral", label: "Draft" },
};

function fmt(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * LiveGameControl — host control room for a running game.
 * Loads the competition by room code, subscribes to realtime changes on
 * the competition, its questions, answers and participants, and drives
 * the round: start → questions (server timestamps) → reveal → finish.
 */
export default function LiveGameControl({ roomKey }) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [participants, setParticipants] = useState([]);
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
      throw new Error("Game not found. Check the room code.");
    }
    const items = await listGameQuestions(competition.id);
    const players = await listParticipants(competition.id);
    setGame(competition);
    setQuestions(items);
    setParticipants(players);
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
  }, []);

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
          setLoadError(err instanceof Error ? err.message : "Could not open this game.");
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
        toast({ title: "Copy failed", variant: "error", description: "Could not copy the code." });
      });
  };

  const run = async (action, fn) => {
    setBusyAction(action);
    try {
      await fn();
    } catch (err) {
      console.error(`${action} failed:`, err);
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Try again.",
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
      toast({ title: "Game deleted", description: "All rounds and players were removed.", variant: "success" });
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
        title="Could not open this game"
        description={loadError}
      >
        <Button variant="outline" onClick={() => router.push("/host/games")}>
          Back to games
        </Button>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </EmptyState>
    );
  }

  const statusInfo = STATUS_BADGE[game.status] ?? { variant: "neutral", label: game.status };
  const activeEnds = current && new Date(current.ends_at).getTime() > now ? current.ends_at : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" href="/host/games">
            ← Games
          </Button>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">{game.name}</h1>
          <Badge variant={statusInfo.variant} dot>
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase === "lobby" && (
            <>
              <Button variant="outline" onClick={pauseGame} disabled>
                Pause
              </Button>
              <Button loading={busyAction === "start"} onClick={startGame} disabled={!upNext}>
                Start game
              </Button>
            </>
          )}
          {phase === "active" && (
            <>
              <Button variant="outline" loading={busyAction === "pause"} onClick={pauseGame}>
                Pause
              </Button>
              {current && new Date(current.ends_at).getTime() > now ? (
                <Button variant="outline" loading={busyAction === "end"} onClick={endCurrent}>
                  End question now
                </Button>
              ) : upNext ? (
                <Button loading={busyAction === "next"} onClick={nextQuestion}>
                  Next question
                </Button>
              ) : null}
              <Button
                variant="secondary"
                loading={busyAction === "finish"}
                onClick={finishGame}
                disabled={Boolean(upNext)}
              >
                Finish game
              </Button>
            </>
          )}
          {phase === "paused" && (
            <Button loading={busyAction === "resume"} onClick={resumeGame}>
              Resume game
            </Button>
          )}
          {(phase === "finished" || phase === "cancelled") && (
            <Button variant="outline" onClick={() => router.push("/host/games")}>
              Back to games
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {current ? (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  Question {current.position} of {questions.length}
                </h2>
                {activeEnds && (
                  <Badge variant="warning" dot>
                    {fmt(remainingMs(activeEnds, now) / 1000)} remaining
                  </Badge>
                )}
                {!activeEnds && <Badge variant="neutral">Closed</Badge>}
              </div>
              <p className="text-lg font-medium text-ink">{current.text}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <Badge variant="info">{current.type}</Badge>
                <Badge variant="neutral">+{current.points ?? game.default_points} pts</Badge>
                {answeredCount > 0 && (
                  <Badge variant="success">{answeredCount} answered</Badge>
                )}
              </div>

              {reveal && reveal.id === current.id && !activeEnds && (
                <div className="rounded-md border-s-4 border-s-success bg-surface-2 px-4 py-3">
                  <p className="text-sm font-semibold text-success-strong">Correct answer</p>
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
              <p className="text-sm text-ink-muted">No active question.</p>
            </Card>
          )}

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Question deck</h2>
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
                      {done ? (isCurrent ? "Active" : "Done") : "Upcoming"} · {q.duration_seconds}s
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">Share the code</h2>
              <Badge variant="success" dot>
                Lobby open
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p
                className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-ink"
                aria-label="Game code"
              >
                {roomKey}
              </p>
              <Button variant="outline" onClick={copyCode}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Students go to <span className="font-medium text-ink">/join</span> and enter this
              code to join the lobby.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Players</h2>
              <Badge variant="neutral">{participants.length}</Badge>
            </div>
            {participants.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">
                Waiting for players to join…
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
                      {p.connected ? "online" : "away"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="lg" className="space-y-3">
            <h2 className="text-base font-semibold text-ink">Danger zone</h2>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCancelOpen(true)}
              disabled={game.status === "finished" || game.status === "cancelled"}
            >
              Cancel game
            </Button>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => setDeleteOpen(true)}
              disabled={game.status !== "finished" && game.status !== "cancelled"}
            >
              Delete game
            </Button>
          </Card>
        </div>
      </div>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        size="sm"
        title="Cancel this game?"
        description="The room closes and players can no longer answer. Results stay available."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={Boolean(busyAction)}>
              Keep playing
            </Button>
            <Button variant="danger" loading={busyAction === "cancel"} onClick={cancelGame}>
              Cancel game
            </Button>
          </>
        }
      />

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Delete this game?"
        description="The game, its rounds and all player records are permanently removed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={Boolean(busyAction)}>
              Keep it
            </Button>
            <Button variant="danger" loading={busyAction === "delete"} onClick={deleteRoom}>
              Delete permanently
            </Button>
          </>
        }
      />
    </div>
  );
}