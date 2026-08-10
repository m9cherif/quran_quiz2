-- 20260810121300_student_game_support.sql
-- Phase 8 · Live game student: session/identity RPCs, presence, join-count,
-- and two hardening fixes on the Phase 4 contract:
--   * get_question_reveal now refuses to reveal while a question is still
--     open (participants) — previously the correct answer leaked mid-question.
--   * submit_answer now locks the FIRST answer per question (one per
--     participant) and rejects submissions before the question starts —
--     previously a participant could re-submit a correct guess with
--     response_time_ms = 0 to maximize the speed bonus, or pre-answer.

-- ---------------------------------------------------------------------------
-- submit_answer: one answer locked per participant per question.
-- ---------------------------------------------------------------------------
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
  v_q public.questions;
  v_c public.competitions;
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

  select * into v_q from public.questions where id = p_question_id;
  if v_q.id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;
  if v_q.competition_id <> p_competition_id then
    raise exception 'Question does not belong to this game' using errcode = '23503';
  end if;
  select * into v_c from public.competitions where id = p_competition_id;
  if v_c.status not in ('running', 'paused') then
    raise exception 'Game is not active' using errcode = '28000';
  end if;
  if v_q.started_at is null or now() < v_q.started_at then
    raise exception 'Question is not open yet' using errcode = '28000';
  end if;

  insert into public.answers as a (
    competition_id, question_id, participant_id, choice_id, answer_text, response_time_ms
  )
  values (p_competition_id, p_question_id, v_participant, p_choice_id, p_answer_text, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing
  returning * into v_answer;

  if v_answer.id is null then
    select * into v_answer
    from public.answers
    where competition_id = p_competition_id
      and question_id = p_question_id
      and participant_id = v_participant;
  end if;

  return v_answer;
end;
$$;

revoke execute on function public.submit_answer(uuid, uuid, uuid, text, integer) from public, authenticated;
grant execute on function public.submit_answer(uuid, uuid, uuid, text, integer) to anon;

-- ---------------------------------------------------------------------------
-- get_question_reveal: hosts may always reveal; participants only after the
-- question window closes.
-- ---------------------------------------------------------------------------
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

  if v_c.owner_id is not null and v_c.owner_id = auth.uid() then
    null; -- host always allowed
  elsif public.participant_from_header(v_c.id) is not null then
    if v_q.ends_at is null or v_q.ends_at > now() then
      raise exception 'Question is still open' using errcode = '42501';
    end if;
  else
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

-- ---------------------------------------------------------------------------
-- Student session restore: the participant row behind the header token.
-- ---------------------------------------------------------------------------
create or replace function public.my_participant(p_competition_id uuid)
returns public.participants
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.participants
  where competition_id = p_competition_id
    and id = public.participant_from_header(p_competition_id)
  limit 1;
$$;

revoke execute on function public.my_participant(uuid) from public;
grant execute on function public.my_participant(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Presence heartbeat for the token-identified participant.
-- ---------------------------------------------------------------------------
create or replace function public.update_presence(p_competition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant uuid := public.participant_from_header(p_competition_id);
begin
  if v_participant is null then
    raise exception 'Not a participant of this game' using errcode = '28000';
  end if;
  update public.participants
  set connected = true, last_seen_at = now()
  where id = v_participant;
end;
$$;

revoke execute on function public.update_presence(uuid) from public;
grant execute on function public.update_presence(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lobby player count (participants or host only; aggregates, no names).
-- ---------------------------------------------------------------------------
create or replace function public.game_participant_count(p_competition_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.participants
  where competition_id = p_competition_id
    and (
      public.participant_from_header(p_competition_id) is not null
      or exists (
        select 1 from public.competitions c
        where c.id = p_competition_id and c.owner_id = auth.uid()
      )
    );
$$;

revoke execute on function public.game_participant_count(uuid) from public, anon, authenticated;
grant execute on function public.game_participant_count(uuid) to anon, authenticated;