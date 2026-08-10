-- Phase 11: Classes
--   * classes — host-owned groups with shareable join codes (mirrors the
--     competition code pattern; only owners create/archive).
--   * class_members — signed-in students join by code (definer RPC only);
--     composite PK makes join idempotent.
--   * competitions.class_id — attach a quiz to a class; the update policy is
--     extended so a competition can only be attached to the owner's own class.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text check (description is null or char_length(description) <= 300),
  code text not null unique,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create or replace function public.generate_class_code()
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
    if not exists (select 1 from public.classes where code = v_code) then
      return v_code;
    end if;
  end loop;
end;
$$;

create or replace function public.class_code_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.code is null or btrim(NEW.code) = '' then
    NEW.code := public.generate_class_code();
  end if;
  return NEW;
end;
$$;

create trigger trg_classes_auto_code
  before insert or update of code on public.classes
  for each row execute function public.class_code_trigger();

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, profile_id)
);

alter table public.competitions
  add column class_id uuid references public.classes(id) on delete set null;

create index competitions_class_id_idx on public.competitions (class_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.classes enable row level security;
alter table public.class_members enable row level security;

-- Security definer membership check: bypasses RLS on class_members so the
-- classes → class_members → classes policy cycle terminates.
create or replace function public.is_class_member(p_class_id uuid, p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = p_class_id and m.profile_id = p_profile_id
  );
$$;

drop policy if exists "classes_select_owner_or_member" on public.classes;
create policy "classes_select_owner_or_member" on public.classes
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_class_member(id, (select auth.uid()))
  );

drop policy if exists "classes_insert_owner" on public.classes;
create policy "classes_insert_owner" on public.classes
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "classes_update_owner" on public.classes;
create policy "classes_update_owner" on public.classes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "classes_delete_owner" on public.classes;
create policy "classes_delete_owner" on public.classes
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "class_members_select_owner_or_member" on public.class_members;
create policy "class_members_select_owner_or_member" on public.class_members
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.classes c
      where c.id = class_id and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "class_members_delete_owner_or_self" on public.class_members;
create policy "class_members_delete_owner_or_self" on public.class_members
  for delete to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.classes c
      where c.id = class_id and c.owner_id = (select auth.uid())
    )
  );

-- A competition can only be attached to a class the owner actually owns.
drop policy if exists "competitions_update_owner" on public.competitions;
create policy "competitions_update_owner" on public.competitions
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      class_id is null
      or exists (
        select 1 from public.classes c
        where c.id = class_id and c.owner_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- RPCs (all security definer; guards inside)
-- ---------------------------------------------------------------------------

create or replace function public.create_class(p_name text, p_description text default null)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 60 then
    raise exception 'Class name must be between 2 and 60 characters' using errcode = '22023';
  end if;

  insert into public.classes (owner_id, name, description)
  values (v_uid, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''))
  returning * into v_class;

  return v_class;
end;
$$;

create or replace function public.list_my_classes()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  created_at timestamptz,
  archived_at timestamptz,
  member_count bigint,
  game_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.code,
    c.name,
    c.description,
    c.created_at,
    c.archived_at,
    (select count(*) from public.class_members m where m.class_id = c.id) as member_count,
    (select count(*) from public.competitions g where g.class_id = c.id) as game_count
  from public.classes c
  where c.owner_id = (select auth.uid())
  order by c.created_at desc;
end;
$$;

create or replace function public.archive_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.classes
  set archived_at = now()
  where id = p_class_id and owner_id = (select auth.uid());
  if not found then
    raise exception 'Class not found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.join_class(p_code text)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_class
  from public.classes
  where upper(code) = upper(btrim(p_code))
  limit 1;

  if v_class.id is null or v_class.archived_at is not null then
    raise exception 'Class not found or no longer open' using errcode = '28000';
  end if;

  insert into public.class_members (class_id, profile_id)
  values (v_class.id, v_uid)
  on conflict (class_id, profile_id) do nothing;

  return v_class;
end;
$$;

create or replace function public.leave_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.class_members
  where class_id = p_class_id and profile_id = (select auth.uid());
end;
$$;

create or replace function public.remove_class_member(p_class_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.class_members
  where class_id = p_class_id and profile_id = p_profile_id
    and exists (
      select 1 from public.classes c
      where c.id = p_class_id and c.owner_id = (select auth.uid())
    );
  if not found then
    raise exception 'Class not found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.my_classes()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  member_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.code,
    c.name,
    c.description,
    (select count(*) from public.class_members m where m.class_id = c.id) as member_count
  from public.class_members me
  join public.classes c on c.id = me.class_id
  where me.profile_id = (select auth.uid()) and c.archived_at is null
  order by me.joined_at desc;
end;
$$;

create or replace function public.list_class_members(p_class_id uuid)
returns table (profile_id uuid, name text, joined_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and (
        c.owner_id = (select auth.uid())
        or exists (
          select 1 from public.class_members m
          where m.class_id = p_class_id and m.profile_id = (select auth.uid())
        )
      )
  ) then
    raise exception 'Class not found' using errcode = '42501';
  end if;

  return query
  select m.profile_id, p.name, m.joined_at
  from public.class_members m
  join public.profiles p on p.id = m.profile_id
  where m.class_id = p_class_id
  order by m.joined_at asc;
end;
$$;

revoke execute on function
  public.create_class(text, text),
  public.list_my_classes(),
  public.archive_class(uuid),
  public.join_class(text),
  public.leave_class(uuid),
  public.remove_class_member(uuid, uuid),
  public.my_classes(),
  public.list_class_members(uuid),
  public.is_class_member(uuid, uuid)
from public, anon;

grant execute on function
  public.create_class(text, text),
  public.list_my_classes(),
  public.archive_class(uuid),
  public.join_class(text),
  public.leave_class(uuid),
  public.remove_class_member(uuid, uuid),
  public.my_classes(),
  public.list_class_members(uuid),
  public.is_class_member(uuid, uuid)
to authenticated;