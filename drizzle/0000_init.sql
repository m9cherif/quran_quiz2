CREATE TABLE `admin_keys` (
	`id` char(36) NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`label` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `admin_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `answers` (
	`id` char(36) NOT NULL,
	`competition_id` char(36) NOT NULL,
	`question_id` char(36) NOT NULL,
	`participant_id` char(36) NOT NULL,
	`choice_id` char(36),
	`answer_text` text,
	`submitted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`response_time_ms` int NOT NULL DEFAULT 0,
	`is_correct` boolean NOT NULL,
	`points` double NOT NULL DEFAULT 0,
	`bonus_points` double NOT NULL DEFAULT 0,
	CONSTRAINT `answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `answers_one_per_question_uidx` UNIQUE(`participant_id`,`question_id`)
);
--> statement-breakpoint
CREATE TABLE `choices` (
	`id` char(36) NOT NULL,
	`question_id` char(36) NOT NULL,
	`text` text NOT NULL,
	`position` int NOT NULL,
	`is_correct` boolean NOT NULL DEFAULT false,
	CONSTRAINT `choices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_members` (
	`class_id` char(36) NOT NULL,
	`profile_id` char(36) NOT NULL,
	`joined_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `class_members_class_id_profile_id_pk` PRIMARY KEY(`class_id`,`profile_id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` char(36) NOT NULL,
	`owner_id` char(36) NOT NULL,
	`name` varchar(60) NOT NULL,
	`description` varchar(300),
	`code` varchar(16) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`archived_at` datetime(3),
	CONSTRAINT `classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `classes_code_uidx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` char(36) NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`instructions` text,
	`minutes_per_question` int NOT NULL DEFAULT 1,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`scheduled_at` datetime(3),
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`paused_seconds` double NOT NULL DEFAULT 0,
	`default_points` int NOT NULL DEFAULT 10,
	`default_negative_points` int NOT NULL DEFAULT -2,
	`speed_bonus_enabled` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`owner_id` char(36),
	`visibility` varchar(16) NOT NULL DEFAULT 'public',
	`cover_url` text,
	`language` varchar(8) NOT NULL DEFAULT 'en',
	`category` text,
	`difficulty` varchar(16),
	`archived_at` datetime(3),
	`class_id` char(36),
	`calls_enabled` boolean NOT NULL DEFAULT false,
	`join_locked` boolean NOT NULL DEFAULT false,
	`allow_late_join` boolean NOT NULL DEFAULT false,
	`class_can_join` boolean NOT NULL DEFAULT true,
	CONSTRAINT `competitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `competitions_code_uidx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `email_verifications` (
	`email` varchar(255) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`salt` varchar(32) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `email_verifications_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` char(36) NOT NULL,
	`competition_id` char(36) NOT NULL,
	`display_name` varchar(50) NOT NULL,
	`first_name` text,
	`last_name` text,
	`participant_code` varchar(36) NOT NULL,
	`access_token` varchar(36) NOT NULL,
	`connected` boolean NOT NULL DEFAULT false,
	`joined_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_seen_at` datetime(3),
	`status` varchar(16) NOT NULL DEFAULT 'joined',
	`profile_id` char(36),
	`team` text,
	`bonus_award` double NOT NULL DEFAULT 0,
	`avatar` text,
	CONSTRAINT `participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_participants_per_competition_display_name` UNIQUE(`competition_id`,`display_name`)
);
--> statement-breakpoint
CREATE TABLE `phone_verifications` (
	`phone` varchar(32) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`salt` varchar(32) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `phone_verifications_phone` PRIMARY KEY(`phone`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` char(36) NOT NULL,
	`competition_id` char(36) NOT NULL,
	`position` int NOT NULL,
	`text` text NOT NULL,
	`type` varchar(16) NOT NULL DEFAULT 'mcq',
	`duration_seconds` int NOT NULL DEFAULT 15,
	`points` int,
	`negative_points` int,
	`explanation` text,
	`correct_answer_text` text,
	`audio_url` text,
	`started_at` datetime(3),
	`ends_at` datetime(3),
	`surah_number` int,
	`ayah_number` int,
	`page_number` int,
	`juz_number` int,
	`hizb_number` int,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`word_locations` json NOT NULL DEFAULT ('[]'),
	`hint` text,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `series_answers` (
	`attempt_id` char(36) NOT NULL,
	`exercise_id` varchar(100) NOT NULL,
	`answer` json,
	`is_correct` boolean NOT NULL DEFAULT false,
	`points` double NOT NULL DEFAULT 0,
	`answered_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `series_answers_attempt_id_exercise_id_pk` PRIMARY KEY(`attempt_id`,`exercise_id`)
);
--> statement-breakpoint
CREATE TABLE `series_attempts` (
	`id` char(36) NOT NULL,
	`series_id` varchar(100) NOT NULL,
	`profile_id` char(36) NOT NULL,
	`started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	`score` double NOT NULL DEFAULT 0,
	`max_score` double NOT NULL DEFAULT 0,
	`answered` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`exercise_num` int,
	`page` int,
	`ecrire_mot` boolean NOT NULL DEFAULT false,
	`errors` int NOT NULL DEFAULT 0,
	`seconds` int NOT NULL DEFAULT 0,
	CONSTRAINT `series_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(255),
	`phone` varchar(32),
	`name` varchar(50) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'student',
	`avatar_url` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uidx` UNIQUE(`email`),
	CONSTRAINT `users_phone_uidx` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE INDEX `answers_competition_id_idx` ON `answers` (`competition_id`);--> statement-breakpoint
CREATE INDEX `answers_question_id_idx` ON `answers` (`question_id`);--> statement-breakpoint
CREATE INDEX `answers_participant_id_idx` ON `answers` (`participant_id`);--> statement-breakpoint
CREATE INDEX `answers_choice_id_idx` ON `answers` (`choice_id`);--> statement-breakpoint
CREATE INDEX `choices_question_id_idx` ON `choices` (`question_id`);--> statement-breakpoint
CREATE INDEX `class_members_profile_id_idx` ON `class_members` (`profile_id`);--> statement-breakpoint
CREATE INDEX `classes_owner_id_idx` ON `classes` (`owner_id`);--> statement-breakpoint
CREATE INDEX `competitions_owner_id_idx` ON `competitions` (`owner_id`);--> statement-breakpoint
CREATE INDEX `competitions_class_id_idx` ON `competitions` (`class_id`);--> statement-breakpoint
CREATE INDEX `participants_competition_id_idx` ON `participants` (`competition_id`);--> statement-breakpoint
CREATE INDEX `participants_access_token_idx` ON `participants` (`access_token`);--> statement-breakpoint
CREATE INDEX `participants_profile_id_idx` ON `participants` (`profile_id`);--> statement-breakpoint
CREATE INDEX `questions_competition_id_idx` ON `questions` (`competition_id`);--> statement-breakpoint
CREATE INDEX `series_attempts_profile_series_idx` ON `series_attempts` (`profile_id`,`series_id`);--> statement-breakpoint
CREATE INDEX `series_attempts_series_id_idx` ON `series_attempts` (`series_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);