-- 20260116000010_match_rounds_state_version.sql
-- Add state_version and keep it monotonic for round state changes.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_rounds'
  ) then
    alter table public.match_rounds
      add column if not exists state_version int not null default 0;
  end if;
end $$;

-- Bump state_version on any match_rounds update.
create or replace function public.bump_match_rounds_state_version()
returns trigger
language plpgsql
as $$
begin
  new.state_version := coalesce(old.state_version, 0) + 1;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_rounds'
  ) then
    drop trigger if exists bump_match_rounds_state_version on public.match_rounds;
    create trigger bump_match_rounds_state_version
    before update on public.match_rounds
    for each row
    execute function public.bump_match_rounds_state_version();
  end if;
end $$;

-- When player progress changes, touch the round to bump state_version.
create or replace function public.touch_match_round_state()
returns trigger
language plpgsql
as $$
begin
  update public.match_rounds
  set updated_at = now()
  where id = coalesce(new.round_id, old.round_id);
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_round_player_progress_v1'
  ) then
    drop trigger if exists touch_match_round_state on public.match_round_player_progress_v1;
    create trigger touch_match_round_state
    after insert or update on public.match_round_player_progress_v1
    for each row
    execute function public.touch_match_round_state();
  end if;
end $$;

commit;
