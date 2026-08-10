"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  getGameByCode,
  getMyParticipant,
  getMyAnswers,
  getLeaderboard,
} from "@/services/games";
import { removeParticipant } from "@/store/Slices/participantSlice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

/**
 * GameResult — final screen for students once the host finishes the game:
 * personal summary (score, correct/answered) + the ranked leaderboard with
 * the own row highlighted.
 */
export default function GameResult({ params }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const participant = useSelector((state) => state.participant.Participant);
  const code = typeof params?.code === "string" ? params.code.toUpperCase() : "";

  const competitionId = participant?.competitionId ?? null;
  const accessToken = participant?.accessToken ?? null;

  const [leaderboard, setLeaderboard] = useState([]);
  const [summary, setSummary] = useState(null);
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
        const [allAnswers, rows] = await Promise.all([
          getMyAnswers(competitionId, accessToken),
          getLeaderboard(competitionId),
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
          <h1 className="text-lg font-semibold text-ink">Session expired</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your game session is missing. Join again with the game code.
          </p>
          <Button href="/join" className="mt-6 w-full">
            Join a game
          </Button>
        </Card>
      </div>
    );
  }

  if (state === "not-finished") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">The game is still running</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Results appear once the host finishes the game.
          </p>
          <Button href={`/game/${code}`} className="mt-6 w-full">
            Back to the game
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
          <p className="mt-4 text-sm font-medium text-ink">Loading results…</p>
        </div>
      </div>
    );
  }

  const myRow = leaderboard.find((row) => row.participant_id === participant?.id);
  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-10">
      <Card padding="lg" className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.3 14.6-4.5-4.5a1 1 0 0 1 1.4-1.4l3.8 3.8 6.2-6.2a1 1 0 0 1 1.4 1.4l-8.3 8.3Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink">Game finished!</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {participant.displayName}, here is your result.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-md bg-surface-3 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Score</dt>
            <dd className="mt-1 text-xl font-bold text-ink">{Math.round(summary.score)}</dd>
          </div>
          <div className="rounded-md bg-surface-3 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Correct</dt>
            <dd className="mt-1 text-xl font-bold text-success-strong">{summary.correct}</dd>
          </div>
          <div className="rounded-md bg-surface-3 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Rank</dt>
            <dd className="mt-1 text-xl font-bold text-primary">
              {myRow ? `#${myRow.rank}` : "–"}
            </dd>
          </div>
        </dl>
        <Button onClick={leaveGame} className="mt-6 w-full">
          Return home
        </Button>
      </Card>

      <Card padding="lg" className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Leaderboard</h2>
          <Badge variant="secondary">{leaderboard.length} players</Badge>
        </div>

        <ol className="mt-4 space-y-2">
          {leaderboard.map((row) => {
            const isMe = row.participant_id === participant?.id;
            const isTop3 = topThree.some((t) => t.participant_id === row.participant_id);
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
                    {isMe && <span className="ms-2 text-xs font-semibold">(you)</span>}
                  </span>
                </span>
                <span className="text-xs text-ink-muted">
                  {row.correct_count}/{row.answered_count} ·{" "}
                  <span className="font-semibold text-ink">{Math.round(row.total_points)} pts</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}