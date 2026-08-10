"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { setRoom } from "@/store/Slices/roomSlice";
import API_CONFIG from "@/app/components/API";

const QUIZ_SETTINGS = { count: 3, time: 10 };

function buildEmptyQuestions(count) {
  return Array.from({ length: count }, () => ({
    question: "",
    answers: ["", "", "", ""],
    correct_answer: "",
    errors: { question: "", answers: ["", "", "", ""], correct_answer: "" },
  }));
}

const validateQuestion = (q) => {
  const errors = { question: "", answers: ["", "", "", ""], correct_answer: "" };
  if (!q.question.trim()) errors.question = "Question cannot be empty.";
  q.answers.forEach((answer, i) => {
    if (!answer.trim()) errors.answers[i] = `Option ${i + 1} cannot be empty.`;
  });
  if (!q.correct_answer) errors.correct_answer = "Select the correct answer.";
  return errors;
};

/**
 * QuizBuilder — quiz settings (count/time) then the question editor.
 * Submission posts to the legacy addQuiz endpoint, then routes to the
 * live game control screen.
 */
export default function QuizBuilder() {
  const [step, setStep] = useState("settings");
  const [count, setCount] = useState(QUIZ_SETTINGS.count);
  const [time, setTime] = useState(QUIZ_SETTINGS.time);
  const [settingsError, setSettingsError] = useState("");
  const [questions, setQuestions] = useState(() => buildEmptyQuestions(QUIZ_SETTINGS.count));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);

  const goToEditor = (e) => {
    e.preventDefault();
    if (count < 1 || count > 10) {
      setSettingsError("Number of questions must be between 1 and 10.");
      return;
    }
    if (time < 5 || time > 60) {
      setSettingsError("Time per question must be between 5 and 60 seconds.");
      return;
    }
    setSettingsError("");
    setQuestions(buildEmptyQuestions(count));
    setStep("editor");
  };

  const updateQuestion = (qIndex, patch) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, ...patch } : q))
    );
  };

  const updateOption = (qIndex, optIndex, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const answers = q.answers.map((a, j) => (j === optIndex ? value : a));
        const correct_answer =
          q.correct_answer === q.answers[optIndex] ? value : q.correct_answer;
        return { ...q, answers, correct_answer };
      })
    );
  };

  const setCorrectOption = (qIndex, optIndex) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, correct_answer: q.answers[optIndex] } : q
      )
    );
  };

  const handleSubmit = async () => {
    const withErrors = questions.map((q) => ({ ...q, errors: validateQuestion(q) }));
    setQuestions(withErrors);
    if (withErrors.some((q) => q.errors.question || q.errors.correct_answer || q.errors.answers.some(Boolean))) {
      return;
    }

    setIsSubmitting(true);
    const END_POINT = `${process.env.NEXT_PUBLIC_BACKEND_URL}${API_CONFIG.addQuiz}`;

    try {
      const response = await fetch(END_POINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.user_id,
          time,
          questions: withErrors.map(({ errors, ...q }) => q),
        }),
      });

      const responseData = await response.json();

      if (response.ok && responseData?.room_key) {
        dispatch(setRoom(String(responseData.room_key)));
        router.push(`/host/games/${responseData.room_key}`);
      } else {
        alert("Failed to create quiz. Please try again.");
      }
    } catch (err) {
      console.error("Failed to submit quiz:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "settings") {
    return (
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink">Customize the quiz</h1>
        <Card padding="lg" className="mt-6">
          <form onSubmit={goToEditor} className="space-y-5" noValidate>
            <Input
              label="Number of questions"
              type="number"
              min={1}
              max={10}
              required
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
              hint="Between 1 and 10."
            />
            <Input
              label="Time per question (seconds)"
              type="number"
              min={5}
              max={60}
              required
              value={time}
              onChange={(e) => setTime(parseInt(e.target.value, 10) || 0)}
              hint="Between 5 and 60 seconds."
              error={settingsError || undefined}
            />
            <Button type="submit" className="w-full" size="lg">
              Next: add questions
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Add your questions</h1>
        <Button variant="ghost" onClick={() => setStep("settings")}>
          Back to settings
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {questions.map((q, qIndex) => (
          <Card key={qIndex} className="space-y-4">
            <p className="text-sm font-semibold text-ink">Question {qIndex + 1}</p>
            <Input
              label="Question"
              placeholder="Type the question"
              required
              value={q.question}
              onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
              error={q.errors.question || undefined}
            />
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-ink">
                Options — mark the correct one
              </legend>
              <div className="space-y-2.5">
                {q.answers.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-3">
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-ink-muted">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correct_answer === option}
                        onChange={() => setCorrectOption(qIndex, optIndex)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="sr-only">Mark option {optIndex + 1} as correct</span>
                    </label>
                    <input
                      type="text"
                      value={option}
                      placeholder={`Option ${optIndex + 1}`}
                      onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                      aria-invalid={q.errors.answers[optIndex] ? true : undefined}
                      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring"
                    />
                  </div>
                ))}
              </div>
              {(q.errors.correct_answer || q.errors.answers.some(Boolean)) && (
                <p className="mt-1.5 text-sm text-danger" role="alert">
                  {q.errors.correct_answer ||
                    q.errors.answers.find(Boolean) ||
                    "Fix the highlighted fields."}
                </p>
              )}
            </fieldset>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button loading={isSubmitting} onClick={handleSubmit} size="lg">
          Create quiz
        </Button>
      </div>
    </div>
  );
}