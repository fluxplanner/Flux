-- Graphs saved from Flux Grapher — the standalone page or the planner's
-- Study tools. One row per graph.
--
-- Owner-only in every direction, and anon gets nothing: the grapher itself
-- needs no account, and signing in is only ever for saving. Verified on
-- 2026-09-25 with negative tests (another account cannot read, update, delete
-- or forge rows; anon is refused outright; a row cannot be handed to someone
-- else by rewriting user_id).
create table if not exists public.flux_graphs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('data', 'functions')),
  title       text not null default 'Untitled graph' check (char_length(title) between 1 and 120),
  payload     jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 262144),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists flux_graphs_user_updated_idx
  on public.flux_graphs (user_id, updated_at desc);

alter table public.flux_graphs enable row level security;

create policy flux_graphs_select_own on public.flux_graphs
  for select to authenticated using (user_id = (select auth.uid()));
create policy flux_graphs_insert_own on public.flux_graphs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy flux_graphs_update_own on public.flux_graphs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy flux_graphs_delete_own on public.flux_graphs
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.flux_graphs from anon;
revoke all on public.flux_graphs from public;
grant select, insert, update, delete on public.flux_graphs to authenticated;

-- Server-owned timestamps and a per-account cap, so a client cannot backdate
-- rows or fill the table.
create or replace function public.flux_graphs_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    if (select count(*) from public.flux_graphs g where g.user_id = new.user_id) >= 500 then
      raise exception 'You have 500 saved graphs — delete some before saving more.'
        using errcode = 'P0001';
    end if;
  else
    new.created_at := old.created_at;
    new.user_id := old.user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.flux_graphs_before_write() from public, anon, authenticated;

create trigger flux_graphs_before_write
  before insert or update on public.flux_graphs
  for each row execute function public.flux_graphs_before_write();
