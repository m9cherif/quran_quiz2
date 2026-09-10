import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { choices, competitions, questions } from "@/lib/db/schema";
import { newId } from "@/lib/db/id";
import { generateCompetitionCode } from "@/lib/db/competitionCode";
import { getSessionUserFromCookies } from "@/lib/db/session";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["mcq", "true_false", "text", "number", "audio"]);

interface RawQuestion {
  text?: unknown;
  type?: unknown;
  duration_seconds?: unknown;
  points?: unknown;
  negative_points?: unknown;
  explanation?: unknown;
  correct_answer_text?: unknown;
  surah_number?: unknown;
  ayah_number?: unknown;
  page_number?: unknown;
  juz_number?: unknown;
  hizb_number?: unknown;
  choices?: unknown;
}
interface RawChoice {
  text?: unknown;
  is_correct?: unknown;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Ports import_quiz
 * (supabase/migrations/20260812070000_platform_upgrade_rpcs.sql, section 4):
 * builds a full draft quiz from an exported JSON payload. Trusts nothing
 * from the payload but text content — ids, status, owner, timing are always
 * server-decided, same as the RPC.
 */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json(
      { error: "Quiz name must be between 2 and 120 characters" },
      { status: 400 }
    );
  }
  const rawQuestions = Array.isArray(payload.questions) ? (payload.questions as RawQuestion[]) : [];
  if (!Array.isArray(payload.questions)) {
    return NextResponse.json({ error: "questions must be an array" }, { status: 400 });
  }
  if (rawQuestions.length > 200) {
    return NextResponse.json(
      { error: "A quiz cannot hold more than 200 questions" },
      { status: 400 }
    );
  }

  const db = getDb();
  const newQuizId = newId();
  const code = await generateCompetitionCode(db);

  await db.transaction(async (tx) => {
    await tx.insert(competitions).values({
      id: newQuizId,
      code,
      name,
      title: name,
      description: str(payload.description),
      status: "draft",
      ownerId: user.id,
      visibility: "private",
      language: str(payload.language) ?? "en",
      category: str(payload.category),
      difficulty: str(payload.difficulty),
      defaultPoints: num(payload.default_points) ?? 10,
      defaultNegativePoints: num(payload.default_negative_points) ?? -2,
      speedBonusEnabled: Boolean(payload.speed_bonus_enabled),
    });

    let position = 0;
    for (const q of rawQuestions) {
      const text = typeof q.text === "string" ? q.text.trim() : "";
      if (!text) continue;
      position += 1;

      let type = typeof q.type === "string" && q.type ? q.type : "mcq";
      if (!ALLOWED_TYPES.has(type)) type = "mcq";

      const durationSeconds = Math.min(Math.max(num(q.duration_seconds) ?? 15, 1), 600);
      const correctAnswerText = str(q.correct_answer_text);

      const qid = newId();
      await tx.insert(questions).values({
        id: qid,
        competitionId: newQuizId,
        position,
        text,
        type,
        durationSeconds,
        points: num(q.points),
        negativePoints: num(q.negative_points),
        explanation: str(q.explanation),
        correctAnswerText,
        surahNumber: num(q.surah_number),
        ayahNumber: num(q.ayah_number),
        pageNumber: num(q.page_number),
        juzNumber: num(q.juz_number),
        hizbNumber: num(q.hizb_number),
      });

      const rawChoices = Array.isArray(q.choices) ? (q.choices as RawChoice[]) : [];
      let cpos = 0;
      for (const c of rawChoices) {
        const cText = typeof c.text === "string" ? c.text.trim() : "";
        if (!cText) continue;
        cpos += 1;
        if (cpos > 10) break;
        await tx.insert(choices).values({
          id: newId(),
          questionId: qid,
          text: cText,
          position: cpos,
          isCorrect: Boolean(c.is_correct),
        });
      }

      if (type === "true_false" && cpos === 0) {
        const answer = (correctAnswerText ?? "").toLowerCase();
        await tx.insert(choices).values([
          { id: newId(), questionId: qid, text: "True", position: 1, isCorrect: answer === "true" },
          { id: newId(), questionId: qid, text: "False", position: 2, isCorrect: answer === "false" },
        ]);
      }
    }
  });

  return NextResponse.json({ id: newQuizId });
}
