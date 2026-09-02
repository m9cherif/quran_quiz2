-- A session, as the desktop tool records one: which exercise of which series,
-- on which page, which way round, how long it took and how many were wrong.
-- The mark stays the proportion right out of 100; time and mistakes are kept
-- because the report shows them, not because they change the mark.
alter table public.series_attempts
  add column if not exists exercise_num integer,
  add column if not exists page integer,
  add column if not exists ecrire_mot boolean not null default false,
  add column if not exists errors integer not null default 0,
  add column if not exists seconds integer not null default 0;

create index if not exists series_attempts_series_num_idx
  on public.series_attempts (series_id, exercise_num, profile_id);
