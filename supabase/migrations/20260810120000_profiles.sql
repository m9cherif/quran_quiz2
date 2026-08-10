-- 20260810120000_profiles.sql
-- Phase 4 · Supabase foundations #1: profiles table, auto-create trigger, RLS.
-- Role comes from app_metadata (server-set only; NEVER from raw_user_meta_data,
-- which is user-editable). Default role: student.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 50),
  role text not null default 'student' check (role in ('host', 'student')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Generic updated_at maintenance (also used by competitions).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create the profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'student');
  v_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Player'
  );
begin
  if v_role not in ('host', 'student') then
    v_role := 'student';
  end if;
  insert into public.profiles (id, name, role)
  values (new.id, left(v_name, 50), v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the system trigger needs to run it; no client should call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;

-- Self: read + update own profile. Role is immutable (compare against stored value).
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- No insert/delete policies: creation is trigger-only, deletion is admin-only.