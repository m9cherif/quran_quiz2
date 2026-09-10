import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { getSessionUserFromCookies } from "@/lib/db/session";
import { fisherYatesShuffle } from "@/lib/quiz/shuffle";

export const runtime = "nodejs";

const EDITABLE_STATUSES = ["draft", "waiting", "running", "paused"];

interface WordInput {
  text?: unknown;
  region?: unknown;
}
interface LocationInput {
  surah?: unknown;
  verse?: unknown;
  position?: unknown;
}

/**
 * Ports save_page_words_question — latest body from
 * supabase/migrations/20260909190000_page_words_use_open_quran_view.sql
 * (word_locations, open-quran-view addressing; the pixel-region predecessor
 * is retired on this branch — see that migration and
 * 20260909194500_restore_regions_compat_for_old_branch.sql's own notes).
 *
 * Chips (words) are shuffled into choice order; correct_answer_text[i]
 * (pipe-joined) is the shuffled/choice index of the chip that belongs in
 * word_locations[i] — same encoding QuizEditor.jsx decodes on load.
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

  const wordLocations = Array.isArray(body.wordLocations)
    ? (body.wordLocations as LocationInput[])
    : [];
  if (wordLocations.length === 0) {
    return NextResponse.json({ error: "Select at least one word" }, { status: 400 });
  }
  if (wordLocations.length > 40) {
    return NextResponse.json({ error: "A page exercise holds at most 40 words" }, { status: 400 });
  }

  const words = Array.isArray(body.words) ? (body.words as WordInput[]) : [];
  if (words.length !== wordLocations.length) {
    return NextResponse.json(
      { error: "Every selected word needs its text" },
      { status: 400 }
    );
  }

  const pageNumber = Number(body.pageNumber);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: "Pick a page" }, { status: 400 });
  }

  // Shuffle non-empty words into chip/choice order; each keeps its region.
  const withRegion = words
    .map((w) => ({ text: typeof w.text === "string" ? w.text.trim() : "", region: Number(w.region) }))
    .filter((w) => w.text !== "");
  if (withRegion.length !== wordLocations.length) {
    return NextResponse.json(
      { error: "Every selected word needs its text" },
      { status: 400 }
    );
  }
  const shuffled = fisherYatesShuffle(withRegion);
  const pairs = shuffled.map((item, idx) => ({ region: item.region, idx }));
  pairs.sort((a, b) => a.region - b.region);
  const solution = pairs.map((p) => p.idx).join("|");

  const questionId = typeof body.questionId === "string" && body.questionId ? body.questionId : null;
  const fields = {
    position: typeof body.position === "number" ? body.position : 1,
    text: "page_words",
    type: "page_words",
    durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : 120,
    points: typeof body.points === "number" ? body.points : null,
    negativePoints: typeof body.negativePoints === "number" ? body.negativePoints : null,
    explanation: typeof body.explanation === "string" ? body.explanation : null,
    correctAnswerText: solution,
    wordLocations: wordLocations.map((l) => ({
      surah: Number(l.surah),
      verse: Number(l.verse),
      position: Number(l.position),
    })),
    pageNumber,
    surahNumber: typeof body.surahNumber === "number" ? body.surahNumber : null,
    ayahNumber: typeof body.ayahNumber === "number" ? body.ayahNumber : null,
    juzNumber: typeof body.juzNumber === "number" ? body.juzNumber : null,
    hizbNumber: typeof body.hizbNumber === "number" ? body.hizbNumber : null,
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
