-- 20260120000000_disable_ranked_sql_v1.sql
-- Disable ranked SQL features and restore baseline finish_match.

begin;

-- ----------------------------------------------------------------------------
-- Remove ranked helper functions (keep tables/columns intact)
-- ----------------------------------------------------------------------------
drop function if exists public.reset_ranked_season_v1();
drop function if exists public.get_players_rank_public_v1(uuid[]);
drop function if exists public.points_from_outcome_accuracy_v1(text, numeric);
drop function if exists public.compute_match_accuracy_v1(uuid);
drop function if exists public.ensure_players_for_match_v1(uuid);
drop function if exists public._clamp_int(int, int, int);

-- ----------------------------------------------------------------------------
-- Restore baseline finish_match (pre-ranked)
-- ----------------------------------------------------------------------------
drop function if exists public.finish_match(uuid);

create or replace function public.finish_match(
  p_match_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_match record;
  v_winner_id uuid;
begin
  select * into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  if v_match.status = 'finished' then
    return jsonb_build_object(
      'winner_id', v_match.winner_id,
      'player1_final_score', v_match.player1_score,
      'player2_final_score', v_match.player2_score,
      'total_rounds', v_match.current_round_number,
      'accuracy_stats', '{}'::jsonb
    );
  end if;

  if v_match.player1_score > v_match.player2_score then
    v_winner_id := v_match.player1_id;
  elsif v_match.player2_score > v_match.player1_score then
    v_winner_id := v_match.player2_id;
  else
    v_winner_id := null;
  end if;

  update public.matches
  set
    status = 'finished',
    completed_at = now(),
    winner_id = v_winner_id
  where id = p_match_id;

  select * into v_match
  from public.matches
  where id = p_match_id;

  return jsonb_build_object(
    'winner_id', v_match.winner_id,
    'player1_final_score', v_match.player1_score,
    'player2_final_score', v_match.player2_score,
    'total_rounds', v_match.current_round_number,
    'accuracy_stats', '{}'::jsonb
  );
end;
$$;

grant execute on function public.finish_match(uuid) to authenticated;

commit;
