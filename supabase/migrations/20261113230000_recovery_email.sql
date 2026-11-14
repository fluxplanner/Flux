-- Recovery email: an optional real address kept beside a Flux account, used for
-- one thing only — emailing that person a link to set a new password.
--
-- Sign-in is unchanged. The account key is still <name>@users.fluxplanner.app,
-- a domain that receives no mail, so the real address cannot live in auth.users
-- without changing how people sign in. It lives here instead.
--
-- Nothing in this file is reachable from the browser. Both tables have RLS on
-- and no policies, and the two functions are granted to service_role alone: the
-- account-recovery edge function is the only reader and writer. That matters
-- because a list of "which account has which email" and a table of live reset
-- tokens are exactly what someone breaking into an account would want.

create table if not exists public.flux_recovery_emails (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null check (char_length(email) between 3 and 254),
  -- Null until the person has clicked the link sent to that address. A reset
  -- link is only ever sent to a confirmed address: a typo would otherwise hand
  -- the account to whoever owns the mistyped inbox.
  verified_at timestamptz,
  updated_at  timestamptz not null default now()
);

create table if not exists public.flux_recovery_tokens (
  -- SHA-256 of the token. The token itself exists only in the emailed link, so
  -- reading this table does not let anyone reset a password.
  token_hash  text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  purpose     text not null check (purpose in ('verify', 'reset')),
  -- For 'verify': the address being confirmed, so a link sent to an old address
  -- cannot confirm a newer one.
  email       text,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists flux_recovery_tokens_user_idx on public.flux_recovery_tokens (user_id, purpose);

alter table public.flux_recovery_emails enable row level security;
alter table public.flux_recovery_tokens enable row level security;
revoke all on public.flux_recovery_emails from anon, authenticated;
revoke all on public.flux_recovery_tokens from anon, authenticated;

-- The account behind a sign-in address. auth.users is not exposed over the API,
-- and paging through every user to find one does not scale.
create or replace function public.flux_recovery_user_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where email = lower(btrim(p_email)) limit 1;
$$;

-- After a reset, every device signed in with the old password is signed out.
-- Also clears spent and expired tokens for that person.
create or replace function public.flux_recovery_end_sessions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = p_user;
  delete from public.flux_recovery_tokens
   where user_id = p_user and (used_at is not null or expires_at < now() or purpose = 'reset');
end;
$$;

revoke all on function public.flux_recovery_user_for_email(text) from public, anon, authenticated;
revoke all on function public.flux_recovery_end_sessions(uuid) from public, anon, authenticated;
grant execute on function public.flux_recovery_user_for_email(text) to service_role;
grant execute on function public.flux_recovery_end_sessions(uuid) to service_role;
