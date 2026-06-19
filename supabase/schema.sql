create extension if not exists pgcrypto;

create table if not exists public.prompt_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id text not null default 'default',
  source text not null check (source in ('claude', 'codex', 'manual', 'test')),
  prompt text not null,
  user_name text not null default 'unknown',
  avatar_url text,
  machine_id text not null default 'unknown',
  cwd text,
  model text,
  token_count integer,
  session_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists prompt_events_team_created_at_idx
  on public.prompt_events (team_id, created_at desc);

alter table public.prompt_events enable row level security;

drop policy if exists "prompt_events_select_by_anon" on public.prompt_events;
create policy "prompt_events_select_by_anon"
  on public.prompt_events for select
  to anon
  using (true);

drop policy if exists "prompt_events_insert_by_anon" on public.prompt_events;
create policy "prompt_events_insert_by_anon"
  on public.prompt_events for insert
  to anon
  with check (true);

alter publication supabase_realtime add table public.prompt_events;

-- Heartbeats: one row per user per day, tracks active CLI seconds
create table if not exists public.heartbeats (
  id uuid primary key default gen_random_uuid(),
  team_id text not null default 'default',
  user_name text not null default 'unknown',
  date date not null default current_date,
  seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint heartbeats_team_user_date_key unique (team_id, user_name, date)
);

create index if not exists heartbeats_team_date_idx
  on public.heartbeats (team_id, date desc);

alter table public.heartbeats enable row level security;

drop policy if exists "heartbeats_select_by_anon" on public.heartbeats;
create policy "heartbeats_select_by_anon"
  on public.heartbeats for select
  to anon
  using (true);

drop policy if exists "heartbeats_insert_by_anon" on public.heartbeats;
create policy "heartbeats_insert_by_anon"
  on public.heartbeats for insert
  to anon
  with check (true);

drop policy if exists "heartbeats_update_by_anon" on public.heartbeats;
create policy "heartbeats_update_by_anon"
  on public.heartbeats for update
  to anon
  using (true);

create or replace function public.upsert_heartbeat(
  p_team_id text,
  p_user_name text,
  p_date date,
  p_seconds integer
) returns void as $$
begin
  insert into public.heartbeats (team_id, user_name, date, seconds, updated_at)
  values (p_team_id, p_user_name, p_date, p_seconds, now())
  on conflict (team_id, user_name, date)
  do update set seconds = heartbeats.seconds + p_seconds, updated_at = now();
end;
$$ language plpgsql security definer;
