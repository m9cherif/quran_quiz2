-- Platform upgrade · performance + new host capabilities (all additive, so it
-- is safe to apply before the matching frontend ships). The security fix that
-- gates game_leaderboard lives in the next migration, which must be applied
-- only after the new frontend is deployed — it starts sending the participant
-- token on that call.
--
--   1. get_quiz_questions_full replaces the editor's N+1 (one get_question_full
--      round trip per question) with a single owner-scoped call.
--   2. advance_game closes the open question and opens the next one atomically,
--      so "next question" is one round trip and cannot interleave.
--   3. game_answer_matrix backs the host results CSV export (owner only).
--   4. import_quiz creates a full quiz (questions + choices) from a JSON payload.
--   5. host_overview aggregates every game a host owns (cross-game dashboard).
--   6. class_members(profile_id) index for my_classes().

-- ---------------------------------------------------------------------------
-- 1. Whole-deck editor read (owner only) — one call instead of one per question.
-- ---------------------------------------------------------------------------
create or replace function public.get_quiz_questions_full(p_competition_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not exists (
    select 1 from public.competitions c
    where c.id = p_competition_id and c.owner_id = (select auth.uid())
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(s.q order by s.position), '[]'::jsonb)
  into v_rows
  from (
    select
      qq.position,
      jsonb_build_object(
        'id', qq.id,
        'competition_id', qq.competition_id,
        'position', qq.position,
        'text', qq.text,
        'type', qq.type,
        'duration_seconds', qq.duration_seconds,
        'points', qq.points,
        'negative_points', qq.negative_points,
        'explanation', qq.explanation,
        'correct_answer_text', qq.correct_answer_text,
        'started_at', qq.started_at,
        'surah_number', qq.surah_number,
        'ayah_number', qq.ayah_number,
        'page_number', qq.page_number,
        'juz_number', qq.juz_number,
        'hizb_number', qq.hizb_number,
        'choices', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', c.id, 'text', c.text, 'position', c.position, 'is_correct', c.is_correct
            ) order by c.position
          )
          from public.choices c where c.question_id = qq.id
        ), '[]'::jsonb)
      ) as q
    from public.questions qq
    where qq.competition_id = p_competition_id
  ) s;

  return v_rows;
end;
$$;

