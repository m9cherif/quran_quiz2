-- Admin account type: full control over every table, on top of the existing
-- host/student roles. Roles are still only ever set server-side (see
-- src/lib/auth/server.ts), never client-claimable, so this is not a new
-- privilege-escalation surface — just a third value the server is now
-- allowed to write.
--
-- Approach: one additive, permissive policy per table rather than rewriting
-- any existing policy. Postgres OR's every applicable RLS policy together,
-- so a row is visible/writable if EITHER the existing owner/participant
-- rule passes OR is_admin() does — nothing already granted changes.
--
-- This does not, on its own, make admins able to use the existing "my
-- quiz"/"my class" RPCs (list_my_quizzes, get_quiz_questions_full, ...) for
-- other hosts' data — those check ownership in their own SQL body,
-- independent of RLS. Admin-specific RPCs below (admin_list_*,
-- admin_set_role, admin_delete_competition) cover the moderation surface
-- directly instead of touching every existing RPC.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('host', 'student', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'competitions', 'questions', 'choices', 'participants', 'answers',
    'profiles', 'classes', 'class_members', 'series_attempts',
    'series_answers', 'admin_keys'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_admin_all', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Admin moderation RPCs. Every one starts by re-checking is_admin() itself —
-- SECURITY DEFINER functions bypass RLS entirely, so the check has to be
-- explicit here rather than relied on from the policies above.
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_profiles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'role', p.role,
      'email', u.email,
      'phone', u.phone,
      'created_at', p.created_at
    ) order by p.created_at desc)
    from public.profiles p
    join auth.users u on u.id = p.id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;

create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if p_role not in ('host', 'student', 'admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Cannot demote your own account' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'No such user' using errcode = '23503';
  end if;
end;
$$;

revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

create or replace function public.admin_list_competitions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'title', c.title,
      'status', c.status,
      'owner_id', c.owner_id,
      'owner_name', p.name,
      'created_at', c.created_at,
      'question_count', (select count(*) from public.questions q where q.competition_id = c.id),
      'participant_count', (select count(*) from public.participants pt where pt.competition_id = c.id)
    ) order by c.created_at desc)
    from public.competitions c
    left join public.profiles p on p.id = c.owner_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_list_competitions() from public, anon;
grant execute on function public.admin_list_competitions() to authenticated;

create or replace function public.admin_delete_competition(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  delete from public.competitions where id = p_id;
  if not found then
    raise exception 'No such competition' using errcode = '23503';
  end if;
end;
$$;

revoke execute on function public.admin_delete_competition(uuid) from public, anon;
grant execute on function public.admin_delete_competition(uuid) to authenticated;
