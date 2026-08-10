-- 20260810120200_rls_security.sql
-- Phase 4 · Supabase foundations #3: RLS policies, server-side scoring,
-- join/submit/reveal/leaderboard RPCs, and hardened column grants.
--
-- Access model:
--   * Competitions (quizzes + live games): owner CRUD; visible widely when
--     status is waiting/running/paused/finished (game join is gated by code).
--   * Anonymous players: identity = participants.access_token sent in the
--     `X-Participant-Token` request header (uuid, unguessable, server-issued).
--   * Answers: INSERT/UPDATE are revoke-only; clients submit through the
--     submit_answer RPC. is_correct/points/bonus_points are computed by a
--     trigger and can never be written by a client.
--   * Questions/choices: correct answers are never selectable via REST
--     (column grants); reveal goes through get_question_reveal (participant
--     or owner only).

-- ---------------------------------------------------------------------------
-- Identity + visibility helpers (SECURITY DEFINER, fixed search_path).
-- These only answer booleans/own-id questions and read rows already visible
-- through the policies they serve; no sensitive data crosses the boundary.
-- ---------------------------------------------------------------------------

create or replace function public.participant_from_header(p_competition_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.participants p
  where p.competition_id = p_competition_id
    and p.access_token = coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-participant-token',
      ''
    )
  limit 1;
$$;

create or replace function public.can_read_competition(p_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.competitions c
    where c.id = p_competition_id
      and (
        (c.owner_id is not null and c.owner_id = auth.uid())
        or c.owner_id is null
        or c.status in ('waiting', 'running', 'paused', 'finished')
      )
  );
$$;

revoke execute on function public.participant_from_header(uuid) from public;
revoke execute on function public.can_read_competition(uuid) from public;
grant execute on function public.participant_from_header(uuid) to anon, authenticated;
grant execute on function public.can_read_competition(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Competitions
-- ---------------------------------------------------------------------------

create policy "competitions_select_visible" on public.competitions
  for select to anon, authenticated
  using (
    owner_id is null
    or owner_id = auth.uid()
    or status in ('waiting', 'running', 'paused', 'finished')
  );

create policy "competitions_insert_owner" on public.competitions
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "competitions_update_owner" on public.competitions
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "competitions_delete_owner" on public.competitions
  for delete to authenticated
  using (owner_id = auth.uid());

-- anon must never write or truncate competitions
revoke insert, update, delete, truncate on public.competitions from anon;
revoke truncate on public.competitions from authenticated;

-- ---------------------------------------------------------------------------
-- Questions / Choices
-- ---------------------------------------------------------------------------

-- SELECT: owner sees everything; participants may read live/finished games.
-- correct_answer_text / is_correct are NOT granted below (reveal RPC only).
create policy "questions_select_owner" on public.questions
  for select to authenticated
  using (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = auth.uid()
  ));

create policy "questions_select_participant" on public.questions
  for select to anon, authenticated
  using (
    public.participant_from_header(competition_id) is not null
    and exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.status in ('running', 'paused', 'finished')
    )
  );

create policy "questions_insert_owner" on public.questions
  for insert to authenticated
  with check (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = auth.uid()
  ));

create policy "questions_update_owner" on public.questions
  for update to authenticated
  using (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = auth.uid()
  ));

create policy "questions_delete_owner" on public.questions
  for delete to authenticated
  using (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = auth.uid()
  ));

create policy "choices_select_owner" on public.choices
  for select to authenticated
  using (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = auth.uid()
  ));

create policy "choices_select_participant" on public.choices
  for select to anon, authenticated
  using (exists (
    select 1 from public.questions q
    where q.id = question_id
      and public.participant_from_header(q.competition_id) is not null
      and exists (
        select 1 from public.competitions c
        where c.id = q.competition_id and c.status in ('running', 'paused', 'finished')
      )
  ));

create policy "choices_insert_owner" on public.choices
  for insert to authenticated
  with check (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = auth.uid()
  ));

create policy "choices_update_owner" on public.choices
  for update to authenticated
  using (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = auth.uid()
  ));

create policy "choices_delete_owner" on public.choices
  for delete to authenticated
  using (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = auth.uid()
  ));

revoke insert, update, delete, truncate on public.questions from anon;
revoke insert, update, delete, truncate on public.choices from anon;
revoke truncate on public.questions from authenticated;
revoke truncate on public.choices from authenticated;

-- Column-level SELECT: correct answers are never exposed via REST.
revoke select on public.questions from anon, authenticated;
grant select (
  id, competition_id, position, text, type, duration_seconds, points,
  negative_points, audio_url, started_at, ends_at,
  surah_number, ayah_number, page_number, juz_number, hizb_number, created_at
) on public.questions to anon, authenticated;

