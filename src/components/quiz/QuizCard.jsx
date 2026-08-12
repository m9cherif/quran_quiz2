"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * QuizCard — quiz library tile: name, meta chips, question/participant
 * counts, and actions (edit / duplicate / archive / delete).
 */
export function QuizCard({ quiz, onDuplicate, onDelete, busy = false }) {
  const { t } = useI18n();

  const statusBadge = {
    draft: t("common.draft"),
    waiting: t("common.waiting"),
    running: t("common.running"),
    paused: t("common.paused"),
    finished: t("common.finished"),
    cancelled: t("common.cancelled"),
    scheduled: t("common.scheduled"),
  };
  const badge = {
    variant:
      quiz.status === "running"
        ? "success"
        : quiz.status === "paused" || quiz.status === "scheduled"
          ? "warning"
          : quiz.status === "cancelled"
            ? "danger"
            : "neutral",
    label: statusBadge[quiz.status] ?? t("common.draft"),
  };

  return (
    <Card className="flex flex-col gap-4" interactive animate={false}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/host/quizzes/${quiz.id}/edit`}
            className="line-clamp-2 text-base font-semibold text-ink transition-colors hover:text-primary"
          >
            {quiz.name}
          </Link>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
            {quiz.description || t("editor.noDescription")}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <Badge variant="neutral">
          {quiz.question_count} {t("common.questionWord")}
        </Badge>
        {quiz.participant_count > 0 && (
          <Badge variant="neutral">
            {quiz.participant_count} {t("common.players")}
          </Badge>
        )}
        <Badge variant="neutral">
          {quiz.language.toUpperCase()} · {quiz.category ?? "general"} · {quiz.difficulty ?? "any"}
        </Badge>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button href={`/host/quizzes/${quiz.id}/edit`} size="sm" className="flex-1">
          {quiz.status === "draft" ? t("editor.editLabel") : t("editor.openLabel")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDuplicate(quiz)}
          disabled={busy}
        >
          {t("editor.duplicateAction")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(quiz)}
          disabled={busy}
        >
          {t("common.delete")}
        </Button>
      </div>
    </Card>
  );
}

export default QuizCard;
