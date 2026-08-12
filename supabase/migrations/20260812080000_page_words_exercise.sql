-- "Mots cachés" (hidden words) exercise — the PyQt exercices.py game as a
-- question type.
--
-- A page_words question shows a Quran page image and masks N word boxes; the
-- student drops the shuffled words back onto the right boxes.
--
-- Split of trust:
--   * questions.regions (jsonb, readable by players) holds ONLY box geometry,
--     normalised 0..1 so it scales to any rendered width.
--   * choices hold the shuffled word chips (text only — is_correct stays
--     revoked from the API).
--   * questions.correct_answer_text (never exposed until the window closes)
--     holds the canonical solution "<chipIndex>|<chipIndex>|..." per region,
--     so the existing grade_answer trigger scores it by string equality with
--     no client-side scoring and no trigger change.

alter table public.questions
  add column if not exists regions jsonb not null default '[]'::jsonb;

-- Allow the new type.
alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions
  add constraint questions_type_check
  check (type in ('mcq', 'true_false', 'text', 'number', 'audio', 'page_words'));

-- Geometry is safe to read; the answer is not.
grant select (regions) on public.questions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dedicated writer. Kept separate from save_question so that RPC's signature
-- (and every existing caller) stays untouched.
--   p_words: ordered array of { text, region } where `region` is the index in
--            p_regions that the word belongs to.
-- The stored chip order is shuffled here, server-side, so the browser never
-- sees the identity mapping.
-- ---------------------------------------------------------------------------
create or replace function public.save_page_words_question(
  p_competition_id uuid,
  p_position integer,
  p_page_number integer,
  p_regions jsonb,
  p_words jsonb,
  p_question_id uuid default null,
  p_duration_seconds integer default 120,
  p_points integer default null,
  p_negative_points integer default null,
  p_explanation text default null,
  p_surah_number integer default null,
  p_ayah_number integer default null,
  p_juz_number integer default null,
  p_hizb_number integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qid uuid := p_question_id;
  v_word jsonb;
  v_chips jsonb;
  v_solution text;
  v_pos integer;
  v_text text;
begin
  if not exists (
    select 1 from public.competitions c
    where c.id = p_competition_id
      and c.owner_id = auth.uid()
      and c.status in ('draft', 'waiting', 'running', 'paused')
  ) then
    raise exception 'Only the quiz owner can edit questions here' using errcode = '42501';
  end if;
  if jsonb_typeof(p_regions) <> 'array' or jsonb_array_length(p_regions) = 0 then
    raise exception 'Mark at least one word box on the page' using errcode = '22023';
  end if;
  if jsonb_array_length(p_regions) > 40 then
    raise exception 'A page exercise holds at most 40 boxes' using errcode = '22023';
  end if;
  if jsonb_typeof(p_words) <> 'array'
     or jsonb_array_length(p_words) <> jsonb_array_length(p_regions) then
    raise exception 'Every box needs exactly one word' using errcode = '22023';
  end if;
  if p_page_number is null or p_page_number < 1 then
    raise exception 'Pick a page' using errcode = '22023';
  end if;

  -- Shuffle the words into chip order, then record which chip each region wants.
  select jsonb_agg(w order by ord) into v_chips
  from (
    select jsonb_build_object(
             'text', btrim(e.value ->> 'text'),
             'region', (e.value ->> 'region')::integer
           ) as w,
           random() as ord
    from jsonb_array_elements(p_words) e
    where btrim(coalesce(e.value ->> 'text', '')) <> ''
  ) s;

  if v_chips is null or jsonb_array_length(v_chips) <> jsonb_array_length(p_regions) then
    raise exception 'Every box needs exactly one word' using errcode = '22023';
  end if;

  -- solution[i] = index of the chip that belongs in region i
  select string_agg(idx::text, '|' order by region_no) into v_solution
  from (
    select (c.value ->> 'region')::integer as region_no,
           (c.ordinality - 1) as idx
    from jsonb_array_elements(v_chips) with ordinality c(value, ordinality)
  ) t;

  if v_qid is null then
    insert into public.questions (
      competition_id, position, text, type, duration_seconds, points,
      negative_points, explanation, correct_answer_text, regions,
      page_number, surah_number, ayah_number, juz_number, hizb_number
    ) values (
      p_competition_id, p_position, 'page_words', 'page_words',
      p_duration_seconds, p_points, p_negative_points, p_explanation,
      v_solution, p_regions,
      p_page_number, p_surah_number, p_ayah_number, p_juz_number, p_hizb_number
    )
    returning id into v_qid;
  else
    if exists (
      select 1 from public.questions q
      where q.id = v_qid and q.started_at is not null
    ) then
      raise exception 'A question that has already started can no longer be edited' using errcode = '42501';
    end if;
    update public.questions set
      position = p_position,
      type = 'page_words',
      text = 'page_words',
      duration_seconds = p_duration_seconds,
      points = p_points,
      negative_points = p_negative_points,
      explanation = p_explanation,
      correct_answer_text = v_solution,
      regions = p_regions,
      page_number = p_page_number,
      surah_number = p_surah_number,
      ayah_number = p_ayah_number,
      juz_number = p_juz_number,
      hizb_number = p_hizb_number
    where id = v_qid and competition_id = p_competition_id;
    if not found then
      raise exception 'Question does not belong to this quiz' using errcode = '23503';
    end if;
  end if;

  -- Chips become choices, in shuffled order; none is "the" correct one.
  delete from public.choices where question_id = v_qid;
  v_pos := 0;
  for v_word in select * from jsonb_array_elements(v_chips) loop
    v_pos := v_pos + 1;
    v_text := btrim(v_word ->> 'text');
    insert into public.choices (question_id, text, position, is_correct)
    values (v_qid, v_text, v_pos, false);
  end loop;

  return v_qid;
end;
$$;

revoke execute on function public.save_page_words_question(
  uuid, integer, integer, jsonb, jsonb, uuid, integer, integer, integer, text,
  integer, integer, integer, integer
) from public, anon;
grant execute on function public.save_page_words_question(
  uuid, integer, integer, jsonb, jsonb, uuid, integer, integer, integer, text,
  integer, integer, integer, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Editor read: carry regions + page through the whole-deck RPC.
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
        'regions', qq.regions,
        'page_number', qq.page_number,
        'surah_number', qq.surah_number,
        'ayah_number', qq.ayah_number,
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
