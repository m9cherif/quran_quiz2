import type { competitions, questions } from "@/lib/db/schema";

type CompetitionRow = typeof competitions.$inferSelect;
type QuestionRow = typeof questions.$inferSelect;

/** UTC DATETIME -> ISO string, the shape every consumer already expects. */
function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/** competitions row (camelCase, Drizzle) -> Competition (snake_case, old REST/RPC shape). */
export function toCompetitionJson(row: CompetitionRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    minutes_per_question: row.minutesPerQuestion,
    status: row.status,
    scheduled_at: iso(row.scheduledAt),
    started_at: iso(row.startedAt),
    finished_at: iso(row.finishedAt),
    paused_seconds: row.pausedSeconds,
    default_points: row.defaultPoints,
    default_negative_points: row.defaultNegativePoints,
    speed_bonus_enabled: row.speedBonusEnabled,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
    owner_id: row.ownerId,
    visibility: row.visibility,
    cover_url: row.coverUrl,
    language: row.language,
    category: row.category,
    difficulty: row.difficulty,
    archived_at: iso(row.archivedAt),
    class_id: row.classId,
    calls_enabled: row.callsEnabled,
    join_locked: row.joinLocked,
    allow_late_join: row.allowLateJoin,
    class_can_join: row.classCanJoin,
  };
}

/** competitions row + counts -> list_my_quizzes / list_my_live_games row shape. */
export function toQuizSummaryJson(
  row: CompetitionRow,
  counts: { questionCount: number; participantCount: number }
) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    cover_url: row.coverUrl,
    language: row.language,
    category: row.category,
    difficulty: row.difficulty,
    default_points: row.defaultPoints,
    default_negative_points: row.defaultNegativePoints,
    speed_bonus_enabled: row.speedBonusEnabled,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
    question_count: counts.questionCount,
    participant_count: counts.participantCount,
  };
}

/** questions row -> QuestionListItem (listQuizQuestions' safe/summary columns). */
export function toQuestionListItemJson(row: QuestionRow) {
  return {
    id: row.id,
    competition_id: row.competitionId,
    position: row.position,
    text: row.text,
    type: row.type,
    duration_seconds: row.durationSeconds,
    points: row.points,
    negative_points: row.negativePoints,
    surah_number: row.surahNumber,
    ayah_number: row.ayahNumber,
    page_number: row.pageNumber,
    juz_number: row.juzNumber,
    hizb_number: row.hizbNumber,
  };
}

/** questions row + choices -> get_question_full / get_quiz_questions_full row shape. */
export function toQuestionFullJson(
  row: QuestionRow,
  choices: Array<{ id: string; text: string; position: number; isCorrect: boolean }>
) {
  return {
    id: row.id,
    competition_id: row.competitionId,
    position: row.position,
    text: row.text,
    type: row.type,
    duration_seconds: row.durationSeconds,
    points: row.points,
    negative_points: row.negativePoints,
    explanation: row.explanation,
    correct_answer_text: row.correctAnswerText,
    started_at: iso(row.startedAt),
    surah_number: row.surahNumber,
    ayah_number: row.ayahNumber,
    page_number: row.pageNumber,
    juz_number: row.juzNumber,
    hizb_number: row.hizbNumber,
    word_locations: row.wordLocations,
    audio_url: row.audioUrl,
    hint: row.hint,
    choices: choices.map((c) => ({
      id: c.id,
      text: c.text,
      position: c.position,
      is_correct: c.isCorrect,
    })),
  };
}
