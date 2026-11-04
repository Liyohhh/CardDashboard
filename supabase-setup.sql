-- Card War: database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It only creates new tables (players, games, matches, activity_log, app_owner); it doesn't touch anything else.
-- Access: anyone who opens the site can view and edit the scores.
--         Only the owner (you, signed in) can read the change log.
-- Safe to run again.

create table if not exists public.players (
  id         text primary key,
  name       text not null check (char_length(name) between 1 and 24),
  color      text not null default '#1f9bff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  face       text not null default 'smile' check (face in ('smile','happy','wink','cool','sleepy','none')),
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id         text primary key,
  name       text not null check (char_length(name) between 1 and 24),
  icon       text not null default 'card-wild' check (char_length(icon) <= 40),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id         text primary key,
  game_id    text not null references public.games(id) on delete cascade,
  date       date not null,
  players    text[] not null check (cardinality(players) between 2 and 30),
  winner_id  text not null,
  created_at timestamptz not null default now(),
  constraint winner_played check (winner_id = any(players))
);

create index if not exists matches_date_idx on public.matches (date);
create index if not exists matches_game_idx on public.matches (game_id);

-- Row Level Security: on, with open policies (anyone can read and write).
alter table public.players enable row level security;
alter table public.games   enable row level security;
alter table public.matches enable row level security;

do $$
declare t text;
begin
  foreach t in array array['players','games','matches'] loop
    execute format('drop policy if exists "open read" on public.%I', t);
    execute format('drop policy if exists "open insert" on public.%I', t);
    execute format('drop policy if exists "open update" on public.%I', t);
    execute format('drop policy if exists "open delete" on public.%I', t);
    execute format('create policy "open read"   on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "open insert" on public.%I for insert to anon, authenticated with check (true)', t);
    execute format('create policy "open update" on public.%I for update to anon, authenticated using (true) with check (true)', t);
    execute format('create policy "open delete" on public.%I for delete to anon, authenticated using (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.players, public.games, public.matches to anon, authenticated;

-- Live updates: when a friend records a match, everyone's screen refreshes.
do $$
declare t text;
begin
  foreach t in array array['players','games','matches'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============ Change log (owner only) ============
create table if not exists public.activity_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  editor     text not null default 'Someone',
  action     text not null,          -- insert | update | delete
  table_name text not null,
  row_id     text,
  old_data   jsonb,
  new_data   jsonb
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);

-- Who counts as "owner": rows here are Supabase Auth user ids. Not readable through the API.
create table if not exists public.app_owner (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_owner enable row level security;
revoke all on public.app_owner from anon, authenticated;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owner where user_id = auth.uid());
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

alter table public.activity_log enable row level security;
drop policy if exists "owner reads log" on public.activity_log;
create policy "owner reads log" on public.activity_log for select to authenticated using (public.is_owner());
revoke all on public.activity_log from anon;
grant select on public.activity_log to authenticated;

-- Writes a log row for every insert/update/delete. The editor name comes from the
-- site (each person types their name once).
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hdr json;
  who text;
  o jsonb;
  n jsonb;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and o = n then return null; end if;
  begin
    hdr := nullif(current_setting('request.headers', true), '')::json;
  exception when others then hdr := null;
  end;
  who := left(coalesce(nullif(hdr->>'x-editor', ''), 'Someone'), 120);
  insert into public.activity_log (editor, action, table_name, row_id, old_data, new_data)
  values (who, lower(tg_op), tg_table_name, coalesce(n->>'id', o->>'id'), o, n);
  return null;
end $$;
revoke execute on function public.log_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['players','games','matches'] loop
    execute format('drop trigger if exists log_changes on public.%I', t);
    execute format('create trigger log_changes after insert or update or delete on public.%I for each row execute function public.log_change()', t);
  end loop;
end $$;

-- ============ Daily backup (last 30 days, readable by the owner only) ============
create extension if not exists pg_cron;
create table if not exists public.backups (
  id       bigserial primary key,
  taken_at timestamptz not null default now(),
  data     jsonb not null
);
alter table public.backups enable row level security;
revoke all on public.backups from anon;
grant select on public.backups to authenticated;
drop policy if exists "owner reads backups" on public.backups;
create policy "owner reads backups" on public.backups for select to authenticated using (public.is_owner());

create or replace function public.take_backup() returns void
language sql security definer set search_path = public as $$
  insert into public.backups (data)
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(to_jsonb(p)) from public.players p), '[]'::jsonb),
    'games',   coalesce((select jsonb_agg(to_jsonb(g)) from public.games g), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(to_jsonb(m)) from public.matches m), '[]'::jsonb));
  delete from public.backups where taken_at < now() - interval '30 days';
$$;
revoke execute on function public.take_backup() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'card-night-daily-backup';
select cron.schedule('card-night-daily-backup', '17 3 * * *', 'select public.take_backup()');

-- ============ LAST STEP: make yourself the owner ============
-- 1. Supabase → Authentication → Users → "Add user" → create a user with your email + a password.
-- 2. Put that email below and run just these lines:
--
-- insert into public.app_owner (user_id)
-- select id from auth.users where email = 'YOUR-EMAIL@example.com'
-- on conflict do nothing;
