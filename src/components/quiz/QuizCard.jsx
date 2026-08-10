"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const STATUS_BADGE = {
  draft: { variant: "neutral", label: "Draft" },
  waiting: { variant: "info", label: "Waiting" },
  running: { variant: "success", label: "Running" },
  paused: { variant: "warning", label: "Paused" },
  finished: { variant: "info", label: "Finished" },
  cancelled: { variant: "danger", label: "Cancelled" },
  scheduled: { variant: "warning", label: "Scheduled" },
};

/**
 * QuizCard — quiz library tile: name, meta chips, question/participant
 * counts, and actions (edit / duplicate / archive / delete).
 */
export function QuizCard({ quiz, onDuplicate, onDelete, busy = false }) {
  const badge = STATUS_BADGE[quiz.status] ?? STATUS_BADGE.draft;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/host/quizzes/${quiz.id}/edit`}
            className="line-clamp-2 text-base font-semibold text-ink transition-colors hover:text-primary"
          >
            {quiz.name}
          </Link>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
            {quiz.description || "No description"}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <Badge variant="neutral">{quiz.question_count} questions</Badge>
        {quiz.participant_count > 0 && (
          <Badge variant="neutral">{quiz.participant_count} players</Badge>
        )}
        <Badge variant="neutral">
          {quiz.language.toUpperCase()} · {quiz.category ?? "general"} · {quiz.difficulty ?? "any"}
        </Badge>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button href={`/host/quizzes/${quiz.id}/edit`} size="sm" className="flex-1">
          {quiz.status === "draft" ? "Edit" : "Open"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDuplicate(quiz)}
          disabled={busy}
        >
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(quiz)}
          disabled={busy}
        >
          Delete
        </Button>
      </div>
    </Card>
  );
}

export default QuizCard;
