-- 20260810120300_realtime_publications.sql
-- Phase 4 · Supabase foundations #4: realtime publications.
--
-- Published tables: competitions (status/state machine), questions
-- (started_at/ends_at), participants (presence/connected), answers (host
-- live view). `choices` is intentionally NOT published: it carries is_correct,
-- and realtime does not enforce column-level privileges.

alter publication supabase_realtime
  add table public.competitions,
            public.questions,
            public.participants,
            public.answers;