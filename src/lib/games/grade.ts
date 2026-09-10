import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";

type QuestionRow = typeof questions.$inferSelect;
type CompetitionRow = typeof competitions.$inferSelect;

export interface GradeInput {
  choiceId: string | null;
  answerText: string | null;
  responseTimeMs: number;
  submittedAt: Date;
}

export interface GradeResult {
  isCorrect: boolean;
  points: number;
  bonusPoints: number;
}

/** Postgres `round(x::numeric, 1)` — standard round-half-away-from-zero. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Ports `grade_answer()` (the old BEFORE INSERT/UPDATE trigger on `answers`).
 * Called explicitly, inside a transaction, by every route that writes to
 * `answers` — this is the only place in the app allowed to compute
 * is_correct/points/bonus_points.
 */
export async function computeAnswerGrade(
  tx: Db,
  question: QuestionRow,
  competition: CompetitionRow,
  input: GradeInput
): Promise<GradeResult> {
  const { choiceId, answerText, responseTimeMs, submittedAt } = input;
  const answered = choiceId !== null || answerText !== null;

  if (question.type === "page_words" || question.type === "ordering") {
    const expectedRaw = question.correctAnswerText ?? "";
    const expected = expectedRaw === "" ? [] : expectedRaw.split("|");
    const givenRaw = answerText ?? "";
    const given = givenRaw === "" ? [] : givenRaw.split("|");
    const total = expected.length;

    let hits = 0;
    for (let i = 0; i < total; i++) {
      if (i < given.length && given[i].trim() === expected[i].trim()) hits++;
    }
    const isCorrect = total > 0 && hits === total;
    const base = question.points ?? competition.defaultPoints ?? 0;

    let points = 0;
    if (total > 0 && hits > 0) {
      points = round1((base * hits) / total);
    } else if (answered) {
      points = question.negativePoints ?? competition.defaultNegativePoints ?? 0;
    }

    let bonusPoints = 0;
    if (isCorrect && competition.speedBonusEnabled) {
      const durationMs = question.durationSeconds * 1000;
      if (durationMs > 0 && responseTimeMs >= 0 && responseTimeMs < durationMs) {
        bonusPoints = round1(base * (1 - responseTimeMs / durationMs));
      }
    }
    return { isCorrect, points, bonusPoints };
  }

  let isCorrect = false;
  if (question.type === "mcq" || question.type === "true_false") {
    if (choiceId) {
      const rows = await tx
        .select({ isCorrect: choices.isCorrect })
        .from(choices)
        .where(and(eq(choices.id, choiceId), eq(choices.questionId, question.id)))
        .limit(1);
      isCorrect = Boolean(rows[0]?.isCorrect);
    }
  } else {
    isCorrect =
      (answerText ?? "").trim().toLowerCase() === (question.correctAnswerText ?? "").trim().toLowerCase();
  }

  let points = 0;
  let bonusPoints = 0;
  const endsAt = question.endsAt;
  if (endsAt && submittedAt.getTime() > endsAt.getTime()) {
    isCorrect = false;
    points = 0;
    bonusPoints = 0;
  } else if (isCorrect) {
    points = question.points ?? competition.defaultPoints ?? 0;
    const durationMs = question.durationSeconds * 1000;
    if (competition.speedBonusEnabled && durationMs > 0 && responseTimeMs >= 0 && responseTimeMs < durationMs) {
      bonusPoints = round1(points * (1 - responseTimeMs / durationMs));
    }
  } else if (answered) {
    points = question.negativePoints ?? competition.defaultNegativePoints ?? 0;
  }

  return { isCorrect, points, bonusPoints };
}
