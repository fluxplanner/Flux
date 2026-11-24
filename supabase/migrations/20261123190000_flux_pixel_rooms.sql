-- Flux Pixel live rooms.
--
-- A shared drawing lives here so a share link still opens when nobody else
-- is online. Flux Pixel needs no account, so the link itself is the key:
-- the room id is 22+ random characters, and the table is reachable only
-- through the two functions below, which take an exact id. Nobody can list
-- rooms, and the anon role has no direct access to the table.
--
-- Live edits travel over Realtime broadcast (topic pixel:<id>); this row is
-- the copy a newcomer starts from.

create table if not exists public.flux_pixel_rooms (
  id          text primary key check (id ~ '^[A-Za-z0-9]{22,40}$'),
  doc         jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists flux_pixel_rooms_updated_idx on public.flux_pixel_rooms (updated_at);

alter table public.flux_pixel_rooms enable row level security;
revoke all on public.flux_pixel_rooms from anon, authenticated;

create or replace function public.pixel_room_get(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select doc from public.flux_pixel_rooms where id = p_id;
$$;

create or replace function public.pixel_room_put(p_id text, p_doc jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id !~ '^[A-Za-z0-9]{22,40}$' then
    raise exception 'bad room id' using errcode = '22023';
  end if;
  if jsonb_typeof(p_doc) <> 'object' or jsonb_typeof(p_doc -> 'items') <> 'array' then
    raise exception 'bad drawing' using errcode = '22023';
  end if;
  -- Pictures are scaled down before they go on the page; 5 MB is far more
  -- than a busy drawing needs and keeps one room from eating the database.
  if octet_length(p_doc::text) > 5 * 1024 * 1024 then
    raise exception 'drawing too large' using errcode = '54000';
  end if;

  insert into public.flux_pixel_rooms as r (id, doc)
  values (p_id, p_doc)
  on conflict (id) do update set doc = excluded.doc, updated_at = now();

  -- No pg_cron here: forgotten rooms are swept by whoever saves next.
  delete from public.flux_pixel_rooms
  where updated_at < now() - interval '180 days';
end;
$$;

revoke all on function public.pixel_room_get(text) from public;
revoke all on function public.pixel_room_put(text, jsonb) from public;
grant execute on function public.pixel_room_get(text) to anon, authenticated;
grant execute on function public.pixel_room_put(text, jsonb) to anon, authenticated;
