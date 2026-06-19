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
