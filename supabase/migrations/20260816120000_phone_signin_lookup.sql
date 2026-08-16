-- Phone sign-in: resolve a number to the account that owns it.
--
-- Bird Verify proves that whoever typed the code holds the SIM. Turning that
-- into a Supabase session needs the user id behind the number, and the admin
-- API has no way to ask: listUsers() pages through every user and filters on
-- nothing, so finding one number would mean reading the whole table.
-- auth.users.phone is already unique and indexed; this asks it directly.
--
-- Supabase stores the number without its plus ("21612345678"), while every
-- other part of the flow uses E.164 ("+21612345678"). The function accepts
-- either so no caller has to remember which side it is on.
--
-- SECURITY. A phone -> user id map is an enumeration oracle: called freely it
-- would answer "does this number have an account?" for every number in
-- Tunisia. Execution is therefore revoked from PUBLIC (which is where a
-- function's default grant comes from) and given only to service_role, the key
-- that never leaves the server. anon and authenticated are revoked explicitly
-- as well — belt and braces, and it documents the intent at the grant.

create or replace function public.auth_user_id_for_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where u.phone = replace(p_phone, '+', '')
    and u.deleted_at is null
  limit 1;
$$;

revoke all on function public.auth_user_id_for_phone(text) from public;
revoke all on function public.auth_user_id_for_phone(text) from anon;
revoke all on function public.auth_user_id_for_phone(text) from authenticated;
grant execute on function public.auth_user_id_for_phone(text) to service_role;

comment on function public.auth_user_id_for_phone(text) is
  'Service-role only. Resolves an E.164 or plus-less phone number to its auth.users id, for the Bird Verify sign-in route.';
