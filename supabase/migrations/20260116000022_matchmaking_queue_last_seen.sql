-- 20260116000022_matchmaking_queue_last_seen.sql
-- Add last_seen_at to matchmaking_queue for stale entry cleanup.

begin;

alter table public.matchmaking_queue
  add column if not exists last_seen_at timestamptz not null default now();

update public.matchmaking_queue
set last_seen_at = now()
where last_seen_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matchmaking_queue'
      and column_name = 'subject'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matchmaking_queue'
      and column_name = 'level'
  ) then
    execute 'create index if not exists idx_matchmaking_queue_activity on public.matchmaking_queue(status, subject, level, last_seen_at, created_at)';
  else
    execute 'create index if not exists idx_matchmaking_queue_activity on public.matchmaking_queue(status, last_seen_at, created_at)';
  end if;
end $$;

commit;
