-- 20260810121400_game_question_stats.sql
-- Phase 9 · Leaderboard + results: owner-gated per-question statistics for
-- the host results view (answered/correct/accuracy). Students never see
-- other players' per-question data — the student result screen shows only
-- their own answers (already readable via the self-scoped answers policy).

create or replace function public.game_question_stats(p_competition_id uuid)
returns table (
  position_number integer,
  text text,
  duration_seconds integer,
  answered_count bigint,
  correct_count bigint,
  accuracy double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.competitions c
    where c.id = p_competition_id and c.owner_id = auth.uid()
  ) then
    raise exception 'Only the game host can view question stats' using errcode = '42501';
  end if;

  return query
    select
      q.position::integer as position_number,
      q.text,
      q.duration_seconds,
      count(a.id)::bigint as answered_count,
      count(*) filter (where a.is_correct)::bigint as correct_count,
      case
        when count(a.id) > 0
          then round(100.0 * count(*) filter (where a.is_correct) / count(a.id), 1)::double precision
        else 0::double precision
      end as accuracy
    from public.questions q
    left join public.answers a on a.question_id = q.id
    where q.competition_id = p_competition_id
    group by q.id, q.position, q.text, q.duration_seconds
    order by q.position;
end;
$$;

revoke execute on function public.game_question_stats(uuid) from public, anon;
grant execute on function public.game_question_stats(uuid) to authenticated;