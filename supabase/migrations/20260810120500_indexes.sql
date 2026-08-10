-- 20260810120500_indexes.sql
-- Phase 4 · Supabase foundations #6: query indexes (fixtures preserved).

create index if not exists answers_competition_id_idx on public.answers (competition_id);
create index if not exists answers_question_id_idx on public.answers (question_id);
create index if not exists answers_participant_id_idx on public.answers (participant_id);
create index if not exists questions_competition_position_idx on public.questions (competition_id, position);
create index if not exists participants_competition_id_idx on public.participants (competition_id);
create index if not exists participants_code_idx on public.participants (participant_code);
create index if not exists choices_question_id_idx on public.choices (question_id);
create index if not exists competitions_status_idx on public.competitions (status);