-- Sign-in codes for the plain-SMS provider.
--
-- Bird Verify and Telegram Gateway both make the code, count the attempts and
-- judge the digits, so nothing about them lands here. An Android phone acting
-- as an SMS gateway does none of that — it only carries text — so when that is
-- the sender, this app owns the code and needs somewhere to keep it.
--
-- Still exactly one code. What the original design forbade was two competing
-- ones (Supabase's and a provider's, neither aware of the other); here there is
-- a single code with a single owner.
--
-- WHAT IS STORED. Never the code: only a SHA-256 of it with a random per-row
-- salt, so a leak of this table does not hand out working codes. A six-digit
-- code is small enough to brute force offline against any fast hash, which is
-- why the real protection is the attempt ceiling and the ten-minute window
-- rather than the hash itself — both enforced server-side, on every check.
--
-- One row per number. Asking again overwrites, so a person can only ever have
-- one code outstanding and an old one stops working the moment a new one is
-- sent.
--
-- ACCESS. RLS is on with no policies at all, which denies anon and
-- authenticated everything. Only the service role — which never leaves the
-- server — touches this table. A client that could read it could sign in as
-- anyone; a client that could write it could mint its own code.

create table if not exists public.phone_verifications (
  phone text primary key,
  code_hash text not null,
  salt text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.phone_verifications enable row level security;

revoke all on table public.phone_verifications from anon, authenticated;
grant all on table public.phone_verifications to service_role;

-- Codes are worthless once expired, and keeping them is a liability rather
-- than a record. Anything past its window is fair game for deletion.
create index if not exists phone_verifications_expires_at_idx
  on public.phone_verifications (expires_at);

comment on table public.phone_verifications is
  'Service-role only. Hashed sign-in codes for the plain-SMS gateway provider, which cannot verify codes itself. RLS on with no policies: clients have no access.';