revoke execute on function public.get_quiz_questions_full(uuid) from public, anon;
grant execute on function public.get_quiz_questions_full(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Atomic "next question": close the open one, open the next unstarted one.
--    Also promotes a waiting lobby to running on the first advance.
-- ---------------------------------------------------------------------------
create or replace function public.advance_game(p_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comp public.competitions;
  v_open public.questions;
  v_next public.questions;
  v_window_seconds int;
  v_ends_at timestamptz;
begin
  select * into v_comp from public.competitions where id = p_competition_id;
  if v_comp.id is null then
    raise exception 'Game not found' using errcode = 'P0002';
  end if;
  if v_comp.owner_id is null or v_comp.owner_id <> (select auth.uid()) then
    raise exception 'Only the game host can run questions' using errcode = '42501';
  end if;
  if v_comp.status not in ('waiting', 'running', 'paused') then
    raise exception 'Game is not active' using errcode = '28000';
  end if;

  -- Close whatever is still open (no-op when the window already expired).
  select * into v_open
  from public.questions
  where competition_id = p_competition_id
    and started_at is not null
    and (ends_at is null or ends_at > now())
  order by position
  limit 1;

  if v_open.id is not null then
    update public.questions set ends_at = now() where id = v_open.id;
  end if;

  -- Open the next question that has never run.
  select * into v_next
  from public.questions
  where competition_id = p_competition_id and started_at is null
  order by position
  limit 1;

  if v_next.id is not null then
    v_window_seconds := least(
      v_next.duration_seconds,
      greatest(coalesce(v_comp.minutes_per_question, 1), 1) * 60
    );
    v_ends_at := now() + (v_window_seconds * interval '1 second');

    update public.questions
    set started_at = now(), ends_at = v_ends_at
    where id = v_next.id;

    if v_comp.status <> 'running' then
      update public.competitions set status = 'running' where id = p_competition_id;
    end if;
  end if;

  return jsonb_build_object(
    'closed_question_id', v_open.id,
    'started_question_id', v_next.id,
    'started_position', v_next.position,
    'ends_at', v_ends_at,
    'has_more', exists (
      select 1 from public.questions
      where competition_id = p_competition_id and started_at is null and id is distinct from v_next.id
    )
  );
end;
$$;

revoke execute on function public.advance_game(uuid) from public, anon;
grant execute on function public.advance_game(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Full answer matrix for the host results export (owner only).
-- ---------------------------------------------------------------------------
create or replace function public.game_answer_matrix(p_competition_id uuid)
returns table (
  display_name text,
  position_number integer,
  question_text text,
  answer_text text,
  is_correct boolean,
  points double precision,
  response_time_ms integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.competitions c
    where c.id = p_competition_id and c.owner_id = (select auth.uid())
  ) then
    raise exception 'Only the game host can export results' using errcode = '42501';
  end if;

  return query
  select
    p.display_name,
    q.position::integer,
    q.text,
    coalesce(ch.text, a.answer_text),
    a.is_correct,
    coalesce(a.points, 0) + coalesce(a.bonus_points, 0),
    a.response_time_ms
  from public.participants p
  cross join public.questions q
  left join public.answers a
    on a.participant_id = p.id and a.question_id = q.id
  left join public.choices ch on ch.id = a.choice_id
  where p.competition_id = p_competition_id
    and q.competition_id = p_competition_id
  order by p.display_name, q.position;
end;
$$;

revoke execute on function public.game_answer_matrix(uuid) from public, anon;
grant execute on function public.game_answer_matrix(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Import a quiz (questions + choices) from JSON. Always lands as a draft
--    owned by the caller; never trusts ids, status, owner or timing fields.
-- ---------------------------------------------------------------------------
create or replace function public.import_quiz(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new_id uuid;
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_questions jsonb := coalesce(p_payload -> 'questions', '[]'::jsonb);
  v_q jsonb;
  v_qid uuid;
  v_choice jsonb;
  v_pos integer := 0;
  v_cpos integer;
  v_type text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Quiz name must be between 2 and 120 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(v_questions) <> 'array' then
    raise exception 'questions must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(v_questions) > 200 then
    raise exception 'A quiz cannot hold more than 200 questions' using errcode = '22023';
  end if;

  insert into public.competitions (
    name, title, description, status, owner_id, visibility,
    language, category, difficulty,
    default_points, default_negative_points, speed_bonus_enabled
  ) values (
    v_name,
    v_name,
    nullif(btrim(coalesce(p_payload ->> 'description', '')), ''),
    'draft',
    v_uid,
    'private',
    coalesce(nullif(p_payload ->> 'language', ''), 'en'),
    nullif(btrim(coalesce(p_payload ->> 'category', '')), ''),
    nullif(p_payload ->> 'difficulty', ''),
    coalesce((p_payload ->> 'default_points')::integer, 10),
    coalesce((p_payload ->> 'default_negative_points')::integer, -2),
    coalesce((p_payload ->> 'speed_bonus_enabled')::boolean, false)
  )
  returning id into v_new_id;

  for v_q in select * from jsonb_array_elements(v_questions) loop
    if btrim(coalesce(v_q ->> 'text', '')) = '' then
      continue;
    end if;
    v_pos := v_pos + 1;
    v_type := coalesce(nullif(v_q ->> 'type', ''), 'mcq');
    if v_type not in ('mcq', 'true_false', 'text', 'number', 'audio') then
      v_type := 'mcq';
    end if;

    insert into public.questions (
      competition_id, position, text, type, duration_seconds, points,
      negative_points, explanation, correct_answer_text,
      surah_number, ayah_number, page_number, juz_number, hizb_number
    ) values (
      v_new_id,
      v_pos,
      btrim(v_q ->> 'text'),
      v_type,
      least(greatest(coalesce((v_q ->> 'duration_seconds')::integer, 15), 1), 600),
      (v_q ->> 'points')::integer,
      (v_q ->> 'negative_points')::integer,
      nullif(btrim(coalesce(v_q ->> 'explanation', '')), ''),
      nullif(btrim(coalesce(v_q ->> 'correct_answer_text', '')), ''),
      (v_q ->> 'surah_number')::integer,
      (v_q ->> 'ayah_number')::integer,
      (v_q ->> 'page_number')::integer,
      (v_q ->> 'juz_number')::integer,
      (v_q ->> 'hizb_number')::integer
    )
    returning id into v_qid;

    v_cpos := 0;
    for v_choice in select * from jsonb_array_elements(coalesce(v_q -> 'choices', '[]'::jsonb)) loop
      if btrim(coalesce(v_choice ->> 'text', '')) = '' then
        continue;
      end if;
      v_cpos := v_cpos + 1;
      exit when v_cpos > 10;
      insert into public.choices (question_id, text, position, is_correct)
      values (
        v_qid,
        btrim(v_choice ->> 'text'),
        v_cpos,
        coalesce((v_choice ->> 'is_correct')::boolean, false)
      );
    end loop;

    if v_type = 'true_false' and v_cpos = 0 then
      insert into public.choices (question_id, text, position, is_correct)
      values
        (v_qid, 'True', 1, lower(btrim(coalesce(v_q ->> 'correct_answer_text', ''))) = 'true'),
        (v_qid, 'False', 2, lower(btrim(coalesce(v_q ->> 'correct_answer_text', ''))) = 'false');
    end if;
  end loop;

  return v_new_id;
end;
$$;

revoke execute on function public.import_quiz(jsonb) from public, anon;
grant execute on function public.import_quiz(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Cross-game overview for the signed-in host.
-- ---------------------------------------------------------------------------
create or replace function public.host_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'quizzes_total', count(*) filter (where c.status = 'draft'),
    'games_total', count(*) filter (where c.status <> 'draft'),
    'games_finished', count(*) filter (where c.status = 'finished'),
    'games_live', count(*) filter (where c.status in ('waiting', 'running', 'paused')),
    'players_total', coalesce(sum((
      select count(*) from public.participants p where p.competition_id = c.id
    )), 0),
    'questions_total', coalesce(sum((
      select count(*) from public.questions q where q.competition_id = c.id
    )), 0),
    'answers_total', coalesce(sum((
      select count(*) from public.answers a where a.competition_id = c.id
    )), 0)
  )
  into v_result
  from public.competitions c
  where c.owner_id = v_uid and c.archived_at is null;

  v_result := v_result || jsonb_build_object(
    'avg_accuracy', coalesce((
      select round((count(*) filter (where a.is_correct)::numeric / nullif(count(*), 0)) * 100, 1)
      from public.answers a
      join public.competitions c on c.id = a.competition_id
      where c.owner_id = v_uid
    ), 0),
    'students_reached', coalesce((
      select count(distinct lower(p.display_name))
      from public.participants p
      join public.competitions c on c.id = p.competition_id
      where c.owner_id = v_uid
    ), 0),
    'classes_total', coalesce((
      select count(*) from public.classes cl
      where cl.owner_id = v_uid and cl.archived_at is null
    ), 0)
  );

  return v_result;
end;
$$;

revoke execute on function public.host_overview() from public, anon;
grant execute on function public.host_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. my_classes() filters class_members by profile_id; the composite PK
--    (class_id, profile_id) cannot serve that lookup.
-- ---------------------------------------------------------------------------
create index if not exists class_members_profile_id_idx
  on public.class_members (profile_id);
