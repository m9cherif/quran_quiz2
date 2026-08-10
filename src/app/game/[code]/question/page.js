"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { removeParticipant, cleanQuestions } from "@/store/Slices/participantSlice";
import { removeRoom } from "@/store/Slices/roomSlice";
import API_CONFIG from "@/app/components/API";

/**
 * GameQuestion — student answer screen.
 * Preserves the legacy flow: per-question client timer, submit to the
 * updateScore endpoint, per-question feedback, final score screen.
 */
export default function GameQuestion() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { questions, participant } = useSelector((state) => ({
    questions: state.participant.Questions,
    participant: state.participant.Participant,
  }));

  const questionList = questions[0] ?? [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = questionList[currentIndex];
  const totalTime = currentQuestion?.time ?? 0;
  const timeTaken = timeLeft === null ? 0 : totalTime - timeLeft;

  const submitScore = async (payload) => {
    const END_POINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}${API_CONFIG.updateScore}`;
    const response = await fetch(END_POINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Score submission failed: ${response.statusText}`);
    }
  };

  const handleSubmitAnswer = async (isTimeOut = false) => {
    if (!isTimeOut && !selectedAnswer) return;

    const isCorrect = !isTimeOut && selectedAnswer === currentQuestion.correct_answer;
    const pointsEarned = isCorrect ? Math.round(100 * (1 - timeTaken / (totalTime || 1))) : 0;
    const newScore = score + pointsEarned;

    setSubmitting(true);
    setError("");
    try {
      await submitScore({
        id: participant.id,
        room_key: participant.room_key,
        name: participant.name,
        score: newScore,
      });
      setScore(newScore);
      if (isCorrect) setCorrectCount((c) => c + 1);
      setAnsweredCount((c) => c + 1);
      setAnswerSubmitted(true);
    } catch (err) {
      console.error("Score submission failed:", err);
      setError("Failed to submit your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setSelectedAnswer(null);
    setAnswerSubmitted(false);
    setError("");
  }, [currentIndex]);

  const handleSubmitAnswerRef = useRef(handleSubmitAnswer);
  handleSubmitAnswerRef.current = handleSubmitAnswer;

  useEffect(() => {
    if (!currentQuestion || quizCompleted) return;

    setTimeLeft(currentQuestion.time);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitAnswerRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, quizCompleted]);

  if (!participant?.id || questionList.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">Session expired</h1>
          <p className="mt-2 text-sm text-ink-muted">
            The game session is no longer available on this device.
          </p>
          <Button href="/join" className="mt-6 w-full">
            Join a game
          </Button>
        </Card>
      </div>
    );
  }

  const resetSession = () => {
    dispatch(removeParticipant());
    dispatch(cleanQuestions());
    dispatch(removeRoom());
    router.push("/join");
  };

  if (quizCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
        <Card padding="lg" className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.3 14.6-4.5-4.5a1 1 0 0 1 1.4-1.4l3.8 3.8 6.2-6.2a1 1 0 0 1 1.4 1.4l-8.3 8.3Z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-ink">Quiz completed!</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {participant.name}, here is your result.
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-md bg-surface-3 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Score</dt>
              <dd className="mt-1 text-xl font-bold text-ink">{score}</dd>
            </div>
            <div className="rounded-md bg-surface-3 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Correct</dt>
              <dd className="mt-1 text-xl font-bold text-success-strong">{correctCount}</dd>
            </div>
            <div className="rounded-md bg-surface-3 p-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Answered</dt>
              <dd className="mt-1 text-xl font-bold text-ink">
                {answeredCount}/{questionList.length}
              </dd>
            </div>
          </dl>
          <Button onClick={resetSession} className="mt-6 w-full">
            Return home
          </Button>
          <p className="mt-3 text-xs text-ink-muted">
            The host can see the full leaderboard.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">
          Question {currentIndex + 1} of {questionList.length}
        </p>
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-ink">Score: {score}</p>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              timeLeft !== null && timeLeft <= 5
                ? "bg-danger-soft text-danger-strong"
                : "bg-primary-soft text-primary"
            }`}
            aria-live="polite"
          >
            {timeLeft !== null ? `${timeLeft}s` : "…"}
          </span>
        </div>
      </div>

      <Card padding="lg" className="space-y-5">
        <h1 className="text-lg font-semibold leading-relaxed text-ink">
          {currentQuestion.question}
        </h1>

        <div role="group" aria-label="Answer choices" className="grid gap-2.5">
          {currentQuestion.answers.map((answer, idx) => {
            const isCorrectChoice = answerSubmitted && answer === currentQuestion.correct_answer;
            const isWrongPick = answerSubmitted && selectedAnswer === answer && answer !== currentQuestion.correct_answer;
            return (
              <button
                key={idx}
                type="button"
                disabled={answerSubmitted}
                onClick={() => setSelectedAnswer(answer)}
                aria-pressed={selectedAnswer === answer}
                className={`w-full rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring disabled:cursor-not-allowed ${
                  isCorrectChoice
                    ? "border-success bg-success-soft text-success-strong"
                    : isWrongPick
                      ? "border-danger bg-danger-soft text-danger-strong"
                      : answerSubmitted
                        ? "border-border bg-surface-2 text-ink-faint"
                        : selectedAnswer === answer
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-surface text-ink hover:border-primary hover:bg-surface-2"
                }`}
              >
                <span className="me-3 inline-block w-5 text-center font-semibold text-ink-faint">
                  {String.fromCharCode(65 + idx)}
                </span>
                {answer}
                {isCorrectChoice && (
                  <span className="ms-2 text-xs font-semibold">Correct</span>
                )}
                {isWrongPick && (
                  <span className="ms-2 text-xs font-semibold">Wrong</span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!selectedAnswer || answerSubmitted}
          loading={submitting}
          onClick={() => handleSubmitAnswer()}
        >
          {answerSubmitted ? "Submitted" : "Submit answer"}
        </Button>

        {answerSubmitted && (
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setCurrentIndex((i) => i + 1)}>
              Next question
            </Button>
            {currentIndex >= questionList.length - 1 && (
              <Button variant="secondary" onClick={() => setQuizCompleted(true)}>
                See results
              </Button>
            )}
          </div>
        )}
      </Card>

      <Link
        href="/join"
        className="mt-4 text-center text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Leave the game
      </Link>
    </div>
  );
}