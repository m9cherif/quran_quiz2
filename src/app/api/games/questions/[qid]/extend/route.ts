import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { questions } from "@/lib/db/schema";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { GameError, errorResponse } from "@/lib/games/errors";
import { getCompetition, getQuestion, isOwner } from "@/lib/games/repo";
import { emit } from "@/lib/realtime/bus";

export const runtime = "nodejs";

/** Ports extend_question(): add (or, negative, remove) seconds from the open window. Host only. */
export async function POST(request: Request, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const { qid } = await params;
    const db = getDb();

    const question = await getQuestion(qid, db);
    if (!question) throw new GameError("P0002", "Question not found");
    const competition = await getCompetition(question.competitionId, db);
    const user = await getSessionUserFromCookies();
    if (!competition || !isOwner(competition, user?.id)) {
      throw new GameError("42501", "Only the game host can change the timer");
    }

    let body: { seconds?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const seconds = Number(body.seconds);
    if (!Number.isFinite(seconds) || seconds < -300 || seconds > 600) {
      throw new GameError("22023", "Out of range");
    }

    const now = new Date();
    const base = question.endsAt && question.endsAt.getTime() > now.getTime() ? question.endsAt : now;
    const endsAt = new Date(base.getTime() + seconds * 1000);

    await db.update(questions).set({ endsAt }).where(eq(questions.id, qid));

    emit(competition.id, { type: "question-updated", payload: { question_id: qid, ends_at: endsAt.toISOString() } });
    return NextResponse.json({ ends_at: endsAt.toISOString() });
  } catch (err) {
    return errorResponse(err);
  }
}
