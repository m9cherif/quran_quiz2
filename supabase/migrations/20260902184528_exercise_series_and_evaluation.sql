-- Exercise series: prepared in the data repo, worked through by a student on
-- their own. What lives here is only what the repo cannot hold — who did what,
-- when, and how it was graded.
create table public.series_attempts (
  id uuid primary key default gen_random_uuid(),
  series_id text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score double precision not null default 0,
  max_score double precision not null default 0,
  answered integer not null default 0,
  total integer not null default 0
);

create index series_attempts_profile_series_idx
  on public.series_attempts (profile_id, series_id, started_at desc);
create index series_attempts_series_idx on public.series_attempts (series_id);

create table public.series_answers (
  attempt_id uuid not null references public.series_attempts(id) on delete cascade,
  exercise_id text not null,
  answer jsonb,
  is_correct boolean not null default false,
  points double precision not null default 0,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, exercise_id)
);

alter table public.series_attempts enable row level security;
alter table public.series_answers enable row level security;

-- Reading: a student sees their own work.
create policy series_attempts_own on public.series_attempts
  for select using (profile_id = auth.uid());

-- And a teacher sees the work of students in the classes they own — that is
-- the whole point of the evaluation side.
create policy series_attempts_teacher on public.series_attempts
  for select using (exists (
    select 1 from public.class_members m
    join public.classes c on c.id = m.class_id
    where m.profile_id = series_attempts.profile_id and c.owner_id = auth.uid()
  ));

create policy series_answers_own on public.series_answers
  for select using (exists (
    select 1 from public.series_attempts a
    where a.id = series_answers.attempt_id and a.profile_id = auth.uid()
  ));

create policy series_answers_teacher on public.series_answers
  for select using (exists (
    select 1 from public.series_attempts a
    join public.class_members m on m.profile_id = a.profile_id
    join public.classes c on c.id = m.class_id
    where a.id = series_answers.attempt_id and c.owner_id = auth.uid()
  ));

-- No insert or update policy on purpose. Grading happens on the server with
-- the service role, because the answer key must never be something the browser
-- holds — a client that could write is_correct could award itself the marks.
