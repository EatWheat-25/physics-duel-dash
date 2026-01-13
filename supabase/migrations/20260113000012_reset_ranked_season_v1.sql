-- 20260113000012_reset_ranked_season_v1.sql
-- One-time (or admin-only) season reset: wipe match history and reset rank points.

begin;

create or replace function public.reset_ranked_season_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players_reset int := 0;
begin
  -- Reset rank points for all players
  update public.players
  set rank_points = 0, updated_at = now();
  get diagnostics v_players_reset = row_count;

  -- Wipe ranked history
  truncate table public.player_rank_points_history;

  -- Clear queues to avoid stale matches
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'queue') then
    truncate table public.queue;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'matchmaking_queue') then
    truncate table public.matchmaking_queue;
  end if;

  -- Wipe match data for a clean season
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_step_answers_v2') then
    truncate table public.match_step_answers_v2;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_round_player_progress_v1') then
    truncate table public.match_round_player_progress_v1;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_rounds') then
    truncate table public.match_rounds cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'matches') then
    truncate table public.matches cascade;
  end if;

  return jsonb_build_object(
    'success', true,
    'players_reset', v_players_reset
  );
end;
$$;

-- Only service_role should execute this.
revoke all on function public.reset_ranked_season_v1() from public;
grant execute on function public.reset_ranked_season_v1() to service_role;

commit;

