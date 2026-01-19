-- 20260119000002_force_timeout_results_payload.sql
begin;

create or replace function public.force_timeout_stage3(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_round public.match_rounds%rowtype;
  v_now timestamptz := now();
  v_correct_answer int;
  v_p1_answer int;
  v_p2_answer int;
  v_p1_correct bool;
  v_p2_correct bool;
  v_round_winner uuid;
  v_p1_wins int;
  v_p2_wins int;
  v_finished bool := false;
  v_target_rounds_to_win int;
  v_match_winner_id uuid;
  v_results_version int;
  v_payload jsonb;
begin
  -- Lock match row
  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match not found';
  end if;

  if v_match.status not in ('pending','in_progress') then
    return jsonb_build_object('success', false, 'reason', 'match_not_active');
  end if;

  if v_match.current_round_id is null then
    raise exception 'current_round_id is null (no active round)';
  end if;

  select *
  into v_round
  from public.match_rounds
  where id = v_match.current_round_id;

  if not found then
    raise exception 'match_round not found for current_round_id';
  end if;

  if v_match.player1_answer is not null and v_match.player2_answer is not null then
    return jsonb_build_object('success', false, 'reason', 'both_answered');
  end if;

  -- Compute correct answer using match_rounds.question_id (authoritative)
  select public._coalesce_int(
    coalesce(
      (q.steps->0->>'correctAnswer'),
      case when jsonb_typeof(q.steps->0->'correct_answer') = 'number' then (q.steps->0->>'correct_answer') else null end,
      (q.steps->0->'correct_answer'->>'correctIndex')
    ),
    0
  )
  into v_correct_answer
  from public.match_rounds mr
  join public.questions_v2 q on q.id = mr.question_id
  where mr.id = v_match.current_round_id;

  -- Mark unanswered players as wrong and set answer timestamps
  update public.matches
  set
    player1_answer = coalesce(player1_answer, case when v_correct_answer = 0 then 1 else 0 end),
    player2_answer = coalesce(player2_answer, case when v_correct_answer = 0 then 1 else 0 end),
    player1_answered_at = coalesce(player1_answered_at, v_now),
    player2_answered_at = coalesce(player2_answered_at, v_now),
    both_answered_at = v_now
  where id = p_match_id;

  -- Refresh answers for correctness
  select player1_answer, player2_answer
  into v_p1_answer, v_p2_answer
  from public.matches
  where id = p_match_id;

  v_p1_correct := (v_p1_answer = v_correct_answer);
  v_p2_correct := (v_p2_answer = v_correct_answer);

  v_round_winner :=
    case
      when v_p1_correct and not v_p2_correct then v_match.player1_id
      when v_p2_correct and not v_p1_correct then v_match.player2_id
      else null
    end;

  v_p1_wins := coalesce(v_match.player1_round_wins, 0);
  v_p2_wins := coalesce(v_match.player2_round_wins, 0);

  if v_round_winner = v_match.player1_id then
    v_p1_wins := v_p1_wins + 1;
  elsif v_round_winner = v_match.player2_id then
    v_p2_wins := v_p2_wins + 1;
  end if;

  v_target_rounds_to_win := coalesce(v_match.target_rounds_to_win, 3);
  if v_p1_wins >= v_target_rounds_to_win then
    v_finished := true;
    v_match_winner_id := v_match.player1_id;
  elsif v_p2_wins >= v_target_rounds_to_win then
    v_finished := true;
    v_match_winner_id := v_match.player2_id;
  else
    v_finished := false;
    v_match_winner_id := null;
  end if;

  v_results_version := coalesce(v_match.results_version, 0) + 1;

  v_payload := jsonb_build_object(
    'mode', 'simple',
    'round_id', v_match.current_round_id,
    'round_number', v_match.current_round_number,
    'question_id', v_round.question_id,
    'correct_answer', v_correct_answer,
    'p1', jsonb_build_object(
      'answer', v_p1_answer,
      'correct', v_p1_correct,
      'score_delta', case when v_round_winner = v_match.player1_id then 1 else 0 end,
      'total', v_p1_wins
    ),
    'p2', jsonb_build_object(
      'answer', v_p2_answer,
      'correct', v_p2_correct,
      'score_delta', case when v_round_winner = v_match.player2_id then 1 else 0 end,
      'total', v_p2_wins
    ),
    'round_winner', v_round_winner,
    'target_rounds_to_win', v_target_rounds_to_win,
    'player_round_wins', jsonb_build_object(
      v_match.player1_id::text, v_p1_wins,
      v_match.player2_id::text, v_p2_wins
    ),
    'match_over', v_finished,
    'match_winner_id', v_match_winner_id,
    'computed_at', v_now
  );

  update public.matches
  set
    correct_answer = v_correct_answer,
    player1_correct = v_p1_correct,
    player2_correct = v_p2_correct,
    round_winner = v_round_winner,
    results_computed_at = v_now,
    results_round_id = v_match.current_round_id,
    results_version = v_results_version,
    results_payload = v_payload,
    player1_round_wins = v_p1_wins,
    player2_round_wins = v_p2_wins,
    status = case when v_finished then 'finished' else v_match.status end,
    winner_id = case
      when v_finished then v_match_winner_id
      else v_match.winner_id
    end
  where id = p_match_id;

  update public.match_rounds
  set status = 'results'
  where id = v_match.current_round_id;

  return jsonb_build_object(
    'success', true,
    'timeout_applied', true,
    'results_version', v_results_version,
    'results_round_id', v_match.current_round_id,
    'results_payload', v_payload
  );
end;
$$;

alter function public.force_timeout_stage3(uuid) set search_path = public;

commit;
