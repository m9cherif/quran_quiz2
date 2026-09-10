import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { fisherYatesShuffle } from "@/lib/quiz/shuffle";

export const runtime = "nodejs";

const EDITABLE_STATUSES = ["draft", "waiting", "running", "paused"];

/**
 * Ports save_ordering_question — exact live SQL body supplied for this task
 * (not present in any migration file; confirmed schema drift).
 *
 * items[] arrive in their correct order; each gets shuffled into display
 * order, then correct_answer_text[i] (pipe-joined) is set to the display
 * index of the item that truly belongs at correct position i — same
 * encoding src/components/quiz/QuizEditor.jsx already decodes when it
 * rebuilds `items` from `correct_answer_text` + `choices`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id: competitionId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const db = getDb();
  const compRows = await db
    .select({ ownerId: competitions.ownerId, status: competitions.status })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  const comp = compRows[0];
  if (!comp || comp.ownerId !== user.id || !EDITABLE_STATUSES.includes(comp.status)) {
    return NextResponse.json(
      { error: "Only the quiz owner can edit questions here" },
      { status: 403 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Question text is required" }, { status: 400 });

  const position = Number(body.position);
  if (!Number.isFinite(position) || position < 1) {
    return NextResponse.json({ error: "Position must be at least 1" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? (body.items as unknown[]) : [];
  const items = rawItems
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter((v) => v !== "");
  if (items.length < 2) {
    return NextResponse.json(
      { error: "An ordering question needs at least two items" },
      { status: 400 }
    );
  }
  if (items.length > 20) {
    return NextResponse.json({ error: "At most 20 items" }, { status: 400 });
  }

  // Shuffle into display order; each item keeps its true (correct) rank.
  const withRank = items.map((itemText, rank) => ({ text: itemText, rank }));
  const shuffled = fisherYatesShuffle(withRank);
  const bySlot: number[] = new Array(items.length);
  shuffled.forEach((item, displayIndex) => {
    bySlot[item.rank] = displayIndex;
  });
  const solution = bySlot.join("|");

  const questionId = typeof body.questionId === "string" && body.questionId ? body.questionId : null;
  const fields = {
    position,
    text,
    type: "ordering",
    durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : 60,
    points: typeof body.points === "number" ? body.points : null,
    negativePoints: typeof body.negativePoints === "number" ? body.negativePoints : null,
    explanation: typeof body.explanation === "string" ? body.explanation : null,
    hint: typeof body.hint === "string" && body.hint.trim() ? body.hint.trim() : null,
    correctAnswerText: solution,
    surahNumber: typeof body.surahNumber === "number" ? body.surahNumber : null,
    ayahNumber: typeof body.ayahNumber === "number" ? body.ayahNumber : null,
  };

  let error: { message: string; status: number } | null = null;
  let qid = questionId ?? "";

  await db.transaction(async (tx) => {
    if (!questionId) {
      qid = newId();
      await tx.insert(questions).values({ id: qid, competitionId, ...fields });
    } else {
      const existing = await tx
        .select({ competitionId: questions.competitionId, startedAt: questions.startedAt })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1);
      const row = existing[0];
      if (!row || row.competitionId !== competitionId) {
        error = { message: "Question does not belong to this quiz", status: 400 };
        return;
      }
      if (row.startedAt !== null) {
        error = {
          message: "A question that has already started can no longer be edited",
          status: 403,
        };
        return;
      }
      qid = questionId;
      await tx.update(questions).set(fields).where(eq(questions.id, qid));
    }

    await tx.delete(choices).where(eq(choices.questionId, qid));
    for (let i = 0; i < shuffled.length; i++) {
      await tx.insert(choices).values({
        id: newId(),
        questionId: qid,
        text: shuffled[i].text,
        position: i + 1,
        isCorrect: false,
      });
    }
  });

  if (error) {
    const e = error as { message: string; status: number };
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return NextResponse.json({ id: qid });
}
