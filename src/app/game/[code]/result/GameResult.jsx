"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  getGameByCode,
  getMyParticipant,
  getMyAnswers,
  getLeaderboard,
  listStudentQuestions,
  listChoices,
} from "@/services/games";
import { removeParticipant } from "@/store/Slices/participantSlice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import Confetti from "@/components/ui/Confetti";

/**
 * GameResult — final screen for students once the host finishes the game:
 * personal summary (score, correct/answered) + the ranked leaderboard with
 * the own row highlighted.
 */
export default function GameResult({ code }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useI18n();
  const participant = useSelector((state) => state.participant.Participant);

  const competitionId = participant?.competitionId ?? null;
  const accessToken = participant?.accessToken ?? null;

  const [leaderboard, setLeaderboard] = useState([]);
  const [summary, setSummary] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | not-finished | expired
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    if (!competitionId || !accessToken) {
      setState("expired");
      return;
    }
    loadedRef.current = true;

    const load = async () => {
      try {
        const mine = await getMyParticipant(competitionId, accessToken);
        if (!mine) {
          setState("expired");
          return;
        }
        const game = await getGameByCode(code);
        if (!game || game.id !== competitionId || game.status !== "finished") {
          setState("not-finished");
          return;
        }
        const [allAnswers, rows, questions] = await Promise.all([
          getMyAnswers(competitionId, accessToken),
          // The leaderboard RPC admits owners and participants only, so the
          // student identifies itself with the participant token.
          getLeaderboard(competitionId, accessToken),
          listStudentQuestions(competitionId, accessToken),
        ]);
        const totals = allAnswers.reduce(
          (acc, a) => {
            acc.score += (a.points ?? 0) + (a.bonus_points ?? 0);
            if (a.is_correct) acc.correct += 1;
            acc.answered += 1;
            return acc;
          },
          { score: 0, correct: 0, answered: 0 }
        );
        const choices = await listChoices(
          questions.map((q) => q.id),
          accessToken
        );
        const choicesByQuestion = {};
        for (const choice of choices) {
          choicesByQuestion[choice.question_id] = choicesByQuestion[choice.question_id] || [];
          choicesByQuestion[choice.question_id].push(choice);
        }
        const answerByQuestion = {};
        for (const answer of allAnswers) {
          answerByQuestion[answer.question_id] = answer;
        }
        setBreakdown(
          questions.map((q) => {
            const answer = answerByQuestion[q.id];
            const myChoice = answer?.choice_id
              ? (choicesByQuestion[q.id] || []).find((c) => c.id === answer.choice_id)
              : null;
            return {
              position: q.position,
              text: q.text,
              type: q.type,
              answer,
              myChoiceText: myChoice?.text ?? answer?.answer_text ?? null,
              isCorrect: Boolean(answer?.is_correct),
              points: answer ? (answer.points ?? 0) + (answer.bonus_points ?? 0) : 0,
              skipped: !answer,
            };
          })
        );
        setSummary(totals);
        setLeaderboard(rows);
        setState("ready");
      } catch (err) {
        console.error("Result load failed:", err);
        setState("expired");
      }
    };
    load();
  }, [competitionId, accessToken, code, participant.id]);

  const leaveGame = () => {
    dispatch(removeParticipant());
    router.push("/join");
  };

  if (state === "expired") {
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

  if (state === "not-finished") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">{t("game.gameStillRunning")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("game.resultsAfterFinish")}</p>
          <Button href={`/game/${code}`} className="mt-6 w-full">
            {t("game.backToGame")}
          </Button>
        </Card>
      </div>
    );
  }

  if (state !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-ink">{t("game.loadingResults")}</p>
        </div>
      </div>
    );
  }

  const myRow = leaderboard.find((row) => row.participant_id === participant?.id);
  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="relative mx-auto min-h-screen max-w-xl px-4 py-10">
      {/* A podium finish deserves a moment. */}
      <Confetti fire={Boolean(myRow && myRow.rank <= 3)} pieces={140} duration={3200} />
      <Card padding="lg" className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.3 14.6-4.5-4.5a1 1 0 0 1 1.4-1.4l3.8 3.8 6.2-6.2a1 1 0 0 1 1.4 1.4l-8.3 8.3Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink">{t("game.gameFinishedTitle")}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t("game.yourResultIntro", { name: participant.displayName })}
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-md bg-surface-3 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("game.yourScore")}</dt>
            <dd className="mt-1 text-xl font-bold text-ink">{Math.round(summary.score)}</dd>
          </div>
          <div className="rounded-md bg-surface-3 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("game.correct")}</dt>
            <dd className="mt-1 text-xl font-bold text-success-strong">{summary.correct}</dd>
          </div>
          <div className="rounded-md bg-surface-3 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("game.yourRank")}</dt>
            <dd className="mt-1 text-xl font-bold text-primary">
              {myRow ? `#${myRow.rank}` : "–"}
            </dd>
          </div>
        </dl>
        <Button onClick={leaveGame} className="mt-6 w-full">
          {t("game.returnHome")}
        </Button>
      </Card>

      <Card padding="lg" className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{t("game.leaderboard")}</h2>
          <Badge variant="secondary">
            {leaderboard.length} {t("common.players")}
          </Badge>
        </div>

        {leaderboard.length >= 3 && (
          <div className="mt-4 grid grid-cols-3 items-end gap-2">
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
                    {slot === 0 ? t("game.firstPlace") : slot === 1 ? t("game.secondPlace") : t("game.thirdPlace")}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">{row.display_name}</p>
                  <p className="mt-0.5 text-lg font-bold">{Math.round(row.total_points)}</p>
                </div>
              );
            })}
          </div>
        )}

        <ol className="mt-4 space-y-2">
          {leaderboard.map((row) => {
            const isMe = row.participant_id === participant?.id;
            const isTop3 = topThree.some((tr) => tr.participant_id === row.participant_id);
            return (
              <li
                key={row.participant_id}
                className={`flex items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-sm ${
                  isMe
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isTop3 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-surface-3 text-ink-muted"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <span className="font-medium text-ink">
                    {row.display_name}
                    {isMe && (
                      <span className="ms-2 text-xs font-semibold">({t("game.you")})</span>
                    )}
                  </span>
                </span>
                <span className="text-xs text-ink-muted">
                  {row.correct_count}/{row.answered_count} ·{" "}
                  <span className="font-semibold text-ink">
                    {Math.round(row.total_points)} {t("common.points")}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card padding="lg" className="mt-6">
        <h2 className="text-base font-semibold text-ink">{t("game.yourAnswers")}</h2>
        <ul className="mt-4 space-y-2">
          {breakdown.map((item) => (
            <li
              key={item.position}
              className={`rounded-md border px-4 py-3 ${
                item.skipped
                  ? "border-border bg-surface"
                  : item.isCorrect
                    ? "border-success bg-success-soft/50"
                    : "border-danger bg-danger-soft/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-ink">
                  <span className="me-1.5 text-ink-faint">{item.position}.</span>
                  {item.text}
                </p>
                <span className="shrink-0 text-xs font-semibold text-ink-muted">
                  {item.skipped
                    ? t("game.skipped")
                    : item.isCorrect
                      ? `+${Math.round(item.points)}`
                      : t("game.wrong")}
                </span>
              </div>
              {!item.skipped && (
                <p className="mt-1 text-xs text-ink-muted">
                  {t("game.youAnswered")}{" "}
                  <span className="font-medium text-ink">{item.myChoiceText}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}