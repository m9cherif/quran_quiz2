-- 20260810120800_advisor_cleanup_indexes_policy_initplans.sql
-- Phase 4 · Advisor pass (performance lints):
--   * dropped indexes that duplicated the pre-existing idx_* / unique set
--   * added answers(choice_id) covering index for that FK
--   * rewrote policies to resolve auth.uid() via initplan subselects
--   * join_competition now surfaces a friendly error for duplicate names
--     (pre-existing uq_participants_per_competition_display_name)

drop index if exists public.answers_competition_id_idx;
drop index if exists public.answers_question_id_idx;
drop index if exists public.answers_participant_id_idx;
drop index if exists public.answers_one_per_question_uidx;
drop index if exists public.choices_question_id_idx;
drop index if exists public.competitions_status_idx;
drop index if exists public.participants_competition_id_idx;
drop index if exists public.participants_code_idx;
drop index if exists public.questions_competition_position_idx;

create index if not exists answers_choice_id_idx on public.answers (choice_id);

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists "competitions_select_visible" on public.competitions;
create policy "competitions_select_visible" on public.competitions
  for select to anon, authenticated
  using (
    owner_id is null
    or owner_id = (select auth.uid())
    or status in ('waiting', 'running', 'paused', 'finished')
  );

drop policy if exists "competitions_insert_owner" on public.competitions;
create policy "competitions_insert_owner" on public.competitions
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "competitions_update_owner" on public.competitions;
create policy "competitions_update_owner" on public.competitions
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "competitions_delete_owner" on public.competitions;
create policy "competitions_delete_owner" on public.competitions
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "questions_select_owner" on public.questions;
create policy "questions_select_owner" on public.questions
  for select to authenticated
  using (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "questions_insert_owner" on public.questions;
create policy "questions_insert_owner" on public.questions
  for insert to authenticated
  with check (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "questions_update_owner" on public.questions;
create policy "questions_update_owner" on public.questions
  for update to authenticated
  using (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "questions_delete_owner" on public.questions;
create policy "questions_delete_owner" on public.questions
  for delete to authenticated
  using (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "choices_select_owner" on public.choices;
create policy "choices_select_owner" on public.choices
  for select to authenticated
  using (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "choices_insert_owner" on public.choices;
create policy "choices_insert_owner" on public.choices
  for insert to authenticated
  with check (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "choices_update_owner" on public.choices;
create policy "choices_update_owner" on public.choices
  for update to authenticated
  using (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "choices_delete_owner" on public.choices;
create policy "choices_delete_owner" on public.choices
  for delete to authenticated
  using (exists (
    select 1 from public.questions q
    join public.competitions c on c.id = q.competition_id
    where q.id = question_id and c.owner_id = (select auth.uid())
  ));

drop policy if exists "participants_select_self_or_owner" on public.participants;
create policy "participants_select_self_or_owner" on public.participants
  for select to anon, authenticated
  using (
    id = public.participant_from_header(competition_id)
    or exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "answers_select_self_or_owner" on public.answers;
create policy "answers_select_self_or_owner" on public.answers
  for select to anon, authenticated
  using (
    participant_id = public.participant_from_header(competition_id)
    or exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.owner_id = (select auth.uid())
    )
  );

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

  begin
    insert into public.participants (competition_id, display_name, participant_code, access_token)
    values (v_comp.id, v_display, gen_random_uuid()::text, gen_random_uuid()::text)
    returning * into v_participant;
  exception when unique_violation then
    raise exception 'That display name is already taken in this game' using errcode = '23505';
  end;

  return v_participant;
end;
$$;