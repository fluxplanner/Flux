-- Global, owner-controlled UI configuration.
--
-- Everything else in this schema is scoped to a user, a class or a school, so
-- there was no way for the owner to change what *every* planner shows. This is
-- that: one small, publicly-readable table holding presentation config only.
--
-- Deliberately not sensitive. It must be readable before anyone signs in
-- (the sidebar renders on the login/guest path too), so anon can read it.
-- Never put anything private here.

create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

comment on table public.platform_settings is
  'Global owner-controlled UI config (e.g. hidden sidebar tabs). Publicly readable; writes only via the release-admin Edge Function using the service role.';

alter table public.platform_settings enable row level security;

-- Read: everyone, signed in or not.
drop policy if exists "platform_settings_read" on public.platform_settings;
create policy "platform_settings_read" on public.platform_settings
  for select
  to anon, authenticated
  using (true);

-- Write: intentionally no policy. RLS denies inserts/updates/deletes to anon
-- and authenticated, so the only writer is the service role, used by the
-- release-admin Edge Function after it verifies the caller is FLUX_OWNER_EMAIL.
-- Encoding the owner's identity in a policy here would duplicate that check in
-- a second place and let the two drift apart.

insert into public.platform_settings (key, value)
values ('ui', jsonb_build_object('hiddenTabs', '[]'::jsonb))
on conflict (key) do nothing;