revoke select on public.choices from anon, authenticated;
grant select (id, question_id, text, position) on public.choices to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Participants (anonymous players)
-- ---------------------------------------------------------------------------

-- SELECT: own row (via header token) or the row of a competition the host owns.
create policy "participants_select_self_or_owner" on public.participants
  for select to anon, authenticated
  using (
    id = public.participant_from_header(competition_id)
    or exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.owner_id = auth.uid()
    )
  );

-- UPDATE: own row only, limited to connectivity columns (granted below).
create policy "participants_update_self" on public.participants
  for update to anon, authenticated
  using (id = public.participant_from_header(competition_id))
  with check (id = public.participant_from_header(competition_id));

revoke insert, delete, truncate on public.participants from anon, authenticated;
revoke update on public.participants from anon, authenticated;
grant update (connected, last_seen_at, status) on public.participants to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Answers (server-scored; clients never write is_correct/points/bonus_points)
-- ---------------------------------------------------------------------------

create policy "answers_select_self_or_owner" on public.answers
  for select to anon, authenticated
  using (
    participant_id = public.participant_from_header(competition_id)
    or exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.owner_id = auth.uid()
    )
  );

revoke insert, update, delete, truncate on public.answers from anon, authenticated;

-- One answer per participant per question (also the ON CONFLICT target of
-- submit_answer, so it must exist before that function is created).
create unique index if not exists answers_one_per_question_uidx
  on public.answers (participant_id, question_id);

-- ---------------------------------------------------------------------------
-- Scoring engine (SECURITY DEFINER trigger: computes the server-authoritative
-- result at insert/update time; clients cannot influence the outcome).
-- ---------------------------------------------------------------------------

create or replace function public.grade_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.questions;
  v_c public.competitions;
  v_is_correct boolean := false;
  v_points double precision := 0;
  v_bonus double precision := 0;
  v_duration_ms integer;
  v_answered boolean;
begin
  select * into v_q from public.questions where id = new.question_id;
  if v_q.id is null then
    raise exception 'Question does not exist' using errcode = '23503';
  end if;
  select * into v_c from public.competitions where id = new.competition_id;
  if v_c.id is null then
    raise exception 'Competition does not exist' using errcode = '23503';
  end if;

  if new.submitted_at is null then
    new.submitted_at := now();
  end if;

  v_answered := new.choice_id is not null or new.answer_text is not null;

  if v_q.type in ('mcq', 'true_false') then
    if new.choice_id is not null then
      select c.is_correct into v_is_correct
      from public.choices c
      where c.id = new.choice_id and c.question_id = new.question_id;
    end if;
  else
    v_is_correct :=
      lower(btrim(coalesce(new.answer_text, '')))
      = lower(btrim(coalesce(v_q.correct_answer_text, '')));
  end if;

  v_is_correct := coalesce(v_is_correct, false);

  if new.submitted_at > coalesce(v_q.ends_at, new.submitted_at) then
    v_is_correct := false;
    v_points := 0;
    v_bonus := 0;
  elsif v_is_correct then
    v_points := coalesce(v_q.points, v_c.default_points, 0);
    v_duration_ms := v_q.duration_seconds * 1000;
    if v_c.speed_bonus_enabled and v_duration_ms > 0
       and new.response_time_ms >= 0 and new.response_time_ms < v_duration_ms then
      v_bonus := round(
        v_points * (1 - new.response_time_ms::double precision / v_duration_ms),
        1
      );
    end if;
  else
    -- wrong but submitted: apply configured negative points; unanswered = 0
    if v_answered then
      v_points := coalesce(v_q.negative_points, v_c.default_negative_points, 0);
    end if;
  end if;

  new.is_correct := v_is_correct;
  new.points := v_points;
  new.bonus_points := v_bonus;

  return new;
end;
$$;

revoke execute on function public.grade_answer() from public, anon, authenticated;

create trigger answers_grade_insert
  before insert on public.answers
  for each row execute function public.grade_answer();

create trigger answers_grade_update
  before update on public.answers
  for each row execute function public.grade_answer();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Join a waiting game by its public code. Server-issues participant_code and
-- access_token (guaranteeing anonymity + unguessable identity for RLS).
create or replace function public.join_competition(p_code text, p_display_name text)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comp public.competitions;
  v_participant public.participants;
  v_display text := btrim(p_display_name);
