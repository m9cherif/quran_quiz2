-- Bug fix: save_question read `is_correct` out of each choice object, but every
-- caller (quiz editor + control-room "Add question") sent `isCorrect`. The
-- coalesce fell through to false, so an MCQ saved from the UI ended up with no
-- correct choice at all: grade_answer then scored every submission wrong and
-- applied negative points. true_false was unaffected (its choices are derived
-- from correct_answer_text) which is why this stayed hidden.
--
-- The frontend now sends snake_case; accepting both spellings keeps already
-- deployed clients working and makes the RPC contract forgiving.

create or replace function public.save_question(
  p_competition_id uuid,
  p_position integer,
  p_text text,
  p_question_id uuid default null,
  p_type text default 'mcq',
  p_duration_seconds integer default 15,
  p_points integer default null,
  p_negative_points integer default null,
  p_explanation text default null,
  p_correct_answer_text text default null,
  p_surah_number integer default null,
  p_ayah_number integer default null,
  p_page_number integer default null,
  p_juz_number integer default null,
  p_hizb_number integer default null,
  p_choices jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qid uuid := p_question_id;
  v_choice jsonb;
  v_is_correct boolean;
begin
  if not exists (
    select 1 from public.competitions c
    where c.id = p_competition_id
      and c.owner_id = auth.uid()
      and c.status in ('draft', 'waiting', 'running', 'paused')
  ) then
    raise exception 'Only the quiz owner can add or edit questions while the quiz is a draft, the lobby is open, or the game is live' using errcode = '42501';
  end if;
  if p_text is null or btrim(p_text) = '' then
    raise exception 'Question text is required' using errcode = '22023';
  end if;
  if p_position < 1 then
    raise exception 'Position must be at least 1' using errcode = '22023';
  end if;

  if v_qid is null then
    insert into public.questions (
      competition_id, position, text, type, duration_seconds, points,
      negative_points, explanation, correct_answer_text,
      surah_number, ayah_number, page_number, juz_number, hizb_number
    ) values (
      p_competition_id, p_position, btrim(p_text), p_type, p_duration_seconds, p_points,
      p_negative_points, p_explanation, nullif(p_correct_answer_text, ''),
      p_surah_number, p_ayah_number, p_page_number, p_juz_number, p_hizb_number
    )
    returning id into v_qid;
  else
    if not exists (
      select 1 from public.questions q
      where q.id = v_qid and q.competition_id = p_competition_id
    ) then
      raise exception 'Question does not belong to this quiz' using errcode = '23503';
    end if;
    if exists (
      select 1 from public.questions q
      where q.id = v_qid and q.started_at is not null
    ) then
      raise exception 'A question that has already started can no longer be edited' using errcode = '42501';
    end if;
    update public.questions set
      position = p_position,
      text = btrim(p_text),
      type = p_type,
      duration_seconds = p_duration_seconds,
      points = p_points,
      negative_points = p_negative_points,
      explanation = p_explanation,
      correct_answer_text = nullif(p_correct_answer_text, ''),
      surah_number = p_surah_number,
      ayah_number = p_ayah_number,
      page_number = p_page_number,
      juz_number = p_juz_number,
      hizb_number = p_hizb_number
    where id = v_qid;
  end if;

  delete from public.choices where question_id = v_qid;
  for v_choice in select * from jsonb_array_elements(p_choices) loop
    if (v_choice ->> 'text') is null or btrim(v_choice ->> 'text') = '' then
      continue;
    end if;
    -- Accept either spelling; the UI historically sent camelCase.
    v_is_correct := coalesce(
      (v_choice ->> 'is_correct')::boolean,
      (v_choice ->> 'isCorrect')::boolean,
      false
    );
    insert into public.choices (question_id, text, position, is_correct)
    values (
      v_qid,
      btrim(v_choice ->> 'text'),
      (v_choice ->> 'position')::integer,
      v_is_correct
    );
  end loop;

  if p_type = 'true_false' and not exists (
    select 1 from public.choices c where c.question_id = v_qid
  ) then
    insert into public.choices (question_id, text, position, is_correct)
    values
      (v_qid, 'True', 1, lower(btrim(coalesce(p_correct_answer_text, ''))) = 'true'),
      (v_qid, 'False', 2, lower(btrim(coalesce(p_correct_answer_text, ''))) = 'false');
  end if;

  return v_qid;
end;
$$;
