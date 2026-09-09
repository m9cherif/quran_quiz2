-- Incident fix: quran.chrif.net (still deployed from the pre-open-quran-view
-- branch, claude/bird-verify-sms-otp-4tkbqm) went down immediately after the
-- previous migration renamed questions.regions -> questions.word_locations.
-- Both sites share this one Supabase project, and that branch's code still
-- selects "regions" by name in listGameQuestions/listStudentQuestions —
-- every competition on that site failed to load with a raw "column
-- \"regions\" does not exist" error the moment the rename landed.
--
-- Fix: bring the column back (empty — there was never real data in it, per
-- the previous migration's own note) so the old branch's SELECTs succeed
-- again, and put both keys in get_quiz_questions_full's JSON so its editor
-- reads whichever one it expects. quran2's code only ever touches
-- word_locations; this is purely a compatibility shim for the other branch.
--
-- Not fully restorable: save_page_words_question can't have both a
-- p_regions and a p_word_locations overload (identical jsonb-typed
-- parameter lists are the same signature to Postgres regardless of name),
-- so creating/editing a page_words question from quran.chrif.net's editor
-- still won't resolve to a function. Reading competitions, questions, and
-- playing a game — the site-wide breakage — is what this fixes.

alter table public.questions add column if not exists regions jsonb;

grant select (regions) on public.questions to anon, authenticated;

comment on column public.questions.regions is
  'Deprecated / unused: kept only so the pre-open-quran-view branch (claude/bird-verify-sms-otp-4tkbqm, still deployed to quran.chrif.net) can still SELECT it without erroring. The live page_words feature on that branch reads/writes this column but never had real data in production; word_locations is the column the current (quran2) branch actually uses.';

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
        'word_locations', qq.word_locations,
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
