"use client";

import { Badge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { questionPoints } from "./QuestionForm";

const quranRef = (q) => {
  const parts = [];
  if (q.surah_number) parts.push(`Surah ${q.surah_number}`);
  if (q.ayah_number) parts.push(`Ayah ${q.ayah_number}`);
  if (q.juz_number) parts.push(`Juz ${q.juz_number}`);
  if (q.page_number) parts.push(`Page ${q.page_number}`);
  return parts.join(" · ");
};

/**
 * QuestionPreview — how students will see the question: timer, points,
 * and the choice/answer controls. Read-only mock (no timer animation).
 */
export function QuestionPreview({ question, defaults }) {
  const { points, negative } = questionPoints(question, defaults);
  const reference = quranRef(question);

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="info">Preview — {question.duration_seconds}s</Badge>
        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Badge variant="success">+{points} pts</Badge>
          {negative < 0 && <Badge variant="danger">{negative} pts</Badge>}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-ink">{question.text || "Question text…"}</p>
        {reference && <p className="mt-1 text-sm text-ink-muted">{reference}</p>}
      </div>

      {question.type === "mcq" && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="list" aria-label="Answer options">
          {question.choices.filter((c) => c.text.trim()).map((choice, i) => (
            <div
              key={i}
              className={cn(
                "flex cursor-default items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink transition-colors",
                choice.isCorrect && "border-success bg-success-soft text-success-strong"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink-muted">
                {["A", "B", "C", "D", "E", "F"][i] ?? i + 1}
              </span>
              {choice.text}
              {choice.isCorrect && (
                <span className="ms-auto rounded-full bg-success px-2 py-0.5 text-xs font-medium text-white">
                  Correct
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {question.type === "true_false" && (
        <div className="flex gap-3">
          {["True", "False"].map((value) => (
            <div
              key={value}
              className={cn(
                "flex-1 rounded-md border px-4 py-2.5 text-center text-sm font-medium",
                question.correct_answer_text === value
                  ? "border-success bg-success-soft text-success-strong"
                  : "border-border bg-surface text-ink-muted"
              )}
            >
              {value}
            </div>
          ))}
        </div>
      )}

      {(question.type === "text" || question.type === "number") && (
        <div className="rounded-md border border-dashed border-border bg-surface px-4 py-3 text-sm text-ink-muted">
          {question.type === "number" ? "Numeric answer field" : "Text answer field"}
          {question.correct_answer_text && (
            <div className="mt-2 text-success-strong">
              Expected: <b>{question.correct_answer_text}</b>
            </div>
          )}
        </div>
      )}

      {question.explanation && (
        <div className="rounded-md border-s-4 border-s-info bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          <span className="font-semibold text-ink">Why: </span>
          {question.explanation}
        </div>
      )}
    </Card>
  );
}

export default QuestionPreview;