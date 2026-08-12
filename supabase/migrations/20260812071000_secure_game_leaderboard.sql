-- Security fix: game_leaderboard was granted to `anon` and carried no guard of
-- its own, so anyone who knew (or guessed) a competition id could read every
-- player's display name and score through /rest/v1/rpc/game_leaderboard —
-- the only client-facing RPC without an owner/participant check.
--
-- Callers must now be either the competition owner (auth.uid()) or a
-- participant of that game (X-Participant-Token header).
--
-- APPLY ORDER: deploy the frontend first. Students read the leaderboard on the
-- result screen; the new build sends the participant token on that call, the
-- old one does not.

create or replace function public.game_leaderboard(p_competition_id uuid)
returns table (
  rank bigint,
  participant_id uuid,
  display_name text,
  correct_count bigint,
  answered_count bigint,
  total_points double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    exists (
      select 1 from public.competitions c
      where c.id = p_competition_id and c.owner_id = (select auth.uid())
    )
    or public.participant_from_header(p_competition_id) is not null
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    row_number() over (
      order by
        coalesce(sum(a.points + a.bonus_points), 0) desc,
        count(*) filter (where a.is_correct) desc,
        pri.display_name asc
    )::bigint,
    pri.id,
    pri.display_name,
    count(*) filter (where a.is_correct)::bigint,
    count(a.id)::bigint,
    coalesce(sum(a.points + a.bonus_points), 0)
  from public.participants pri
  left join public.answers a on a.participant_id = pri.id
  where pri.competition_id = p_competition_id
  group by pri.id, pri.display_name
  order by
    coalesce(sum(a.points + a.bonus_points), 0) desc,
    count(*) filter (where a.is_correct) desc,
    pri.display_name asc;
end;
$$;

revoke execute on function public.game_leaderboard(uuid) from public;
grant execute on function public.game_leaderboard(uuid) to anon, authenticated;
