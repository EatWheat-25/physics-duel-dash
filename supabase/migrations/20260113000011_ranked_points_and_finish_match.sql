-- 20260113000011_ranked_points_and_finish_match.sql
-- Server-authoritative ranked points based on accuracy for win/loss/draw.

begin;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function public._clamp_int(p_val int, p_min int, p_max int)
returns int
language sql
immutable
as $$
  select greatest(p_min, least(p_max, p_val));
$$;

-- ----------------------------------------------------------------------------
-- Accuracy computation (equal weight, server authoritative)
-- We compute totals from recorded answer rows. This naturally accounts for:
-- - steps and substeps
-- - gated substeps (only counted if they occurred)
-- - timeouts (row exists but is_correct=false)
-- ----------------------------------------------------------------------------
create or replace function public.compute_match_accuracy_v1(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_p1_correct int := 0;
  v_p2_correct int := 0;
  v_p1_total int := 0;
  v_p2_total int := 0;
  v_p1_acc numeric := 0;
  v_p2_acc numeric := 0;
  v_p1_pct int := 0;
  v_p2_pct int := 0;
begin
  select * into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'match not found: %', p_match_id;
  end if;

  select
    coalesce(sum(case when player_id = v_match.player1_id and is_correct then 1 else 0 end), 0),
    coalesce(sum(case when player_id = v_match.player2_id and is_correct then 1 else 0 end), 0),
    coalesce(sum(case when player_id = v_match.player1_id then 1 else 0 end), 0),
    coalesce(sum(case when player_id = v_match.player2_id then 1 else 0 end), 0)
  into
    v_p1_correct,
    v_p2_correct,
    v_p1_total,
    v_p2_total
  from public.match_step_answers_v2
  where match_id = p_match_id;

  v_p1_acc := case when v_p1_total > 0 then v_p1_correct::numeric / v_p1_total else 0 end;
  v_p2_acc := case when v_p2_total > 0 then v_p2_correct::numeric / v_p2_total else 0 end;

  -- floor accuracy percent
  v_p1_pct := public._clamp_int(floor(v_p1_acc * 100)::int, 0, 100);
  v_p2_pct := public._clamp_int(floor(v_p2_acc * 100)::int, 0, 100);

  return jsonb_build_object(
    'p1', jsonb_build_object(
      'player_id', v_match.player1_id,
      'correct_parts', v_p1_correct,
      'total_parts', v_p1_total,
      'accuracy', v_p1_acc,
      'accuracy_pct', v_p1_pct
    ),
    'p2', jsonb_build_object(
      'player_id', v_match.player2_id,
      'correct_parts', v_p2_correct,
      'total_parts', v_p2_total,
      'accuracy', v_p2_acc,
      'accuracy_pct', v_p2_pct
    )
  );
end;
$$;

grant execute on function public.compute_match_accuracy_v1(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Points table (win/loss/draw) from locked rules
-- p_accuracy may be 0..1 or 0..100; we floor to integer percent.
-- ----------------------------------------------------------------------------
create or replace function public.points_from_outcome_accuracy_v1(
  p_outcome text,
  p_accuracy numeric
)
returns int
language plpgsql
immutable
as $$
declare
  a int;
begin
  if p_accuracy is null then
    a := 0;
  elsif p_accuracy <= 1 then
    a := floor(p_accuracy * 100);
  else
    a := floor(p_accuracy);
  end if;

  a := public._clamp_int(a, 0, 100);

  if p_outcome = 'win' then
    if a < 50 then return 5;
    elsif a < 60 then return 5  + floor((a - 50) / 2.0);
    elsif a < 70 then return 10 + floor((a - 60) / 2.0);
    elsif a < 80 then return 15 + floor((a - 70) / 2.0);
    elsif a < 90 then return 20 + floor((a - 80) / 2.0);
    else return 25 + floor((a - 90) / 2.0);
    end if;

  elsif p_outcome = 'loss' then
    if a < 50 then return -25;
    elsif a < 60 then return -15 + floor((a - 50) / 2.0);
    elsif a < 70 then return -10 + floor((a - 60) / 2.0);
    elsif a < 80 then return -5  + floor((a - 70) / 2.0);
    elsif a < 90 then return 5;
    else return 7;
    end if;

  elsif p_outcome = 'draw' then
    if a < 50 then return 0;
    elsif a < 60 then return 1;
    elsif a < 70 then return 2;
    elsif a < 80 then return 3;
    elsif a < 90 then return 4;
    else return 5;
    end if;

  else
    raise exception 'invalid outcome: %', p_outcome;
  end if;
end;
$$;

grant execute on function public.points_from_outcome_accuracy_v1(text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- Public helper for UI: fetch public rank info for a set of players.
-- Avoid loosening RLS on players table.
-- ----------------------------------------------------------------------------
create or replace function public.get_players_rank_public_v1(p_ids uuid[])
returns table(id uuid, display_name text, rank_points int)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.rank_points
  from public.players p
  where p.id = any(p_ids);
$$;

grant execute on function public.get_players_rank_public_v1(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- finish_match: apply ranked points exactly once per match (idempotent)
-- ----------------------------------------------------------------------------
drop function if exists public.finish_match(uuid);

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
begin
  -- Lock match row to enforce idempotency + avoid double-application
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match not found: %', p_match_id;
  end if;

  -- If already finished AND ranked already applied, return stored payload if present.
  if v_match.status = 'finished' and v_match.ranked_applied_at is not null then
    return jsonb_build_object(
      'winner_id', v_match.winner_id,
      'player1_final_score', v_match.player1_score,
      'player2_final_score', v_match.player2_score,
      'total_rounds', v_match.current_round_number,
      'ranked_payload', v_match.ranked_payload
    );
  end if;

  -- Compute winner based on scores
  if v_match.player1_score > v_match.player2_score then
    v_winner_id := v_match.player1_id;
  elsif v_match.player2_score > v_match.player1_score then
    v_winner_id := v_match.player2_id;
  else
    v_winner_id := null; -- draw
  end if;

  -- Mark finished (always)
  update public.matches
  set status = 'finished',
      completed_at = now(),
      winner_id = v_winner_id
  where id = p_match_id;

  -- Compute per-player accuracy from recorded parts
  v_stats := public.compute_match_accuracy_v1(p_match_id);
  v_p1_pct := coalesce((v_stats->'p1'->>'accuracy_pct')::int, 0);
  v_p2_pct := coalesce((v_stats->'p2'->>'accuracy_pct')::int, 0);
  v_p1_correct := coalesce((v_stats->'p1'->>'correct_parts')::int, 0);
  v_p2_correct := coalesce((v_stats->'p2'->>'correct_parts')::int, 0);
  v_p1_total := coalesce((v_stats->'p1'->>'total_parts')::int, 0);
  v_p2_total := coalesce((v_stats->'p2'->>'total_parts')::int, 0);

  -- Determine outcomes
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

  -- Load current rank points
  select rank_points into v_p1_old from public.players where id = v_match.player1_id;
  select rank_points into v_p2_old from public.players where id = v_match.player2_id;
  v_p1_old := coalesce(v_p1_old, 0);
  v_p2_old := coalesce(v_p2_old, 0);

  -- Points deltas
  v_p1_delta := public.points_from_outcome_accuracy_v1(v_p1_outcome, v_p1_pct);
  v_p2_delta := public.points_from_outcome_accuracy_v1(v_p2_outcome, v_p2_pct);

  v_p1_new := public._clamp_int(v_p1_old + v_p1_delta, 0, 1500);
  v_p2_new := public._clamp_int(v_p2_old + v_p2_delta, 0, 1500);

  -- Apply points
  update public.players set rank_points = v_p1_new, updated_at = now() where id = v_match.player1_id;
  update public.players set rank_points = v_p2_new, updated_at = now() where id = v_match.player2_id;

  -- History rows
  insert into public.player_rank_points_history (
    player_id, match_id, opponent_id,
    old_points, new_points, delta, outcome,
    accuracy_pct, correct_parts, total_parts
  ) values
    (v_match.player1_id, p_match_id, v_match.player2_id, v_p1_old, v_p1_new, v_p1_new - v_p1_old, v_p1_outcome, v_p1_pct, v_p1_correct, v_p1_total),
    (v_match.player2_id, p_match_id, v_match.player1_id, v_p2_old, v_p2_new, v_p2_new - v_p2_old, v_p2_outcome, v_p2_pct, v_p2_correct, v_p2_total);

  -- Store ranked payload for UI
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

