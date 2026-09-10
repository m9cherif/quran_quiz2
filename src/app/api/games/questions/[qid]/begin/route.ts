import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getQuestion } from "@/lib/games/repo";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

const ACTIVE_STATUSES = new Set(["waiting", "running", "paused"]);

/**
 * Ports begin_question(). Note: the original owner check is `owner_id <>
 * auth.uid()` (not `owner_id IS NULL OR owner_id <> ...` like advance_game
 * below) — when a competition has no owner at all, that comparison is SQL
 * NULL and the `if` never fires, so an owner-less competition's questions
 * can be begun by any authenticated host. Preserved as-is (see final report).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const { qid } = await params;
    const db = getDb();

    const question = await getQuestion(qid, db);
    if (!question) throw new GameError("P0002", "Question not found");

    const user = await getSessionUserFromCookies();
    if (!user) throw new GameError("42501", "Only the game host can run questions");

    const competition = await getCompetition(question.competitionId, db);
    if (!competition) throw new GameError("P0002", "Game not found");
    if (competition.ownerId !== null && competition.ownerId !== user.id) {
      throw new GameError("42501", "Only the game host can run questions");
    }
    if (!ACTIVE_STATUSES.has(competition.status)) {
      throw new GameError("28000", "Game is not active");
    }
    if (question.startedAt !== null) {
      throw new GameError("22023", "Question already started");
    }

    const windowSeconds = Math.min(question.durationSeconds, Math.max(competition.minutesPerQuestion || 1, 1) * 60);
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + windowSeconds * 1000);

    await db.update(questions).set({ startedAt, endsAt }).where(eq(questions.id, qid));

    emit(competition.id, {
      type: "question-started",
      payload: { question_id: qid, started_at: startedAt.toISOString(), ends_at: endsAt.toISOString() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