begin
  select * into v_comp
  from public.competitions
  where upper(code) = upper(btrim(p_code))
  limit 1;

  if v_comp.id is null or v_comp.status <> 'waiting' then
    raise exception 'This game is not open to join' using errcode = '28000';
  end if;

  if char_length(v_display) < 2 or char_length(v_display) > 50 then
    raise exception 'Display name must be between 2 and 50 characters' using errcode = '22023';
  end if;

  insert into public.participants (competition_id, display_name, participant_code, access_token)
  values (v_comp.id, v_display, gen_random_uuid()::text, gen_random_uuid()::text)
  returning * into v_participant;

  return v_participant;
end;
$$;

revoke execute on function public.join_competition(text, text) from public, authenticated;
grant execute on function public.join_competition(text, text) to anon;

-- Submit an answer. Only the raw selection + client-measured response time are
-- accepted; scoring is applied by the grade_answer trigger.
create or replace function public.submit_answer(
  p_competition_id uuid,
  p_question_id uuid,
  p_choice_id uuid default null,
  p_answer_text text default null,
  p_response_time_ms integer default 0
)
returns public.answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant uuid := public.participant_from_header(p_competition_id);
  v_answer public.answers;
begin
  if v_participant is null then
    raise exception 'Not a participant of this game' using errcode = '28000';
  end if;
  if p_choice_id is null and p_answer_text is null then
    raise exception 'Provide a choice or an answer' using errcode = '22023';
  end if;
  if p_response_time_ms < 0 then
    p_response_time_ms := 0;
  end if;

  insert into public.answers as a (
    competition_id, question_id, participant_id, choice_id, answer_text, response_time_ms
  )
  values (p_competition_id, p_question_id, v_participant, p_choice_id, p_answer_text, p_response_time_ms)
  on conflict (participant_id, question_id) do update
    set choice_id = excluded.choice_id,
        answer_text = excluded.answer_text,
        response_time_ms = excluded.response_time_ms,
        submitted_at = excluded.submitted_at
  returning * into v_answer;

  return v_answer;
end;
$$;

revoke execute on function public.submit_answer(uuid, uuid, uuid, text, integer) from public, authenticated;
grant execute on function public.submit_answer(uuid, uuid, uuid, text, integer) to anon;

-- Reveal: correct answer + explanation for a finished question. Callable by the
-- competition owner or a participant. Never exposes is_correct via REST.
create or replace function public.get_question_reveal(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.questions;
  v_c public.competitions;
  v_rows jsonb;
begin
  select * into v_q from public.questions where id = p_question_id;
  if v_q.id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;

  select * into v_c from public.competitions where id = v_q.competition_id;

  if not (
    (v_c.owner_id is not null and v_c.owner_id = auth.uid())
    or public.participant_from_header(v_c.id) is not null
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'question_id', v_q.id,
    'text', v_q.text,
    'correct_answer_text', v_q.correct_answer_text,
    'explanation', v_q.explanation,
    'correct_choice', (
      select jsonb_build_object('id', c.id, 'text', c.text)
      from public.choices c
      where c.question_id = v_q.id and c.is_correct
      limit 1
    ),
    'choices', (
      select jsonb_agg(jsonb_build_object('id', c.id, 'text', c.text) order by c.position)
      from public.choices c
      where c.question_id = v_q.id
    )
  ) into v_rows;

  return v_rows;
end;
$$;

revoke execute on function public.get_question_reveal(uuid) from public, authenticated;
grant execute on function public.get_question_reveal(uuid) to anon, authenticated;

-- Leaderboard: aggregated, rank-ordered. Aggregates only — no per-question
-- rows, so students see totals without leaking each other's answers.
create or replace function public.game_leaderboard(p_competition_id uuid)
returns table (
  rank bigint,
  participant_id uuid,
  display_name text,
  correct_count bigint,
  answered_count bigint,
  total_points double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    row_number() over (
      order by
        coalesce(sum(a.points + a.bonus_points), 0) desc,
        count(*) filter (where a.is_correct) desc,
        pri.display_name asc
    )::bigint,
    pri.id,
    pri.display_name,
    count(*) filter (where a.is_correct)::bigint,
    count(a.id)::bigint,
    coalesce(sum(a.points + a.bonus_points), 0)
  from public.participants pri
  left join public.answers a on a.participant_id = pri.id
  where pri.competition_id = p_competition_id
  group by pri.id, pri.display_name
  order by
    coalesce(sum(a.points + a.bonus_points), 0) desc,
    count(*) filter (where a.is_correct) desc,
    pri.display_name asc;
$$;

revoke execute on function public.game_leaderboard(uuid) from public;
grant execute on function public.game_leaderboard(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_keys: never reachable from the client.
-- ---------------------------------------------------------------------------
revoke all on public.admin_keys from anon, authenticated;