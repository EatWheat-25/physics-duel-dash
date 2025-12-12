-- 20251212000002_v2_update_submit_round_answer_v2.sql
begin;

create or replace function public.submit_round_answer_v2(
  p_match_id uuid,
  p_player_id uuid,
  p_answer integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_round public.match_rounds%rowtype;
  v_correct_answer int;
  v_p1_is bool;
  v_p2_is bool;
  v_now timestamptz := now();
  v_p1_answer int;
  v_p2_answer int;
  v_p1_correct bool;
  v_p2_correct bool;
  v_round_winner uuid;
  v_p1_wins int;
  v_p2_wins int;
  v_finished bool := false;
  v_results_version int;
  v_payload jsonb;
begin
  if p_answer is null then
    raise exception 'answer cannot be null';
  end if;

  -- ===== NON-NEGOTIABLE: lock match row =====
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

  v_p1_is := (p_player_id = v_match.player1_id);
  v_p2_is := (p_player_id = v_match.player2_id);

  if not (v_p1_is or v_p2_is) then
    raise exception 'player not in match';
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

  -- Idempotency: if player already answered, return early
  if v_p1_is and v_match.player1_answered_at is not null then
    return jsonb_build_object('success', true, 'already_answered', true);
  end if;
  if v_p2_is and v_match.player2_answered_at is not null then
    return jsonb_build_object('success', true, 'already_answered', true);
  end if;

  -- Store answer on matches (simple question path; keep until clear_round_results)
  if v_p1_is then
    update public.matches
    set player1_answer = p_answer,
        player1_answered_at = v_now
    where id = p_match_id;
  else
    update public.matches
    set player2_answer = p_answer,
        player2_answered_at = v_now
    where id = p_match_id;
  end if;

  -- Refresh current answers
  select player1_answer, player2_answer
  into v_p1_answer, v_p2_answer
  from public.matches
  where id = p_match_id;

  -- If both not answered yet, just ACK
  if v_p1_answer is null or v_p2_answer is null then
    return jsonb_build_object(
      'success', true,
      'both_answered', false,
      'current_round_id', v_match.current_round_id
    );
  end if;

  -- ===== Compute correct answer from match_rounds.question_id (NOT matches.question_id) =====
  select (q.steps->0->>'correctAnswer')::int
  into v_correct_answer
  from public.match_rounds mr
  join public.questions_v2 q on q.id = mr.question_id
  where mr.id = v_match.current_round_id;

  v_p1_correct := (v_p1_answer = v_correct_answer);
  v_p2_correct := (v_p2_answer = v_correct_answer);

  -- Winner logic for simple T/F or MCQ:
  -- one correct beats incorrect; both correct or both incorrect = tie (null)
  v_round_winner :=
    case
      when v_p1_correct and not v_p2_correct then v_match.player1_id
      when v_p2_correct and not v_p1_correct then v_match.player2_id
      else null
    end;

  -- Current wins
  v_p1_wins := coalesce(v_match.player1_round_wins, 0);
  v_p2_wins := coalesce(v_match.player2_round_wins, 0);

  if v_round_winner = v_match.player1_id then
    v_p1_wins := v_p1_wins + 1;
  elsif v_round_winner = v_match.player2_id then
    v_p2_wins := v_p2_wins + 1;
  end if;

  -- Determine match completion
  if v_match.target_rounds_to_win is not null then
    if v_p1_wins >= v_match.target_rounds_to_win then
      v_finished := true;
    elsif v_p2_wins >= v_match.target_rounds_to_win then
      v_finished := true;
    end if;
  end if;

  -- Increment results version and store payload + round identity
  v_results_version := v_match.results_version + 1;

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
    'computed_at', v_now
  );

  update public.matches
  set correct_answer = v_correct_answer,
      player1_correct = v_p1_correct,
      player2_correct = v_p2_correct,
      round_winner = v_round_winner,
      both_answered_at = v_now,
      results_computed_at = v_now,
      results_round_id = v_match.current_round_id,
      results_version = v_results_version,
      results_payload = v_payload,
      player1_round_wins = v_p1_wins,
      player2_round_wins = v_p2_wins,
      status = case when v_finished then 'finished' else v_match.status end,
      winner_id = case
        when v_finished and v_p1_wins >= v_match.target_rounds_to_win then v_match.player1_id
        when v_finished and v_p2_wins >= v_match.target_rounds_to_win then v_match.player2_id
        else v_match.winner_id
      end
  where id = p_match_id;

  -- Also mark round status -> results (optional but helpful)
  update public.match_rounds
  set status = 'results'
  where id = v_match.current_round_id;

  return jsonb_build_object(
    'success', true,
    'both_answered', true,
    'results_version', v_results_version,
    'results_round_id', v_match.current_round_id,
    'results_payload', v_payload
  );
end;
$$;

commit;
