-- 20260810120700_fix_grade_answer_round.sql
-- Phase 4 · Bug fix discovered during the anon smoke test: round(double
-- precision, int) does not exist in Postgres (42883). Bonus rounding now goes
-- through numeric. Verified end-to-end via PostgREST:
--   correct @1200ms -> points 10, bonus 9.2 ; wrong -> -2 ; late -> 0.

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
        (v_points * (1 - new.response_time_ms::double precision / v_duration_ms))::numeric,
        1
      )::double precision;
    end if;
  else
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