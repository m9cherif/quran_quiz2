import { NextResponse } from "next/server";
import { and, asc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { competitions, questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

const ACTIVE_STATUSES = new Set(["waiting", "running", "paused"]);

/**
 * Ports advance_game(): closes whatever question is open (if any) and opens
 * the next un-started one, in a single transaction — the host's "next
 * question" button, replacing the old end→begin pair so a failed second
 * call can't strand the round half-advanced.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const db = getDb();
    const user = await getSessionUserFromCookies();
    if (!user) throw new GameError("42501", "Only the game host can run questions");

    const result = await db.transaction(async (tx) => {
      const compRows = await tx.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
      const competition = compRows[0];
      if (!competition) throw new GameError("P0002", "Game not found");
      // Ports `owner_id is null or owner_id <> auth.uid()` — unlike
      // begin_question, this check *does* require an owner to be set.
      if (competition.ownerId === null || competition.ownerId !== user.id) {
        throw new GameError("42501", "Only the game host can run questions");
      }
      if (!ACTIVE_STATUSES.has(competition.status)) {
        throw new GameError("28000", "Game is not active");
      }

      const now = new Date();

      const openRows = await tx
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.competitionId, competitionId),
            isNotNull(questions.startedAt),
            or(isNull(questions.endsAt), gt(questions.endsAt, now))
          )
        )
        .orderBy(asc(questions.position))
        .limit(1);
      const open = openRows[0] ?? null;
      if (open) {
        await tx.update(questions).set({ endsAt: now }).where(eq(questions.id, open.id));
      }

      const nextRows = await tx
        .select()
        .from(questions)
        .where(and(eq(questions.competitionId, competitionId), isNull(questions.startedAt)))
        .orderBy(asc(questions.position))
        .limit(1);
      const next = nextRows[0] ?? null;

      let endsAt: Date | null = null;
      if (next) {
        const windowSeconds = Math.min(next.durationSeconds, Math.max(competition.minutesPerQuestion || 1, 1) * 60);
        endsAt = new Date(now.getTime() + windowSeconds * 1000);
        await tx.update(questions).set({ startedAt: now, endsAt }).where(eq(questions.id, next.id));
        if (competition.status !== "running") {
          await tx.update(competitions).set({ status: "running" }).where(eq(competitions.id, competitionId));
        }
      }

      const remainingRows = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.competitionId, competitionId), isNull(questions.startedAt)));
      const hasMore = remainingRows.some((r) => r.id !== next?.id);

      return {
        competitionId,
        closedQuestionId: open?.id ?? null,
        startedQuestionId: next?.id ?? null,
        startedPosition: next?.position ?? null,
        endsAt,
        hasMore,
      };
    });

    if (result.closedQuestionId) {
      emit(result.competitionId, {
        type: "question-ended",
        payload: { question_id: result.closedQuestionId, ends_at: new Date().toISOString() },
      });
    }
    if (result.startedQuestionId) {
      emit(result.competitionId, {
        type: "question-started",
        payload: {
          question_id: result.startedQuestionId,
          position: result.startedPosition,
          ends_at: result.endsAt?.toISOString() ?? null,
        },
      });
    }

    return NextResponse.json({
      closed_question_id: result.closedQuestionId,
      started_question_id: result.startedQuestionId,
      started_position: result.startedPosition,
      ends_at: result.endsAt?.toISOString() ?? null,
      has_more: result.hasMore,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
