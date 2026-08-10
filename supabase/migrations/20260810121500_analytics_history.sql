-- Phase 10: Dashboards + analytics
--   * participants.profile_id — links a signed-in student to their anonymous
--     game row so history survives across sessions (no token needed).
--   * join_competition gains an optional p_profile_id (validated against
--     auth.uid()) and is granted to authenticated too (previously revoked —
--     signed-in students could not join).
--   * game_analytics(p_competition_id) — owner-gated host dashboard stats.
--   * my_history() — the signed-in user's own game history + progress.

alter table public.participants
  add column profile_id uuid references public.profiles(id);

create index if not exists participants_profile_id_idx
  on public.participants (profile_id);

-- ---------------------------------------------------------------------------
-- Join with optional profile link
-- ---------------------------------------------------------------------------

drop function if exists public.join_competition(text, text);

create or replace function public.join_competition(
  p_code text,
  p_display_name text,
  p_profile_id uuid default null
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comp public.competitions;
  v_participant public.participants;
  v_uid uuid := (select auth.uid());
  v_display text := btrim(p_display_name);
begin
  if p_profile_id is not null and (v_uid is null or p_profile_id <> v_uid) then
    raise exception 'Profile link does not match the current session' using errcode = '42501';
  end if;

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
    insert into public.participants (competition_id, display_name, participant_code, access_token, profile_id)
    values (v_comp.id, v_display, gen_random_uuid()::text, gen_random_uuid()::text, p_profile_id)
    returning * into v_participant;
  exception when unique_violation then
    raise exception 'That display name is already taken in this game' using errcode = '23505';
  end;

  return v_participant;
end;
$$;

revoke execute on function public.join_competition(text, text, uuid) from public;
grant execute on function public.join_competition(text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Host analytics for one game (owner only)
-- ---------------------------------------------------------------------------

create or replace function public.game_analytics(p_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_result jsonb;
begin
  select owner_id into v_owner
  from public.competitions
  where id = p_competition_id;

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'Game not found' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'game_id', c.id,
    'code', c.code,
    'status', c.status,
    'finished_at', c.finished_at,
    'questions_count', (select count(*) from public.questions q where q.competition_id = c.id),
    'participants_count', (select count(*) from public.participants p where p.competition_id = c.id and p.connected),
    'answers_count', (select count(*) from public.answers a where a.competition_id = c.id),
    'avg_score', coalesce((
      select round(avg(total)) from (
        select sum(a.points + a.bonus_points) as total
        from public.answers a
        where a.competition_id = c.id
        group by a.participant_id
      ) t
    )::numeric(10,1), 0),
    'avg_accuracy', coalesce((
      select round((count(*) filter (where a.is_correct)::numeric / nullif(count(*), 0)) * 100, 1)
      from public.answers a
      where a.competition_id = c.id
    ), 0),
    'avg_response_time_ms', coalesce((
      select round(avg(a.response_time_ms))
      from public.answers a
      where a.competition_id = c.id
    ), 0),
    'most_missed', (
      select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
      from (
        select
          q.position,
          q.text,
          count(a.id) - count(*) filter (where a.is_correct) as incorrect_count,
          round((count(*) filter (where a.is_correct)::numeric / nullif(count(a.id), 0)) * 100, 1) as accuracy,
          round(avg(a.response_time_ms)) as avg_response_time_ms
        from public.questions q
        left join public.answers a on a.question_id = q.id
        where q.competition_id = c.id
        group by q.id, q.position, q.text
        having count(a.id) - count(*) filter (where a.is_correct) > 0
        order by (count(a.id) - count(*) filter (where a.is_correct)) desc, q.position asc
        limit 5
      ) x
    )
  ) into v_result
  from public.competitions c
  where c.id = p_competition_id;

  return v_result;
end;
$$;

revoke execute on function public.game_analytics(uuid) from public;
grant execute on function public.game_analytics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Signed-in user's own game history (definer — reads only their linked rows)
-- ---------------------------------------------------------------------------

create or replace function public.my_history()
returns table (
  competition_id uuid,
  code text,
  name text,
  status text,
  finished_at timestamptz,
  joined_at timestamptz,
  score numeric,
  answered_count bigint,
  correct_count bigint,
  accuracy numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  return query
  select
    p.competition_id,
    c.code,
    c.name,
    c.status,
    c.finished_at,
    p.joined_at,
    coalesce(sum(a.points + a.bonus_points), 0)::numeric as score,
    count(a.id) as answered_count,
    count(a.id) filter (where a.is_correct) as correct_count,
    coalesce(round(
      (count(a.id) filter (where a.is_correct)::numeric / nullif(count(a.id), 0)) * 100, 1
    ), 0) as accuracy
  from public.participants p
  join public.competitions c on c.id = p.competition_id
  left join public.answers a on a.participant_id = p.id
  where p.profile_id = v_uid
  group by p.id, c.id, c.code, c.name, c.status, c.finished_at, p.joined_at
  order by p.joined_at desc;
end;
$$;

revoke execute on function public.my_history() from public, anon;
grant execute on function public.my_history() to authenticated;