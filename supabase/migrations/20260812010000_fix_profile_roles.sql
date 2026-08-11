-- 20260812010000_fix_profile_roles.sql
-- One-time repair: existing accounts created before the metadata race fix may
-- carry role 'student' in profiles (or lack a profile row entirely) even when
-- auth users.raw_app_meta_data says 'host'. app_metadata is server-set and not
-- user-editable, so it is the source of truth for role.
-- Safe to re-run: only touches rows whose stored role differs.

-- Backfill missing profile rows (users without a trigger-created profile).
insert into public.profiles (id, name, role)
select
  u.id,
  left(
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Player'
    ),
    50
  ),
  case
    when u.raw_app_meta_data ->> 'role' in ('host', 'student')
      then u.raw_app_meta_data ->> 'role'
    else 'student'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Fix role mismatches (profiles.role <-> app_metadata.role).
update public.profiles p
set role = u.raw_app_meta_data ->> 'role',
    updated_at = now()
from auth.users u
where u.id = p.id
  and u.raw_app_meta_data ->> 'role' in ('host', 'student')
  and p.role is distinct from u.raw_app_meta_data ->> 'role';