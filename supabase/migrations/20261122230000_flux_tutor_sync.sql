-- Flux Tutor across devices: one row per study set, plus one 'profile' row
-- (subjects, XP, streak), per account. Written by flux-tutor-cloud.js.
--
-- Owner-only in every direction, and anon gets nothing: Flux Tutor works
-- signed out, and signing in is only for Flux AI and keeping sets on every
-- device. Same shape and rules as flux_graphs.
create table if not exists public.flux_tutor_sync (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id     text not null check (item_id ~ '^[A-Za-z0-9_.:#-]{1,120}$'),
  kind        text not null check (kind in ('set', 'profile')),
  data        jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 2097152),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists flux_tutor_sync_user_updated_idx
  on public.flux_tutor_sync (user_id, updated_at);

alter table public.flux_tutor_sync enable row level security;

create policy flux_tutor_sync_select_own on public.flux_tutor_sync
  for select to authenticated using (user_id = (select auth.uid()));
create policy flux_tutor_sync_insert_own on public.flux_tutor_sync
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy flux_tutor_sync_update_own on public.flux_tutor_sync
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy flux_tutor_sync_delete_own on public.flux_tutor_sync
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.flux_tutor_sync from anon;
revoke all on public.flux_tutor_sync from public;
grant select, insert, update, delete on public.flux_tutor_sync to authenticated;

-- Server-owned timestamps and a per-account cap, so a client cannot backdate
-- rows, hand a row to someone else, or fill the table.
create or replace function public.flux_tutor_sync_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    if (select count(*) from public.flux_tutor_sync t where t.user_id = new.user_id) >= 400 then
      raise exception 'You have 400 study sets saved to your account. Delete some before saving more.'
        using errcode = 'P0001';
    end if;
  else
    new.created_at := old.created_at;
    new.user_id := old.user_id;
    new.item_id := old.item_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flux_tutor_sync_before_write on public.flux_tutor_sync;
create trigger flux_tutor_sync_before_write
  before insert or update on public.flux_tutor_sync
  for each row execute function public.flux_tutor_sync_before_write();

revoke all on function public.flux_tutor_sync_before_write() from public;
