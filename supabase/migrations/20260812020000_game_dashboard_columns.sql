-- Game dashboard columns: per-game display title, optional instructions
-- shown to students, and the per-question time limit in minutes.
-- begin_question now caps each question's window at minutes_per_question.

alter table public.competitions
  add column if not exists title text,
  add column if not exists instructions text,
  add column if not exists minutes_per_question integer not null default 1;

alter table public.competitions
  drop constraint if exists competitions_minutes_per_question_check;

alter table public.competitions
  add constraint competitions_minutes_per_question_check
  check (minutes_per_question between 1 and 60);

update public.competitions
set title = name
where title is null;

alter table public.competitions
  alter column title set not null;

-- Default the title to the quiz name on every insert (createQuiz omits it).
create or replace function public.competitions_default_title()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.title is null or new.title = '' then
    new.title := new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists competitions_default_title_trg on public.competitions;

create trigger competitions_default_title_trg
before insert on public.competitions
for each row execute function public.competitions_default_title();

-- Question window respects the host-set game limit: a question's own duration
-- is capped at minutes_per_question * 60 seconds when the round begins.
create or replace function public.begin_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.questions;
  v_comp public.competitions;
  v_window_seconds int;
begin
  select * into v_q from public.questions where id = p_question_id;
  if v_q.id is null then
    raise exception 'Question not found' using errcode = 'P0002';
  end if;
  select * into v_comp from public.competitions where id = v_q.competition_id;
  if v_comp.owner_id <> auth.uid() then
    raise exception 'Only the game host can run questions' using errcode = '42501';
  end if;
  if v_comp.status not in ('waiting', 'running', 'paused') then
    raise exception 'Game is not active' using errcode = '28000';
  end if;
  if v_q.started_at is not null then
    raise exception 'Question already started' using errcode = '22023';
  end if;

  v_window_seconds := least(
    v_q.duration_seconds,
    greatest(coalesce(v_comp.minutes_per_question, 1), 1) * 60
  );

  update public.questions
  set started_at = now(),
      ends_at = now() + (v_window_seconds * interval '1 second')
  where id = p_question_id;
end;
$$;

-- Duplicated quizzes carry the game dashboard settings along.
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
    speed_bonus_enabled, owner_id, visibility, cover_url, language, category, difficulty,
    title, instructions, minutes_per_question
  ) values (
    v_src.name || ' (copy)', v_src.description, 'draft', v_src.default_points,
    v_src.default_negative_points, v_src.speed_bonus_enabled, v_src.owner_id,
    v_src.visibility, v_src.cover_url, v_src.language, v_src.category, v_src.difficulty,
    v_src.title, v_src.instructions, v_src.minutes_per_question
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