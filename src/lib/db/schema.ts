import {
  mysqlTable,
  varchar,
  char,
  text,
  int,
  double,
  boolean,
  datetime,
  json,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Schema for the post-Supabase backend. One simplification from the Postgres
 * shape: auth.users + public.profiles (split only because Supabase Auth
 * forced it) are merged into a single `users` table — nothing else needed
 * that split.
 *
 * uuid primary keys become CHAR(36), generated app-side via
 * crypto.randomUUID() (see src/lib/db/id.ts) rather than in SQL — MySQL has
 * no portable equivalent of gen_random_uuid() across Hostinger's versions.
 * timestamptz columns become DATETIME(3) and are always stored/read as UTC
 * (see src/lib/db/client.ts's connection timezone setting).
 */

const id = () => char("id", { length: 36 }).primaryKey();
const now = () => sql`CURRENT_TIMESTAMP(3)`;

export const users = mysqlTable("users", {
  id: id(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  name: varchar("name", { length: 50 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("student"), // host | student | admin
  avatarUrl: text("avatar_url"),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
  updatedAt: datetime("updated_at", { fsp: 3 }).notNull().default(now()),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_uidx").on(t.email),
  phoneIdx: uniqueIndex("users_phone_uidx").on(t.phone),
}));

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // opaque random token, not a uuid
  userId: char("user_id", { length: 36 }).notNull(),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
  expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
}, (t) => ({
  userIdx: index("sessions_user_id_idx").on(t.userId),
}));

/** Mirrors phone_verifications' hashing shape (src/lib/auth/smsGateway.ts) for email OTP. */
export const emailVerifications = mysqlTable("email_verifications", {
  email: varchar("email", { length: 255 }).primaryKey(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  salt: varchar("salt", { length: 32 }).notNull(),
  attempts: int("attempts").notNull().default(0),
  expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
});

export const phoneVerifications = mysqlTable("phone_verifications", {
  phone: varchar("phone", { length: 32 }).primaryKey(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  salt: varchar("salt", { length: 32 }).notNull(),
  attempts: int("attempts").notNull().default(0),
  expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
});

export const adminKeys = mysqlTable("admin_keys", {
  id: id(),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
});

export const classes = mysqlTable("classes", {
  id: id(),
  ownerId: char("owner_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  description: varchar("description", { length: 300 }),
  code: varchar("code", { length: 16 }).notNull(),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
  archivedAt: datetime("archived_at", { fsp: 3 }),
}, (t) => ({
  codeIdx: uniqueIndex("classes_code_uidx").on(t.code),
  ownerIdx: index("classes_owner_id_idx").on(t.ownerId),
}));

export const classMembers = mysqlTable("class_members", {
  classId: char("class_id", { length: 36 }).notNull(),
  profileId: char("profile_id", { length: 36 }).notNull(),
  joinedAt: datetime("joined_at", { fsp: 3 }).notNull().default(now()),
}, (t) => ({
  pk: primaryKey({ columns: [t.classId, t.profileId] }),
  profileIdx: index("class_members_profile_id_idx").on(t.profileId),
}));

export const competitions = mysqlTable("competitions", {
  id: id(),
  code: varchar("code", { length: 16 }).notNull(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  minutesPerQuestion: int("minutes_per_question").notNull().default(1),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  scheduledAt: datetime("scheduled_at", { fsp: 3 }),
  startedAt: datetime("started_at", { fsp: 3 }),
  finishedAt: datetime("finished_at", { fsp: 3 }),
  pausedSeconds: double("paused_seconds").notNull().default(0),
  defaultPoints: int("default_points").notNull().default(10),
  defaultNegativePoints: int("default_negative_points").notNull().default(-2),
  speedBonusEnabled: boolean("speed_bonus_enabled").notNull().default(false),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
  updatedAt: datetime("updated_at", { fsp: 3 }).notNull().default(now()),
  ownerId: char("owner_id", { length: 36 }),
  visibility: varchar("visibility", { length: 16 }).notNull().default("public"),
  coverUrl: text("cover_url"),
  language: varchar("language", { length: 8 }).notNull().default("en"),
  category: text("category"),
  difficulty: varchar("difficulty", { length: 16 }),
  archivedAt: datetime("archived_at", { fsp: 3 }),
  classId: char("class_id", { length: 36 }),
  callsEnabled: boolean("calls_enabled").notNull().default(false),
  joinLocked: boolean("join_locked").notNull().default(false),
  allowLateJoin: boolean("allow_late_join").notNull().default(false),
  classCanJoin: boolean("class_can_join").notNull().default(true),
}, (t) => ({
  codeIdx: uniqueIndex("competitions_code_uidx").on(t.code),
  ownerIdx: index("competitions_owner_id_idx").on(t.ownerId),
  classIdx: index("competitions_class_id_idx").on(t.classId),
}));

export const questions = mysqlTable("questions", {
  id: id(),
  competitionId: char("competition_id", { length: 36 }).notNull(),
  position: int("position").notNull(),
  text: text("text").notNull(),
  type: varchar("type", { length: 16 }).notNull().default("mcq"),
  durationSeconds: int("duration_seconds").notNull().default(15),
  points: int("points"),
  negativePoints: int("negative_points"),
  explanation: text("explanation"),
  correctAnswerText: text("correct_answer_text"),
  audioUrl: text("audio_url"),
  startedAt: datetime("started_at", { fsp: 3 }),
  endsAt: datetime("ends_at", { fsp: 3 }),
  surahNumber: int("surah_number"),
  ayahNumber: int("ayah_number"),
  pageNumber: int("page_number"),
  juzNumber: int("juz_number"),
  hizbNumber: int("hizb_number"),
  createdAt: datetime("created_at", { fsp: 3 }).notNull().default(now()),
  wordLocations: json("word_locations").notNull().default(sql`('[]')`),
  hint: text("hint"),
}, (t) => ({
  competitionIdx: index("questions_competition_id_idx").on(t.competitionId),
}));

export const choices = mysqlTable("choices", {
  id: id(),
  questionId: char("question_id", { length: 36 }).notNull(),
  text: text("text").notNull(),
  position: int("position").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
}, (t) => ({
  questionIdx: index("choices_question_id_idx").on(t.questionId),
}));

export const participants = mysqlTable("participants", {
  id: id(),
  competitionId: char("competition_id", { length: 36 }).notNull(),
  displayName: varchar("display_name", { length: 50 }).notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  participantCode: varchar("participant_code", { length: 36 }).notNull(),
  accessToken: varchar("access_token", { length: 36 }).notNull(),
  connected: boolean("connected").notNull().default(false),
  joinedAt: datetime("joined_at", { fsp: 3 }).notNull().default(now()),
  lastSeenAt: datetime("last_seen_at", { fsp: 3 }),
  status: varchar("status", { length: 16 }).notNull().default("joined"),
  profileId: char("profile_id", { length: 36 }),
  team: text("team"),
  bonusAward: double("bonus_award").notNull().default(0),
  avatar: text("avatar"),
}, (t) => ({
  competitionIdx: index("participants_competition_id_idx").on(t.competitionId),
  displayNameUidx: uniqueIndex("uq_participants_per_competition_display_name").on(
    t.competitionId,
    t.displayName
  ),
  tokenIdx: index("participants_access_token_idx").on(t.accessToken),
  profileIdx: index("participants_profile_id_idx").on(t.profileId),
}));

export const answers = mysqlTable("answers", {
  id: id(),
  competitionId: char("competition_id", { length: 36 }).notNull(),
  questionId: char("question_id", { length: 36 }).notNull(),
  participantId: char("participant_id", { length: 36 }).notNull(),
  choiceId: char("choice_id", { length: 36 }),
  answerText: text("answer_text"),
  submittedAt: datetime("submitted_at", { fsp: 3 }).notNull().default(now()),
  responseTimeMs: int("response_time_ms").notNull().default(0),
  isCorrect: boolean("is_correct").notNull(),
  points: double("points").notNull().default(0),
  bonusPoints: double("bonus_points").notNull().default(0),
}, (t) => ({
  competitionIdx: index("answers_competition_id_idx").on(t.competitionId),
  questionIdx: index("answers_question_id_idx").on(t.questionId),
  participantIdx: index("answers_participant_id_idx").on(t.participantId),
  choiceIdx: index("answers_choice_id_idx").on(t.choiceId),
  onePerQuestionUidx: uniqueIndex("answers_one_per_question_uidx").on(
    t.participantId,
    t.questionId
  ),
}));

export const seriesAttempts = mysqlTable("series_attempts", {
  id: id(),
  seriesId: varchar("series_id", { length: 100 }).notNull(),
  profileId: char("profile_id", { length: 36 }).notNull(),
  startedAt: datetime("started_at", { fsp: 3 }).notNull().default(now()),
  finishedAt: datetime("finished_at", { fsp: 3 }),
  score: double("score").notNull().default(0),
  maxScore: double("max_score").notNull().default(0),
  answered: int("answered").notNull().default(0),
  total: int("total").notNull().default(0),
  exerciseNum: int("exercise_num"),
  page: int("page"),
  ecrireMot: boolean("ecrire_mot").notNull().default(false),
  errors: int("errors").notNull().default(0),
  seconds: int("seconds").notNull().default(0),
}, (t) => ({
  profileSeriesIdx: index("series_attempts_profile_series_idx").on(
    t.profileId,
    t.seriesId
  ),
  seriesIdx: index("series_attempts_series_id_idx").on(t.seriesId),
}));

export const seriesAnswers = mysqlTable("series_answers", {
  attemptId: char("attempt_id", { length: 36 }).notNull(),
  exerciseId: varchar("exercise_id", { length: 100 }).notNull(),
  answer: json("answer"),
  isCorrect: boolean("is_correct").notNull().default(false),
  points: double("points").notNull().default(0),
  answeredAt: datetime("answered_at", { fsp: 3 }).notNull().default(now()),
}, (t) => ({
  pk: primaryKey({ columns: [t.attemptId, t.exerciseId] }),
}));
