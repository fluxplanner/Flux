-- Password help requests.
--
-- Accounts sign in with a name and a password and there is no email on file,
-- so there is no "reset link" to send. Someone locked out therefore has no way
-- to reach the owner from inside the app — they cannot sign in to ask. This
-- table is that channel, and it has to be writable while signed out.
--
-- The security shape follows from that: anon may INSERT and nothing else.
-- It must never be able to SELECT, because the rows carry the usernames of
-- people who are currently locked out, which is a list worth having if you are
-- trying to get into someone's account.
--
-- Verified against production on 2026-09-14 by running each operation as the
-- anon role: INSERT allowed; SELECT, UPDATE and DELETE all
-- "permission denied for table flux_password_help"; an over-length username
-- rejected.

create table if not exists public.flux_password_help (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  username    text not null,
  note        text,
  handled     boolean not null default false,
  -- Bounded at the column so a policy change can never widen them by accident.
  constraint flux_password_help_username_len check (char_length(username) between 1 and 64),
  constraint flux_password_help_note_len     check (note is null or char_length(note) <= 500)
);

alter table public.flux_password_help enable row level security;

-- Anyone may ask for help, signed in or not. WITH CHECK repeats the length
-- bounds so an oversized body is rejected by the policy as well as the column.
drop policy if exists flux_password_help_insert on public.flux_password_help;
create policy flux_password_help_insert
  on public.flux_password_help
  for insert
  to anon, authenticated
  with check (
    char_length(username) between 1 and 64
    and (note is null or char_length(note) <= 500)
  );

-- Only the owner reads them. Pinned to the auth user id rather than an email:
-- the addresses are synthesised now and can change, the id cannot.
drop policy if exists flux_password_help_owner_read on public.flux_password_help;
create policy flux_password_help_owner_read
  on public.flux_password_help
  for select
  to authenticated
  using (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);

-- And only the owner may tick one off.
drop policy if exists flux_password_help_owner_update on public.flux_password_help;
create policy flux_password_help_owner_update
  on public.flux_password_help
  for update
  to authenticated
  using (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid)
  with check (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);

-- No DELETE policy at all: RLS denies it to everyone, owner included. Keeping
-- the trail is more useful than pruning it, and nothing in the app deletes.

revoke all on public.flux_password_help from anon, authenticated;
grant insert on public.flux_password_help to anon, authenticated;
grant select, update on public.flux_password_help to authenticated;

create index if not exists flux_password_help_open_idx
  on public.flux_password_help (created_at desc)
  where handled = false;
