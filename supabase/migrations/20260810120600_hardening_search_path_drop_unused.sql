-- 20260810120600_hardening_search_path_drop_unused.sql
-- Phase 4 · Hardening pass (advisors):
--   * set_updated_at: pin search_path (mutable-path WARN resolved)
--   * drop unused can_read_competition helper (SECURITY DEFINER surface kept
--     to the six intentional public RPCs: join/submit/reveal/leaderboard/identity)

alter function public.set_updated_at() set search_path = public;

drop function if exists public.can_read_competition(uuid);