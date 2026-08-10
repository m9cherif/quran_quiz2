-- Phase 6: quiz management support
-- 1) FK cascades so deleting a quiz removes its children in one REST call
alter table public.questions drop constraint questions_competition_id_fkey;
alter table public.questions add constraint questions_competition_id_fkey
  foreign key (competition_id) references public.competitions (id) on delete cascade;

alter table public.choices drop constraint choices_question_id_fkey;
alter table public.choices add constraint choices_question_id_fkey
  foreign key (question_id) references public.questions (id) on delete cascade;

alter table public.participants drop constraint participants_competition_id_fkey;
alter table public.participants add constraint participants_competition_id_fkey
  foreign key (competition_id) references public.competitions (id) on delete cascade;

alter table public.answers drop constraint answers_competition_id_fkey;
alter table public.answers add constraint answers_competition_id_fkey
  foreign key (competition_id) references public.competitions (id) on delete cascade;

alter table public.answers drop constraint answers_question_id_fkey;
alter table public.answers add constraint answers_question_id_fkey
  foreign key (question_id) references public.questions (id) on delete cascade;

alter table public.answers drop constraint answers_participant_id_fkey;
alter table public.answers add constraint answers_participant_id_fkey
  foreign key (participant_id) references public.participants (id) on delete cascade;

alter table public.answers drop constraint answers_choice_id_fkey;
alter table public.answers add constraint answers_choice_id_fkey
  foreign key (choice_id) references public.choices (id) on delete set null;

-- 2) Atomic question save (question + choices in one transaction). Owner only.
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
begin
  if not exists (
    select 1 from public.competitions c
    where c.id = p_competition_id and c.owner_id = auth.uid()
  ) then
    raise exception 'Only the quiz owner can edit questions' using errcode = '42501';
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
    insert into public.choices (question_id, text, position, is_correct)
    values (
      v_qid,
      btrim(v_choice ->> 'text'),
      (v_choice ->> 'position')::integer,
      coalesce((v_choice ->> 'is_correct')::boolean, false)
    );
  end loop;

  return v_qid;
end;
$$;

revoke execute on function public.save_question(
  uuid, integer, text, uuid, text, integer, integer, integer, text, text,
  integer, integer, integer, integer, integer, jsonb
) from public, anon;

-- 3) Full question fetch for the (owner) editor: column grants hide
-- correct_answer_text/is_correct from REST, so the editor reads via RPC.
create or replace function public.get_question_full(p_question_id uuid)
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
  if v_c.owner_id <> auth.uid() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', v_q.id,
    'competition_id', v_q.competition_id,
    'position', v_q.position,
    'text', v_q.text,
    'type', v_q.type,
    'duration_seconds', v_q.duration_seconds,
    'points', v_q.points,
    'negative_points', v_q.negative_points,
    'explanation', v_q.explanation,
    'correct_answer_text', v_q.correct_answer_text,
    'surah_number', v_q.surah_number,
    'ayah_number', v_q.ayah_number,
    'page_number', v_q.page_number,
    'juz_number', v_q.juz_number,
    'hizb_number', v_q.hizb_number,
    'choices', (
      select jsonb_agg(
        jsonb_build_object('id', c.id, 'text', c.text, 'position', c.position, 'is_correct', c.is_correct)
        order by c.position
      ) from public.choices c where c.question_id = v_q.id
    )
  ) into v_rows;

  return v_rows;
end;
$$;

revoke execute on function public.get_question_full(uuid) from public, anon;