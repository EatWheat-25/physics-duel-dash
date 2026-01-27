-- 20260121000003_fix_ranked_accuracy_simple_rounds.sql
-- Persist simple-round answers into match_step_answers_v2 for accuracy tracking.
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
  v_now timestamptz := now();

  v_correct_answer int;
  v_step jsonb;
  v_step_type text;
  v_options jsonb;
  v_option_count int;

  v_p1_is bool;
  v_p2_is bool;

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
  v_round_index int;
begin
  if p_answer is null then
    raise exception 'answer cannot be null';
  end if;

  -- Require integer (defense in depth; PostgREST may pass numeric)
  if p_answer <> floor(p_answer) then
    return jsonb_build_object('success', false, 'reason', 'answer_not_integer');
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

  -- ===== Load step 0 to validate answer range (2–6 for mcq, 2 for true_false) =====
  select q.steps->0
  into v_step
  from public.questions_v2 q
  where q.id = v_round.question_id;

  if v_step is null or jsonb_typeof(v_step) <> 'object' then
    return jsonb_build_object('success', false, 'reason', 'question_step_0_invalid');
  end if;

  v_step_type := lower(coalesce(v_step->>'type', 'mcq'));
  v_options := v_step->'options';

  if jsonb_typeof(v_options) <> 'array' then
    return jsonb_build_object('success', false, 'reason', 'question_options_invalid');
  end if;

  v_option_count := jsonb_array_length(v_options);

  if v_step_type = 'true_false' then
    -- Backwards-compatible: allow DB rows that stored 4 options with C/D empty strings.
    if v_option_count < 2 then
      return jsonb_build_object('success', false, 'reason', 'true_false_requires_2_options');
    end if;
    v_option_count := 2;
  else
    if v_option_count < 2 or v_option_count > 6 then
      return jsonb_build_object('success', false, 'reason', 'mcq_option_count_out_of_range');
    end if;
  end if;

  if p_answer < 0 or p_answer >= v_option_count then
    return jsonb_build_object('success', false, 'reason', 'answer_out_of_range');
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

  -- Clamp invalid correct answers to 0 (defense in depth; admin validation should prevent this).
  if v_correct_answer < 0 or v_correct_answer >= v_option_count then
    v_correct_answer := 0;
  end if;

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
    'target_rounds_to_win', v_target_rounds_to_win,
    'player_round_wins', jsonb_build_object(
      v_match.player1_id::text, v_p1_wins,
      v_match.player2_id::text, v_p2_wins
    ),
    'match_over', v_finished,
    'match_winner_id', v_match_winner_id,
    'computed_at', v_now
  );

  -- Persist per-player answers for accuracy tracking (simple rounds)
  v_round_index := coalesce(v_round.round_number, v_match.current_round_number, 1);

  insert into public.match_step_answers_v2 (
    match_id,
    round_index,
    question_id,
    player_id,
    step_index,
    segment,
    sub_step_index,
    selected_option,
    is_correct,
    response_time_ms
  ) values
    (
      p_match_id,
      v_round_index,
      v_round.question_id,
      v_match.player1_id,
      0,
      'main',
      0,
      v_p1_answer,
      v_p1_correct,
      0
    ),
    (
      p_match_id,
      v_round_index,
      v_round.question_id,
      v_match.player2_id,
      0,
      'main',
      0,
      v_p2_answer,
      v_p2_correct,
      0
    )
  on conflict (match_id, round_index, player_id, question_id, step_index, segment, sub_step_index)
  do update set
    selected_option = excluded.selected_option,
    is_correct = excluded.is_correct,
    response_time_ms = excluded.response_time_ms,
    answered_at = now();

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
        when v_finished then v_match_winner_id
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

alter function public.submit_round_answer_v2(uuid, uuid, integer) set search_path = public;
grant execute on function public.submit_round_answer_v2(uuid, uuid, integer) to authenticated;

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
  v_round_index int;
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

  -- Persist per-player answers for accuracy tracking (simple rounds)
  v_round_index := coalesce(v_round.round_number, v_match.current_round_number, 1);

  insert into public.match_step_answers_v2 (
    match_id,
    round_index,
    question_id,
    player_id,
    step_index,
    segment,
    sub_step_index,
    selected_option,
    is_correct,
    response_time_ms
  ) values
    (
      p_match_id,
      v_round_index,
      v_round.question_id,
      v_match.player1_id,
      0,
      'main',
      0,
      v_p1_answer,
      v_p1_correct,
      0
    ),
    (
      p_match_id,
      v_round_index,
      v_round.question_id,
      v_match.player2_id,
      0,
      'main',
      0,
      v_p2_answer,
      v_p2_correct,
      0
    )
  on conflict (match_id, round_index, player_id, question_id, step_index, segment, sub_step_index)
  do update set
    selected_option = excluded.selected_option,
    is_correct = excluded.is_correct,
    response_time_ms = excluded.response_time_ms,
    answered_at = now();

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
