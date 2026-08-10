-- 20260810120100_competitions_extensions.sql
-- Phase 4 · Supabase foundations #2: quiz-library/live-game fields + ownership.
-- NOTE: existing dev rows keep owner_id NULL (fixtures); they stay readable.

alter table public.competitions
  add column if not exists owner_id uuid references public.profiles (id) on delete set null,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  add column if not exists cover_url text,
  add column if not exists language text not null default 'en'
    check (language in ('en', 'ar', 'fr')),
  add column if not exists category text,
  add column if not exists difficulty text
    check (difficulty in ('easy', 'medium', 'hard')),
  add column if not exists archived_at timestamptz;

create index if not exists competitions_owner_id_idx
  on public.competitions (owner_id)
  where owner_id is not null;

create trigger competitions_set_updated_at
  before update on public.competitions
  for each row execute function public.set_updated_at();