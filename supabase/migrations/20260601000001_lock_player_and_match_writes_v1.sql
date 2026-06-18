-- 20260601000001_lock_player_and_match_writes_v1.sql
-- Security hardening, phase 1 (continued):
--   * players: clients may still update their own profile row, but mmr and
--     rank_points become server-managed (SECURITY DEFINER RPCs / service_role only).
--   * matches: drop all participant UPDATE policies; match state changes flow
--     exclusively through game-ws (service_role) and SECURITY DEFINER RPCs.

begin;

-- ----------------------------------------------------------------------------
-- players: protect rank columns with a trigger.
-- SECURITY DEFINER RPCs run as the function owner (postgres) and service_role
-- writes run as service_role, so both bypass the guard; direct client updates
-- run as 'authenticated'/'anon' and get rejected when touching rank columns.
-- ----------------------------------------------------------------------------
create or replace function public.protect_player_rank_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.mmr is distinct from old.mmr
     or new.rank_points is distinct from old.rank_points then
    raise exception 'players.mmr and players.rank_points are server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_player_rank_columns_trigger on public.players;
create trigger protect_player_rank_columns_trigger
  before update on public.players
  for each row
  execute function public.protect_player_rank_columns();

-- ----------------------------------------------------------------------------
-- matches: remove participant UPDATE capability entirely.
-- ----------------------------------------------------------------------------
drop policy if exists "Players can update their own matches" on public.matches;
drop policy if exists "matches_update_own" on public.matches;

commit;
