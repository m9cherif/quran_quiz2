"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { getSupabase } from "@/lib/supabase/client";
import {
  getGameByCode,
  getMyParticipant,
  listStudentQuestions,
  listChoices,
  submitAnswer,
  getReveal,
  getMyAnswers,
  updatePresence,
  remainingMs,
} from "@/services/games";
import { removeParticipant } from "@/store/Slices/participantSlice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * GameQuestion — student answer screen driven by server timestamps.
 * A question is "active" while now ∈ [started_at, ends_at); after that the
 * reveal (correct answer + explanation + my result) is shown until the host
 * starts the next question. Realtime on questions/competitions + a light
 * polling fallback keep students in sync with the host's control room.
 */
export default function GameQuestion({ params }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useI18n();
  const participant = useSelector((state) => state.participant.Participant);
  const { toast } = useToast();
  const code = typeof params?.code === "string" ? params.code.toUpperCase() : "";

  const competitionId = participant?.competitionId ?? null;
  const accessToken = participant?.accessToken ?? null;

  const [status, setStatus] = useState("loading");
  const [gameEnded, setGameEnded] = useState(false);
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [choices, setChoices] = useState({});
  const [revealById, setRevealById] = useState({});
  const [answersById, setAnswersById] = useState({});
  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedIds, setSubmittedIds] = useState({});
  const [nowEpoch, setNowEpoch] = useState(() => Date.now());
  const [overlay, setOverlay] = useState(""); // "" | paused | waiting
  const [error, setError] = useState("");

  const stageStartRef = useRef(null);
  const stageQuestionRef = useRef(null);
  const submittedRef = useRef({});
  const loadedQidsRef = useRef(new Set());
  const loadedRef = useRef(false);

  const activeQuestion = findActiveQuestion(questions, nowEpoch);
  const feedbackQuestion = findFeedbackQuestion(questions, nowEpoch);
  const currentQuestion = activeQuestion ?? feedbackQuestion;
  const isActive = Boolean(activeQuestion);

  const leaveGame = useCallback(() => {
    dispatch(removeParticipant());
    router.push("/join");
  }, [dispatch, router]);

  // ---------- bootstrap: validate session, resolve game ----------
  useEffect(() => {
    if (!accessToken || !competitionId || loadedRef.current) return;
    loadedRef.current = true;

    const bootstrap = async () => {
      try {
        const mine = await getMyParticipant(competitionId, accessToken);
        if (!mine || (participant.id && mine.id !== participant.id)) {
          setGameEnded(true);
          return;
        }
        const current = await getGameByCode(code);
        if (!current || current.id !== competitionId) {
          setGameEnded(true);
          return;
        }
        setGame(current);
        setStatus(current.status);
      } catch (err) {
        console.error("Question bootstrap failed:", err);
        setError(t("game.connectError"));
      }
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, competitionId, code]);

  // ---------- status machine ----------
  useEffect(() => {
    if (!game) return;
    if (status === "running") {
      setOverlay("");
      loadDeck();
    } else if (status === "paused") {
      setOverlay("paused");
    } else if (status === "waiting") {
      setOverlay("waiting");
    } else if (status === "finished") {
      router.push(`/game/${code}/result`);
    } else if (status === "cancelled") {
      setGameEnded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, game]);

  // ---------- deck + choices ----------
  const loadDeck = useCallback(async () => {
    if (!competitionId || !accessToken) return;
    try {
      const list = await listStudentQuestions(competitionId, accessToken);
      setQuestions((prev) => {
        const serial = (q) => [q.id, q.started_at, q.ends_at];
        if (
          prev.length === list.length &&
          prev.every((q, i) => serial(q)[0] === serial(list[i])[0] && serial(q)[1] === serial(list[i])[1] && serial(q)[2] === serial(list[i])[2])
        ) {
          return prev;
        }
        return list;
      });
      const freshQids = list.map((q) => q.id).filter((id) => !loadedQidsRef.current.has(id));
      if (freshQids.length) {
        const rows = await listChoices(freshQids, accessToken);
        setChoices((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            next[row.question_id] = next[row.question_id] || [];
            next[row.question_id].push(row);
          }
          return next;
        });
        for (const id of freshQids) loadedQidsRef.current.add(id);
      }
    } catch {
      // transient — next event/poll retries
    }
  }, [competitionId, accessToken]);

  // ---------- server clock tick + polling fallback + presence ----------
  useEffect(() => {
    if (!game) return;
    const tick = setInterval(() => setNowEpoch(Date.now()), 250);
    const poll = setInterval(() => {
      setNowEpoch(Date.now());
      loadDeck();
      if (status === "running") updatePresence(competitionId, accessToken).catch(() => {});
      getGameByCode(code)
        .then((current) => {
          if (!current) {
            setGameEnded(true);
            return;
          }
          if (current.status !== status) setStatus(current.status);
        })
        .catch(() => {});
    }, 8000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [game, code, status, competitionId, accessToken, loadDeck]);

  // ---------- realtime: questions + competitions ----------
  useEffect(() => {
    if (!game || !competitionId) return;
    const channel = getSupabase()
      .channel(`student-game-${competitionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "competitions",
          filter: `id=eq.${competitionId}`,
        },
        (payload) => {
          const nextStatus = payload?.new?.status;
          if (nextStatus) {
            setStatus(nextStatus);
            setGame((prev) => (prev ? { ...prev, status: nextStatus } : prev));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "questions",
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => {
          const id = payload?.new?.id;
          if (!id) return;
          setQuestions((prev) => {
            const next = prev.map((q) => (q.id === id ? { ...q, ...payload.new } : q));
            return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
          });
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [competitionId, game]);

  // ---------- reveal fetch when a question closes ----------
  useEffect(() => {
    if (!feedbackQuestion || !accessToken || revealById[feedbackQuestion.id]) return;
    let cancelled = false;
    getReveal(feedbackQuestion.id, accessToken)
      .then((reveal) => {
        if (!cancelled) setRevealById((prev) => ({ ...prev, [reveal.question_id]: reveal }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [feedbackQuestion, accessToken, revealById]);

  // ---------- restore my submitted answers on (re)mount ----------
  useEffect(() => {
    if (!competitionId || !accessToken || !game || submittedRef.current.done) return;
    submittedRef.current.done = true;
    getMyAnswers(competitionId, accessToken)
      .then((rows) => {
        const byId = {};
        const submitted = {};
        for (const row of rows) {
          byId[row.question_id] = row;
          submitted[row.question_id] = true;
        }
        setAnswersById(byId);
        setSubmittedIds(submitted);
        submittedRef.current.ids = submitted;
      })
      .catch(() => {});
  }, [competitionId, accessToken, game]);

  // ---------- response clock: starts when the question becomes visible ----------
  useEffect(() => {
    if (!activeQuestion) {
      stageStartRef.current = null;
      stageQuestionRef.current = null;
      return;
    }
    if (stageQuestionRef.current !== activeQuestion.id) {
      stageQuestionRef.current = activeQuestion.id;
      stageStartRef.current = Date.now();
    }
  }, [activeQuestion]);

  // ---------- submit ----------
  const handleSubmit = async () => {
    if (!activeQuestion || !accessToken) return;
    if (submittedRef.current.ids?.[activeQuestion.id]) return;

    const hasChoices = activeQuestion.type === "mcq" || activeQuestion.type === "true_false";
    const choiceId = hasChoices ? selectedChoiceId ?? undefined : undefined;
    const answerText = hasChoices ? undefined : textAnswer.trim();

    if (!choiceId && !answerText) {
      setError(t("game.pickAnswerError"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const elapsed = stageStartRef.current ? Date.now() - stageStartRef.current : 0;
      const answer = await submitAnswer(competitionId, activeQuestion.id, accessToken, {
        choiceId,
        answerText,
        responseTimeMs: elapsed,
      });
      setAnswersById((prev) => ({ ...prev, [activeQuestion.id]: answer }));
      setSubmittedIds((prev) => ({ ...prev, [activeQuestion.id]: true }));
      submittedRef.current.ids = { ...submittedRef.current.ids, [activeQuestion.id]: true };
    } catch (err) {
      console.error("Submit failed:", err);
      if (err?.code === "28000") {
        setError(t("game.questionClosedError"));
      } else {
        toast({ title: t("game.sendAnswerFailed"), variant: "error" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const myAnswer = currentQuestion ? answersById[currentQuestion.id] : null;
  const reveal = currentQuestion ? revealById[currentQuestion.id] : null;
  const questionChoices = currentQuestion ? choices[currentQuestion.id] || [] : [];
  const totalScore = Object.values(answersById).reduce(
    (sum, a) => sum + (a.points ?? 0) + (a.bonus_points ?? 0),
    0
  );
  const remaining = currentQuestion && isActive ? remainingMs(currentQuestion.ends_at) : 0;

  // ---------- screens ----------
  if (gameEnded) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">{t("game.gameEndedTitle")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("game.gameEnded")}</p>
          <Button href="/join" className="mt-6 w-full">
            {t("common.back")}
          </Button>
        </Card>
      </div>
    );
  }

  if (!competitionId || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">{t("game.sessionExpired")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("game.notAvailableDesc")}</p>
          <Button href="/join" className="mt-6 w-full">
            {t("nav.joinGame")}
          </Button>
        </Card>
      </div>
    );
  }

  if (status === "loading" || !game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-ink">{t("game.connecting")}</p>
        </div>
      </div>
    );
  }

  if (overlay === "waiting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <p className="text-sm font-medium text-ink-muted">{game.title}</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-primary">{code}</p>
          <p className="mt-6 text-sm font-medium text-ink">{t("game.startingSoon")}</p>
          <Button variant="ghost" onClick={leaveGame} className="mt-6 w-full">
            {t("game.leaveGame")}
          </Button>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-ink">{t("game.gettingReady")}</p>
          <p className="mt-1 text-xs text-ink-muted">{t("game.hostAboutToStart")}</p>
        </Card>
      </div>
    );
  }

  const wasSubmitted = Boolean(submittedIds[currentQuestion.id]);
  const isCorrect = myAnswer?.is_correct ?? false;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">
          {t("game.questionOf", { position: currentQuestion.position, total: questions.length })}
        </p>
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-ink">
            {t("game.scoreLabel", { total: Math.round(totalScore) })}
          </p>
          {isActive && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                remaining <= 5000
                  ? "bg-danger-soft text-danger-strong"
                  : "bg-primary-soft text-primary"
              }`}
              aria-live="polite"
            >
              {Math.ceil(remaining / 1000)}s
            </span>
          )}
        </div>
      </div>

      {overlay === "paused" && (
        <Card
          padding="md"
          className="mb-4 border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="text-sm font-semibold">{t("game.pausedOverlay")}</p>
        </Card>
      )}

      <Card padding="lg" className="space-y-5">
        <h1 className="text-lg font-semibold leading-relaxed text-ink">{currentQuestion.text}</h1>

        {isActive && !wasSubmitted && (
          <>
            {(currentQuestion.type === "mcq" || currentQuestion.type === "true_false") && (
              <div role="group" aria-label={t("game.answerChoicesLabel")} className="grid gap-2.5">
                {questionChoices.map((choice) => {
                  const isSelected = selectedChoiceId === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => {
                        setSelectedChoiceId(choice.id);
                        setError("");
                      }}
                      aria-pressed={isSelected}
                      className={`w-full rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring ${
                        isSelected
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-surface text-ink hover:border-primary hover:bg-surface-2"
                      }`}
                    >
                      <span className="me-3 inline-block w-5 text-center font-semibold text-ink-faint">
                        {String.fromCharCode(65 + choice.position - 1)}
                      </span>
                      {choice.text}
                    </button>
                  );
                })}
              </div>
            )}

            {(currentQuestion.type === "text" ||
              currentQuestion.type === "number" ||
              currentQuestion.type === "audio") && (
              <input
                type={currentQuestion.type === "number" ? "number" : "text"}
                inputMode={currentQuestion.type === "number" ? "decimal" : "text"}
                value={textAnswer}
                onChange={(e) => {
                  setTextAnswer(e.target.value);
                  setError("");
                }}
                placeholder={
                  currentQuestion.type === "number" ? t("game.typeNumber") : t("game.typeAnswer")
                }
                autoComplete="off"
                aria-label={t("game.typeAnswer")}
                className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-primary focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
              />
            )}

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <Button
              size="lg"
              className="w-full"
              disabled={!selectedChoiceId && !textAnswer.trim()}
              loading={submitting}
              onClick={() => handleSubmit()}
            >
              {t("game.submitAnswer")}
            </Button>
          </>
        )}

        {isActive && wasSubmitted && (
          <div className="rounded-md bg-surface-3 p-4 text-center">
            <p className="text-sm font-semibold text-success-strong">
              {isCorrect ? `${t("game.correct")}!` : t("game.answerSubmitted")}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{t("game.waitingTimer")}</p>
          </div>
        )}

        {!isActive && reveal && (
          <div className="space-y-4">
            <div
              className={`rounded-md p-4 text-sm font-semibold ${
                myAnswer
                  ? isCorrect
                    ? "bg-success-soft text-success-strong"
                    : "bg-danger-soft text-danger-strong"
                  : "bg-surface-3 text-ink-muted"
              }`}
            >
              {myAnswer
                ? isCorrect
                  ? `${t("game.correct")}! +${Math.round(
                      (myAnswer.points ?? 0) + (myAnswer.bonus_points ?? 0)
                    )} ${t("common.points")}`
                  : t("game.wrongAnswer")
                : t("game.noAnswerSubmitted")}
            </div>

            {questionChoices.map((choice) => {
              const isCorrectChoice = reveal.correct_choice?.id === choice.id;
              const isMyPick = myAnswer?.choice_id === choice.id;
              return (
                <div
                  key={choice.id}
                  className={`rounded-md border px-4 py-3 text-sm font-medium ${
                    isCorrectChoice
                      ? "border-success bg-success-soft text-success-strong"
                      : isMyPick
                        ? "border-danger bg-danger-soft text-danger-strong"
                        : "border-border bg-surface text-ink-faint"
                  }`}
                >
                  <span className="me-3 inline-block w-5 text-center font-semibold">
                    {String.fromCharCode(65 + choice.position - 1)}
                  </span>
                  {choice.text}
                  {isCorrectChoice && (
                    <span className="ms-2 text-xs font-semibold">✓ {t("game.correct")}</span>
                  )}
                  {isMyPick && !isCorrectChoice && (
                    <span className="ms-2 text-xs font-semibold">✗ {t("game.youPickedThis")}</span>
                  )}
                </div>
              );
            })}

            {(reveal.correct_answer_text || reveal.explanation) && (
              <div className="rounded-md bg-surface-3 p-4 text-sm text-ink-muted">
                {reveal.correct_answer_text && (
                  <p>
                    <span className="font-semibold text-ink">{t("game.correctAnswerIs")} </span>
                    {reveal.correct_answer_text}
                  </p>
                )}
                {reveal.explanation && (
                  <p className="mt-1">
                    <span className="font-semibold text-ink">{t("game.why")}: </span>
                    {reveal.explanation}
                  </p>
                )}
              </div>
            )}

            <p className="text-center text-xs text-ink-muted">{t("game.waitingForQuestion")}</p>
          </div>
        )}

        {!isActive && !reveal && (
          <p className="text-center text-sm text-ink-muted">
            {wasSubmitted ? t("game.revealingAnswer") : t("game.loadingResults")}
          </p>
        )}
      </Card>

      <button
        type="button"
        onClick={leaveGame}
        className="mt-4 text-center text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {t("game.leaveGame")}
      </button>
    </div>
  );
}

function findActiveQuestion(questions, nowEpoch) {
  return (
    questions.find(
      (q) =>
        q.started_at &&
        new Date(q.started_at).getTime() <= nowEpoch &&
        q.ends_at &&
        new Date(q.ends_at).getTime() > nowEpoch
    ) ?? null
  );
}

function findFeedbackQuestion(questions, nowEpoch) {
  const ended = questions.filter(
    (q) =>
      q.started_at &&
      new Date(q.started_at).getTime() <= nowEpoch &&
      q.ends_at &&
      new Date(q.ends_at).getTime() <= nowEpoch
  );
  return ended.length ? ended[ended.length - 1] : null;
}