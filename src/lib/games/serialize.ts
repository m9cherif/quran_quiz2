import type { answers, choices, competitions, participants, questions } from "@/lib/db/schema";

/**
 * These mirror the exact snake_case JSON shape supabase-js used to hand back
 * from `.select("*")` / RPC calls (see src/types/database.ts) — every
 * consuming component (LiveGameControl.jsx, GameQuestion.jsx, GameLobby.jsx,
 * GameResult.jsx) reads these field names directly, so the shape has to stay
 * byte-for-byte the same even though the DB driver now hands us camelCase.
 */

function toIso(d: Date | null | undefined): string | null {
  return d instanceof Date ? d.toISOString() : (d ?? null);
}

export function serializeCompetition(c: typeof competitions.$inferSelect) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    title: c.title,
    description: c.description,
    instructions: c.instructions,
    minutes_per_question: c.minutesPerQuestion,
    status: c.status,
    scheduled_at: toIso(c.scheduledAt),
    started_at: toIso(c.startedAt),
    finished_at: toIso(c.finishedAt),
    paused_seconds: c.pausedSeconds,
    default_points: c.defaultPoints,
    default_negative_points: c.defaultNegativePoints,
    speed_bonus_enabled: c.speedBonusEnabled,
    created_at: toIso(c.createdAt),
    updated_at: toIso(c.updatedAt),
    owner_id: c.ownerId,
    visibility: c.visibility,
    cover_url: c.coverUrl,
    language: c.language,
    category: c.category,
    difficulty: c.difficulty,
    archived_at: toIso(c.archivedAt),
    class_id: c.classId,
    calls_enabled: c.callsEnabled,
    join_locked: c.joinLocked,
    allow_late_join: c.allowLateJoin,
    class_can_join: c.classCanJoin,
  };
}

/** Safe question columns only — never correct_answer_text/explanation (see games.ts's old comment). */
export function serializeQuestionSafe(q: typeof questions.$inferSelect) {
  return {
    id: q.id,
    competition_id: q.competitionId,
    position: q.position,
    text: q.text,
    type: q.type,
    duration_seconds: q.durationSeconds,
    points: q.points,
    negative_points: q.negativePoints,
    started_at: toIso(q.startedAt),
    ends_at: toIso(q.endsAt),
    page_number: q.pageNumber,
    word_locations: q.wordLocations,
    audio_url: q.audioUrl,
    hint: q.hint,
  };
}

export function serializeParticipant(p: typeof participants.$inferSelect) {
  return {
    id: p.id,
    competition_id: p.competitionId,
    display_name: p.displayName,
    first_name: p.firstName,
    last_name: p.lastName,
    participant_code: p.participantCode,
    access_token: p.accessToken,
    connected: p.connected,
    joined_at: toIso(p.joinedAt),
    last_seen_at: toIso(p.lastSeenAt),
    status: p.status,
    profile_id: p.profileId,
    team: p.team,
    bonus_award: p.bonusAward,
    avatar: p.avatar,
  };
}

export function serializeAnswer(a: typeof answers.$inferSelect) {
  return {
    id: a.id,
    competition_id: a.competitionId,
    question_id: a.questionId,
    participant_id: a.participantId,
    choice_id: a.choiceId,
    answer_text: a.answerText,
    submitted_at: toIso(a.submittedAt),
    response_time_ms: a.responseTimeMs,
    is_correct: Boolean(a.isCorrect),
    points: Number(a.points),
    bonus_points: Number(a.bonusPoints),
  };
}

/** Participant-visible choice — is_correct is never sent to a token-authenticated caller. */
export function serializeChoicePublic(c: typeof choices.$inferSelect) {
  return {
    id: c.id,
    question_id: c.questionId,
    text: c.text,
    position: c.position,
  };
}
