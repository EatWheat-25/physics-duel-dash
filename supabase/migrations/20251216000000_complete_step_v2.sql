-- Atomic step completion RPC
-- Advances a step when both players have answered (or force_timeout=true)

create or replace function public.complete_step_v2(
  p_match_id uuid,
  p_round_index integer,
  p_step_index integer,
  p_force_timeout boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_acquired boolean;
  v_p1 uuid;
  v_p2 uuid;
  v_answered_count integer;
  v_total_players integer := 0;
  v_should_advance boolean := false;
begin
  -- lock per match/round/step to avoid double-advance
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext(p_match_id::text || ':' || p_round_index::text || ':' || p_step_index::text));
  if not v_lock_acquired then
    return jsonb_build_object(
      'advanced', false,
      'reason', 'lock_not_acquired'
    );
  end if;

  -- get players
  select player1_id, player2_id
  into v_p1, v_p2
  from matches
  where id = p_match_id;

  if v_p1 is not null then v_total_players := v_total_players + 1; end if;
  if v_p2 is not null then v_total_players := v_total_players + 1; end if;

  -- count distinct player answers for this step
  select count(distinct player_id)
  into v_answered_count
  from match_step_answers_v2
  where match_id = p_match_id
    and round_index = p_round_index
    and step_index = p_step_index;

  if p_force_timeout then
    -- on timeout, advance regardless; unanswered players will be treated as eliminated by caller
    v_should_advance := true;
  else
    v_should_advance := (v_answered_count >= v_total_players and v_total_players > 0);
  end if;

  return jsonb_build_object(
    'advanced', v_should_advance,
    'answered_count', v_answered_count,
    'total_players', v_total_players
  );
end;
$$;

grant execute on function public.complete_step_v2(uuid, integer, integer, boolean) to service_role;










