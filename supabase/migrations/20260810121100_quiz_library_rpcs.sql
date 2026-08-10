-- Phase 6: quiz library RPCs (owner-scoped, single round trip, counts included)

create or replace function public.list_my_quizzes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'name', c.name,
      'description', c.description,
      'status', c.status,
      'visibility', c.visibility,
      'cover_url', c.cover_url,
      'language', c.language,
      'category', c.category,
      'difficulty', c.difficulty,
      'default_points', c.default_points,
      'default_negative_points', c.default_negative_points,
      'speed_bonus_enabled', c.speed_bonus_enabled,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'question_count', (select count(*) from public.questions q where q.competition_id = c.id),
      'participant_count', (select count(*) from public.participants p where p.competition_id = c.id)
    ) order by c.updated_at desc
  ), '[]'::jsonb)
  into v_rows
  from public.competitions c
  where c.owner_id = auth.uid() and c.archived_at is null;

  return v_rows;
end;
$$;

create or replace function public.archive_quiz(p_competition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.competitions
  set archived_at = now()
  where id = p_competition_id and owner_id = auth.uid() and status = 'draft';
  if not found then
    raise exception 'Quiz not found or not editable' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.duplicate_quiz(p_competition_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.competitions;
  v_new_id uuid;
  v_q public.questions;
  v_new_qid uuid;
begin
  select * into v_src from public.competitions
  where id = p_competition_id and owner_id = auth.uid() and archived_at is null;
  if v_src.id is null then
    raise exception 'Quiz not found' using errcode = '42501';
  end if;

  insert into public.competitions (
    name, description, status, default_points, default_negative_points,
    speed_bonus_enabled, owner_id, visibility, cover_url, language, category, difficulty
  ) values (
    v_src.name || ' (copy)', v_src.description, 'draft', v_src.default_points,
    v_src.default_negative_points, v_src.speed_bonus_enabled, v_src.owner_id,
    v_src.visibility, v_src.cover_url, v_src.language, v_src.category, v_src.difficulty
  )
  returning id into v_new_id;

  for v_q in
    select * from public.questions q
    where q.competition_id = p_competition_id
    order by q.position
  loop
    insert into public.questions (
      competition_id, position, text, type, duration_seconds, points,
      negative_points, explanation, correct_answer_text, audio_url,
      surah_number, ayah_number, page_number, juz_number, hizb_number
    ) values (
      v_new_id, v_q.position, v_q.text, v_q.type, v_q.duration_seconds, v_q.points,
      v_q.negative_points, v_q.explanation, v_q.correct_answer_text, v_q.audio_url,
      v_q.surah_number, v_q.ayah_number, v_q.page_number, v_q.juz_number, v_q.hizb_number
    )
    returning id into v_new_qid;

    insert into public.choices (question_id, text, position, is_correct)
    select v_new_qid, c.text, c.position, c.is_correct
    from public.choices c
    where c.question_id = v_q.id
    order by c.position;
  end loop;

  return v_new_id;
end;
$$;

revoke execute on function public.list_my_quizzes() from public, anon;
revoke execute on function public.archive_quiz(uuid) from public, anon;
revoke execute on function public.duplicate_quiz(uuid) from public, anon;