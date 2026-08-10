-- Phase 6: auto-generate the join code when inserting a competition without one
create or replace function public.generate_competition_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.competitions where code = v_code) then
      return v_code;
    end if;
  end loop;
end;
$$;

create or replace function public.competition_code_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.code is null or btrim(NEW.code) = '' then
    NEW.code := public.generate_competition_code();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_competitions_auto_code on public.competitions;
create trigger trg_competitions_auto_code
  before insert or update of code on public.competitions
  for each row execute function public.competition_code_trigger();