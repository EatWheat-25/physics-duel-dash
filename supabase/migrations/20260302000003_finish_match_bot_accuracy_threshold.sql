-- 20260302000003_finish_match_bot_accuracy_threshold.sql
-- Override win logic for idle bot matches (>70% accuracy to win).

begin;

create or replace function public.finish_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_winner_id uuid;
  v_stats jsonb;

  v_p1_old int;
  v_p2_old int;
  v_p1_new int;
  v_p2_new int;
  v_p1_delta int;
  v_p2_delta int;
  v_p1_outcome text;
  v_p2_outcome text;

  v_p1_pct int;
  v_p2_pct int;
  v_p1_correct int;
  v_p2_correct int;
  v_p1_total int;
  v_p2_total int;

  v_bot_id uuid := '8f7f6c2a-1f4d-4f0b-9b7d-1a2b3c4d5e6f';
  v_bot_min_accuracy_pct int;
  v_human_id uuid;
  v_human_pct int;
  v_is_idle_bot_match boolean := false;
begin
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match not found: %', p_match_id;
  end if;

  if v_match.status = 'finished' and v_match.ranked_applied_at is not null then
    return jsonb_build_object(
      'winner_id', v_match.winner_id,
      'player1_final_score', v_match.player1_score,
      'player2_final_score', v_match.player2_score,
      'total_rounds', v_match.current_round_number,
      'ranked_payload', v_match.ranked_payload
    );
  end if;

  -- Ensure players rows exist before writing rank history.
  perform public.ensure_players_for_match_v1(p_match_id);

  -- Compute per-player accuracy from recorded parts
  v_stats := public.compute_match_accuracy_v1(p_match_id);
  v_p1_pct := coalesce((v_stats->'p1'->>'accuracy_pct')::int, 0);
  v_p2_pct := coalesce((v_stats->'p2'->>'accuracy_pct')::int, 0);
  v_p1_correct := coalesce((v_stats->'p1'->>'correct_parts')::int, 0);
  v_p2_correct := coalesce((v_stats->'p2'->>'correct_parts')::int, 0);
  v_p1_total := coalesce((v_stats->'p1'->>'total_parts')::int, 0);
  v_p2_total := coalesce((v_stats->'p2'->>'total_parts')::int, 0);

  v_is_idle_bot_match := (v_match.bot_behavior = 'idle' or v_match.bot_min_accuracy_pct is not null)
    and (v_match.player1_id = v_bot_id or v_match.player2_id = v_bot_id);

  if v_is_idle_bot_match then
    v_bot_min_accuracy_pct := coalesce(v_match.bot_min_accuracy_pct, 70);
    if v_match.player1_id = v_bot_id then
      v_human_id := v_match.player2_id;
      v_human_pct := v_p2_pct;
    else
      v_human_id := v_match.player1_id;
      v_human_pct := v_p1_pct;
    end if;

    if v_human_pct > v_bot_min_accuracy_pct then
      v_winner_id := v_human_id;
    else
      v_winner_id := v_bot_id;
    end if;
  else
    -- Winner logic: higher correct wins; tie -> compare accuracy pct; else draw
    if v_p1_correct > v_p2_correct then
      v_winner_id := v_match.player1_id;
    elsif v_p2_correct > v_p1_correct then
      v_winner_id := v_match.player2_id;
    elsif v_p1_pct > v_p2_pct then
      v_winner_id := v_match.player1_id;
    elsif v_p2_pct > v_p1_pct then
      v_winner_id := v_match.player2_id;
    else
      v_winner_id := null;
    end if;
  end if;

  update public.matches
  set status = 'finished',
      completed_at = now(),
      winner_id = v_winner_id
  where id = p_match_id;

  if v_winner_id is null then
    v_p1_outcome := 'draw';
    v_p2_outcome := 'draw';
  elsif v_winner_id = v_match.player1_id then
    v_p1_outcome := 'win';
    v_p2_outcome := 'loss';
  else
    v_p1_outcome := 'loss';
    v_p2_outcome := 'win';
  end if;

  select rank_points into v_p1_old from public.players where id = v_match.player1_id;
  select rank_points into v_p2_old from public.players where id = v_match.player2_id;
  v_p1_old := coalesce(v_p1_old, 0);
  v_p2_old := coalesce(v_p2_old, 0);

  v_p1_delta := public.points_from_outcome_accuracy_v1(v_p1_outcome, v_p1_pct);
  v_p2_delta := public.points_from_outcome_accuracy_v1(v_p2_outcome, v_p2_pct);

  v_p1_new := public._clamp_int(v_p1_old + v_p1_delta, 0, 2000);
  v_p2_new := public._clamp_int(v_p2_old + v_p2_delta, 0, 2000);

  update public.players set rank_points = v_p1_new, updated_at = now() where id = v_match.player1_id;
  update public.players set rank_points = v_p2_new, updated_at = now() where id = v_match.player2_id;

  insert into public.player_rank_points_history (
    player_id, match_id, opponent_id,
    old_points, new_points, delta, outcome,
    accuracy_pct, correct_parts, total_parts
  ) values
    (v_match.player1_id, p_match_id, v_match.player2_id, v_p1_old, v_p1_new, v_p1_new - v_p1_old, v_p1_outcome, v_p1_pct, v_p1_correct, v_p1_total),
    (v_match.player2_id, p_match_id, v_match.player1_id, v_p2_old, v_p2_new, v_p2_new - v_p2_old, v_p2_outcome, v_p2_pct, v_p2_correct, v_p2_total);

  update public.matches
  set ranked_payload = jsonb_build_object(
        'winner_id', v_winner_id,
        'p1', jsonb_build_object(
          'player_id', v_match.player1_id,
          'outcome', v_p1_outcome,
          'old_points', v_p1_old,
          'new_points', v_p1_new,
          'delta', v_p1_new - v_p1_old,
          'accuracy_pct', v_p1_pct,
          'correct_parts', v_p1_correct,
          'total_parts', v_p1_total
        ),
        'p2', jsonb_build_object(
          'player_id', v_match.player2_id,
          'outcome', v_p2_outcome,
          'old_points', v_p2_old,
          'new_points', v_p2_new,
          'delta', v_p2_new - v_p2_old,
          'accuracy_pct', v_p2_pct,
          'correct_parts', v_p2_correct,
          'total_parts', v_p2_total
        )
      ),
      ranked_applied_at = now()
  where id = p_match_id;

  return jsonb_build_object(
    'winner_id', v_winner_id,
    'player1_final_score', v_match.player1_score,
    'player2_final_score', v_match.player2_score,
    'total_rounds', v_match.current_round_number,
    'ranked_payload', (select ranked_payload from public.matches where id = p_match_id)
  );
end;
$$;

grant execute on function public.finish_match(uuid) to authenticated;

commit;
