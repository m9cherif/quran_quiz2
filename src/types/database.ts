/**
 * Supabase database model — mirrors the audited `public` schema
 * (competitions, participants, questions, choices, answers, admin_keys).
 * Keep in sync with the versioned migrations under supabase/migrations/.
 */

export type CompetitionStatus =
  | "draft"
  | "scheduled"
  | "waiting"
  | "running"
  | "paused"
  | "finished"
  | "cancelled";

export type QuestionType = "mcq" | "true_false" | "text" | "number" | "audio";

/** Live-game lifecycle phases shown to the client. */
export type GamePhase =
  | "lobby"
  | "question"
  | "reveal"
  | "leaderboard"
  | "finished"
  | "aborted";

export type CompetitionVisibility = "public" | "unlisted" | "private";
export type CompetitionLanguage = "en" | "ar" | "fr";
export type CompetitionDifficulty = "easy" | "medium" | "hard";

export interface Competition {
  id: string;
  code: string;
  name: string;
  title: string;
  description: string | null;
  instructions: string | null;
  minutes_per_question: number;
  status: CompetitionStatus;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  paused_seconds: number;
  default_points: number;
  default_negative_points: number;
  speed_bonus_enabled: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  visibility: CompetitionVisibility;
  cover_url: string | null;
  language: CompetitionLanguage;
  category: string | null;
  difficulty: CompetitionDifficulty | null;
  archived_at: string | null;
  class_id: string | null;
}

/** Row shape returned by the `list_my_quizzes` RPC (owner quiz library). */
export interface QuizSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: CompetitionStatus;
  visibility: CompetitionVisibility;
  cover_url: string | null;
  language: CompetitionLanguage;
  category: string | null;
  difficulty: CompetitionDifficulty | null;
  default_points: number;
  default_negative_points: number;
  speed_bonus_enabled: boolean;
  created_at: string;
  updated_at: string;
  question_count: number;
  participant_count: number;
}

/** Full question row (incl. hidden columns) as returned by `get_question_full`. */
export interface QuizQuestionFull {
  id: string;
  competition_id: string;
  position: number;
  text: string;
  type: QuestionType;
  duration_seconds: number;
  points: number | null;
  negative_points: number | null;
  explanation: string | null;
  correct_answer_text: string | null;
  surah_number: number | null;
  ayah_number: number | null;
  page_number: number | null;
  juz_number: number | null;
  hizb_number: number | null;
  choices: Array<{
    id: string;
    text: string;
    position: number;
    is_correct: boolean;
  }>;
}

/** Editor-side question draft (id present once persisted). */
export interface QuizQuestionDraft {
  id?: string | null;
  position: number;
  text: string;
  type: QuestionType;
  duration_seconds: number;
  points: number | null;
  negative_points: number | null;
  explanation: string | null;
  correct_answer_text: string | null;
  surah_number: number | null;
  ayah_number: number | null;
  page_number: number | null;
  juz_number: number | null;
  hizb_number: number | null;
  choices: Array<{
    id?: string | null;
    text: string;
    position: number;
    is_correct: boolean;
  }>;
}

export interface Question {
  id: string;
  competition_id: string;
  position: number;
  text: string;
  type: QuestionType;
  duration_seconds: number;
  points: number | null;
  negative_points: number | null;
  explanation: string | null;
  correct_answer_text: string | null;
  audio_url: string | null;
  started_at: string | null;
  ends_at: string | null;
  /** Quran reference fields — nullable; content is user/admin-provided. */
  surah_number: number | null;
  ayah_number: number | null;
  page_number: number | null;
  juz_number: number | null;
  hizb_number: number | null;
  created_at: string;
}

export interface Choice {
  id: string;
  question_id: string;
  text: string;
  position: number;
  is_correct: boolean;
}

export interface Participant {
  id: string;
  competition_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  participant_code: string;
  access_token: string;
  connected: boolean;
  joined_at: string;
  last_seen_at: string | null;
  status: string;
}

export interface Answer {
  id: string;
  competition_id: string;
  question_id: string;
  participant_id: string;
  choice_id: string | null;
  answer_text: string | null;
  submitted_at: string;
  response_time_ms: number;
  /** Written server-side only (RLS). Clients must never set these. */
  is_correct: boolean;
  points: number;
  bonus_points: number;
}

export interface AdminKey {
  id: string;
  key_hash: string;
  label: string | null;
  created_at: string;
}

/** Future: profiles for authenticated hosts/students (migration planned). */
export type ProfileRole = "host" | "student";

export interface Profile {
  id: string;
  name: string;
  role: ProfileRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}