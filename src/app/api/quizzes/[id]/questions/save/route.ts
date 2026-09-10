import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

const EDITABLE_STATUSES = ["draft", "waiting", "running", "paused"];

interface ChoiceInput {
  text?: unknown;
  position?: unknown;
  is_correct?: unknown;
  isCorrect?: unknown;
}

/**
 * Ports save_question — latest body from
 * supabase/migrations/20260812072000_save_question_accept_both_choice_keys.sql.
 *
 * Deviation: also persists audio_url and hint (columns already on
 * `questions`). Neither appears in any committed save_question body, but
 * src/components/quiz/QuizEditor.jsx sends both (`audioUrl`, `hint`) on
 * every save and reads them back from get_quiz_questions_full — the same
 * kind of live-database drift the task's given save_ordering_question body
 * documents for that RPC. Persisting them is what makes the editor's audio
 * question type and per-question hints actually round-trip; not persisting
 * them would silently drop data the UI collects.
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
      {
        error:
          "Only the quiz owner can add or edit questions while the quiz is a draft, the lobby is open, or the game is live",
      },
      { status: 403 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Question text is required" }, { status: 400 });
  const position = Number(body.position);
  if (!Number.isFinite(position) || position < 1) {
    return NextResponse.json({ error: "Position must be at least 1" }, { status: 400 });
  }

  const type = typeof body.type === "string" && body.type ? body.type : "mcq";
  const questionId = typeof body.questionId === "string" && body.questionId ? body.questionId : null;
  const correctAnswerText =
    typeof body.correctAnswerText === "string" && body.correctAnswerText !== ""
      ? body.correctAnswerText
      : null;
  const rawChoices = Array.isArray(body.choices) ? (body.choices as ChoiceInput[]) : [];

  const fields = {
    position,
    text,
    type,
    durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : 15,
    points: typeof body.points === "number" ? body.points : null,
    negativePoints: typeof body.negativePoints === "number" ? body.negativePoints : null,
    explanation: typeof body.explanation === "string" ? body.explanation : null,
    correctAnswerText,
    surahNumber: typeof body.surahNumber === "number" ? body.surahNumber : null,
    ayahNumber: typeof body.ayahNumber === "number" ? body.ayahNumber : null,
    pageNumber: typeof body.pageNumber === "number" ? body.pageNumber : null,
    juzNumber: typeof body.juzNumber === "number" ? body.juzNumber : null,
    hizbNumber: typeof body.hizbNumber === "number" ? body.hizbNumber : null,
    audioUrl: typeof body.audioUrl === "string" && body.audioUrl ? body.audioUrl : null,
    hint: typeof body.hint === "string" && body.hint ? body.hint : null,
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
    let insertedAny = false;
    for (const c of rawChoices) {
      const cText = typeof c.text === "string" ? c.text.trim() : "";
      if (!cText) continue;
      const isCorrect = Boolean(c.is_correct ?? c.isCorrect ?? false);
      await tx.insert(choices).values({
        id: newId(),
        questionId: qid,
        text: cText,
        position: typeof c.position === "number" ? c.position : 0,
        isCorrect,
      });
      insertedAny = true;
    }

    if (type === "true_false" && !insertedAny) {
      const answer = (correctAnswerText ?? "").trim().toLowerCase();
      await tx.insert(choices).values([
        { id: newId(), questionId: qid, text: "True", position: 1, isCorrect: answer === "true" },
        { id: newId(), questionId: qid, text: "False", position: 2, isCorrect: answer === "false" },
      ]);
    }
  });

  if (error) {
    const e = error as { message: string; status: number };
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return NextResponse.json({ id: qid });
}
