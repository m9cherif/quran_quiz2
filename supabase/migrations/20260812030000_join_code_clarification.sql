-- Distinguish join failures so the UI can explain them:
--   P0003 — the code matches a quiz that has not been launched (draft)
--   P0004 — the code belongs to a class, not to a live game
-- Keep the original 28000 for everything else that is closed.

create or replace function public.join_competition(
  p_code text,
  p_display_name text,
  p_profile_id uuid default null
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comp public.competitions;
  v_participant public.participants;
  v_uid uuid := (select auth.uid());
  v_display text := btrim(p_display_name);
  v_lookup text := upper(btrim(p_code));
begin
  if p_profile_id is not null and (v_uid is null or p_profile_id <> v_uid) then
    raise exception 'Profile link does not match the current session' using errcode = '42501';
  end if;

  select * into v_comp
  from public.competitions
  where upper(code) = v_lookup
  limit 1;

  if v_comp.id is not null and v_comp.status = 'draft' then
    raise exception 'This quiz has not been launched yet' using errcode = 'P0003';
  end if;
  if v_comp.id is null and exists (
    select 1 from public.classes where upper(code) = v_lookup
  ) then
    raise exception 'That code is a class code, not a game code' using errcode = 'P0004';
  end if;
  if v_comp.id is null or v_comp.status <> 'waiting' then
    raise exception 'This game is not open to join' using errcode = '28000';
  end if;

  if char_length(v_display) < 2 or char_length(v_display) > 50 then
    raise exception 'Display name must be between 2 and 50 characters' using errcode = '22023';
  end if;

  begin
    insert into public.participants (competition_id, display_name, participant_code, access_token, profile_id)
    values (v_comp.id, v_display, gen_random_uuid()::text, gen_random_uuid()::text, p_profile_id)
    returning * into v_participant;
  exception when unique_violation then
    raise exception 'That display name is already taken in this game' using errcode = '23505';
  end;

  return v_participant;
end;
$$;