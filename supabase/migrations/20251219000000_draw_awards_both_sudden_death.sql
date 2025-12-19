-- 20251219000000_draw_awards_both_sudden_death.sql
-- Rules update:
-- - Round draws award BOTH players +1 round-win (but round_winner remains NULL for UI "draw")
-- - Match ends only when someone reaches target_rounds_to_win AND is strictly ahead (sudden death on ties)

begin;

-- =========================
-- Multi-step async segments
-- =========================
create or replace function public.compute_multi_step_results_v3(
  p_match_id uuid,
  p_round_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_round public.match_rounds%rowtype;
  v_now timestamptz := now();

  v_round_index int;
  v_results_version int;

  v_steps jsonb;
  v_step jsonb;
  v_sub jsonb;
  i int;

  v_p1_parts_correct int := 0;
  v_p2_parts_correct int := 0;

  v_p1_wins int;
  v_p2_wins int;
  v_target_rounds_to_win int;
  v_finished boolean := false;
  v_round_winner uuid;
  v_match_winner uuid := null;

  -- Per-step answer aggregates
  v_p1_main_answer int;
  v_p2_main_answer int;
  v_p1_sub_answer int;
  v_p2_sub_answer int;

  v_p1_main_correct boolean;
  v_p2_main_correct boolean;
  v_p1_sub_correct boolean;
  v_p2_sub_correct boolean;

  v_has_sub boolean;
  v_marks int;
  v_main_correct_answer int;
  v_sub_correct_answer int;

  v_p1_part_correct boolean;
  v_p2_part_correct boolean;

  v_p1_step_awarded int;
  v_p2_step_awarded int;

  v_step_results jsonb := '[]'::jsonb;
  v_payload jsonb;
begin
  -- Lock match row (idempotent + prevents double compute)
  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'match_not_found');
  end if;

  if v_match.status not in ('pending', 'in_progress') then
    return jsonb_build_object('success', false, 'error', 'match_not_active');
  end if;

  if v_match.current_round_id is null or v_match.current_round_id <> p_round_id then
    return jsonb_build_object('success', false, 'error', 'round_id_mismatch');
  end if;

  select *
  into v_round
  from public.match_rounds
  where id = p_round_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'round_not_found');
  end if;

  -- Idempotency: if results already computed for this round, return existing
  if v_match.results_computed_at is not null
     and v_match.results_round_id = p_round_id
     and v_match.results_payload is not null then
    return jsonb_build_object(
      'success', true,
      'already_computed', true,
      'results_version', v_match.results_version,
      'results_round_id', v_match.results_round_id,
      'results_payload', v_match.results_payload
    );
  end if;

  v_round_index := greatest(0, coalesce(v_match.current_round_number, 1) - 1);

  -- Load question steps (single source of truth)
  select q.steps
  into v_steps
  from public.questions_v2 q
  where q.id = v_round.question_id;

  if jsonb_typeof(v_steps) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'question_steps_invalid');
  end if;

  -- Only support exactly 4 steps for online battles in this ruleset
  if jsonb_array_length(v_steps) <> 4 then
    return jsonb_build_object('success', false, 'error', 'question_steps_must_be_4');
  end if;

  -- Build step breakdown and compute parts-correct totals
  for i in 0..3 loop
    v_step := v_steps -> i;

    v_marks := public._coalesce_int(v_step->>'marks', 1);

    -- Correct answers (main/sub). We support both correctAnswer and correct_answer.correctIndex
    v_main_correct_answer := public._coalesce_int(
      coalesce(
        v_step->>'correctAnswer',
        case when jsonb_typeof(v_step->'correct_answer') = 'number' then v_step->>'correct_answer' else null end,
        v_step->'correct_answer'->>'correctIndex'
      ),
      0
    );

    v_has_sub := (
      v_step is not null
      and (
        (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object')
        or (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object')
      )
    );

    v_sub_correct_answer := null;
    if v_has_sub then
      v_sub := case
        when (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object') then v_step->'subStep'
        when (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object') then v_step->'sub_step'
        else null
      end;
      v_sub_correct_answer := public._coalesce_int(
        coalesce(
          v_sub->>'correctAnswer',
          case when jsonb_typeof(v_sub->'correct_answer') = 'number' then v_sub->>'correct_answer' else null end,
          v_sub->'correct_answer'->>'correctIndex'
        ),
        0
      );
    end if;

    -- Aggregate answers for this step
    select
      max(case when player_id = v_match.player1_id and segment = 'main' then selected_option end),
      max(case when player_id = v_match.player2_id and segment = 'main' then selected_option end),
      max(case when player_id = v_match.player1_id and segment = 'sub' then selected_option end),
      max(case when player_id = v_match.player2_id and segment = 'sub' then selected_option end),
      bool_or(case when player_id = v_match.player1_id and segment = 'main' then is_correct else false end),
      bool_or(case when player_id = v_match.player2_id and segment = 'main' then is_correct else false end),
      bool_or(case when player_id = v_match.player1_id and segment = 'sub' then is_correct else false end),
      bool_or(case when player_id = v_match.player2_id and segment = 'sub' then is_correct else false end)
    into
      v_p1_main_answer,
      v_p2_main_answer,
      v_p1_sub_answer,
      v_p2_sub_answer,
      v_p1_main_correct,
      v_p2_main_correct,
      v_p1_sub_correct,
      v_p2_sub_correct
    from public.match_step_answers_v2
    where match_id = p_match_id
      and round_index = v_round_index
      and question_id = v_round.question_id
      and step_index = i;

    v_p1_part_correct := coalesce(v_p1_main_correct, false) and (case when v_has_sub then coalesce(v_p1_sub_correct, false) else true end);
    v_p2_part_correct := coalesce(v_p2_main_correct, false) and (case when v_has_sub then coalesce(v_p2_sub_correct, false) else true end);

    if v_p1_part_correct then v_p1_parts_correct := v_p1_parts_correct + 1; end if;
    if v_p2_part_correct then v_p2_parts_correct := v_p2_parts_correct + 1; end if;

    v_p1_step_awarded := case when v_p1_part_correct then v_marks else 0 end;
    v_p2_step_awarded := case when v_p2_part_correct then v_marks else 0 end;

    v_step_results := v_step_results || jsonb_build_array(
      jsonb_build_object(
        'stepIndex', i,
        'marks', v_marks,
        'hasSubStep', v_has_sub,
        'mainCorrectAnswer', v_main_correct_answer,
        'subCorrectAnswer', v_sub_correct_answer,
        'p1MainAnswerIndex', v_p1_main_answer,
        'p2MainAnswerIndex', v_p2_main_answer,
        'p1SubAnswerIndex', case when v_has_sub then v_p1_sub_answer else null end,
        'p2SubAnswerIndex', case when v_has_sub then v_p2_sub_answer else null end,
        'p1PartCorrect', v_p1_part_correct,
        'p2PartCorrect', v_p2_part_correct,
        'p1StepAwarded', v_p1_step_awarded,
        'p2StepAwarded', v_p2_step_awarded
      )
    );
  end loop;

  -- Determine round winner by parts-correct (NULL = draw)
  if v_p1_parts_correct > v_p2_parts_correct then
    v_round_winner := v_match.player1_id;
  elsif v_p2_parts_correct > v_p1_parts_correct then
    v_round_winner := v_match.player2_id;
  else
    v_round_winner := null;
  end if;

  -- Round wins tracking (draw => both +1)
  v_p1_wins := coalesce(v_match.player1_round_wins, 0);
  v_p2_wins := coalesce(v_match.player2_round_wins, 0);
  v_target_rounds_to_win := coalesce(v_match.target_rounds_to_win, 3);

  if v_round_winner = v_match.player1_id then
    v_p1_wins := v_p1_wins + 1;
  elsif v_round_winner = v_match.player2_id then
    v_p2_wins := v_p2_wins + 1;
  else
    v_p1_wins := v_p1_wins + 1;
    v_p2_wins := v_p2_wins + 1;
  end if;

  -- Sudden death: must reach target AND be strictly ahead
  if v_p1_wins >= v_target_rounds_to_win and v_p1_wins > v_p2_wins then
    v_finished := true;
    v_match_winner := v_match.player1_id;
  elsif v_p2_wins >= v_target_rounds_to_win and v_p2_wins > v_p1_wins then
    v_finished := true;
    v_match_winner := v_match.player2_id;
  else
    v_finished := false;
    v_match_winner := null;
  end if;

  v_results_version := coalesce(v_match.results_version, 0) + 1;

  v_payload := jsonb_build_object(
    'mode', 'steps',
    'rules_version', 3,
    'round_id', p_round_id,
    'round_number', coalesce(v_match.current_round_number, 1),
    'question_id', v_round.question_id,
    'total_parts', 4,
    'p1_parts_correct', v_p1_parts_correct,
    'p2_parts_correct', v_p2_parts_correct,
    'stepResults', v_step_results,
    'round_winner', v_round_winner,
    'match_over', v_finished,
    'match_winner_id', v_match_winner,
    'target_rounds_to_win', v_target_rounds_to_win,
    'player_round_wins', jsonb_build_object(
      v_match.player1_id::text, v_p1_wins,
      v_match.player2_id::text, v_p2_wins
    ),
    'computed_at', v_now
  );

  -- Persist to matches
  update public.matches
  set
    round_winner = v_round_winner,
    results_computed_at = v_now,
    results_round_id = p_round_id,
    results_version = v_results_version,
    results_payload = v_payload,
    player1_round_wins = v_p1_wins,
    player2_round_wins = v_p2_wins,
    status = case when v_finished then 'finished' else v_match.status end,
    winner_id = case when v_finished then v_match_winner else v_match.winner_id end
  where id = p_match_id;

  -- Mark round as results
  update public.match_rounds
  set status = 'results'
  where id = p_round_id;

  return jsonb_build_object(
    'success', true,
    'results_version', v_results_version,
    'results_round_id', p_round_id,
    'results_payload', v_payload
  );
end;
$$;

alter function public.compute_multi_step_results_v3(uuid, uuid) set search_path = public;
grant execute on function public.compute_multi_step_results_v3(uuid, uuid) to service_role;

-- =========================
-- Single-step (legacy) path
-- =========================
create or replace function public.submit_round_answer_v2(
  p_match_id UUID,
  p_player_id UUID,
  p_answer INTEGER  -- 0 or 1 for True/False
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match RECORD;
  v_is_player1 BOOLEAN;
  v_both_answered BOOLEAN := false;
  v_correct_answer INTEGER;
  v_update_count INTEGER;
  v_round_winner UUID;
  v_player1_round_wins INT;
  v_player2_round_wins INT;
  v_target_rounds_to_win INT;
  v_match_over BOOLEAN := false;
  v_match_winner_id UUID;
  v_next_round_ready BOOLEAN := false;
  v_round_number INT;
  v_p1_answer INTEGER;
  v_p2_answer INTEGER;
begin
  -- 1. Validate: Get match and verify player is in it
  select * into v_match
  from public.matches
  where id = p_match_id
    and (player1_id = p_player_id or player2_id = p_player_id)
    and question_id is not null
    and results_computed_at is null
    and status = 'in_progress'
    and winner_id is null;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Match not found, player not in match, or results already computed'
    );
  end if;

  -- 2. Validate: Answer must be 0 or 1 (True/False)
  if p_answer not in (0, 1) then
    return jsonb_build_object(
      'success', false,
      'error', 'Invalid answer: must be 0 or 1'
    );
  end if;

  -- 3. Determine which player
  v_is_player1 := (v_match.player1_id = p_player_id);

  -- 4. Check if already answered (idempotency)
  if (v_is_player1 and v_match.player1_answer is not null) or
     (not v_is_player1 and v_match.player2_answer is not null) then
    return jsonb_build_object(
      'success', false,
      'error', 'Answer already submitted',
      'already_answered', true
    );
  end if;

  -- 5. Atomic update: Set answer + timestamp
  if v_is_player1 then
    update public.matches
    set player1_answer = p_answer,
        player1_answered_at = now()
    where id = p_match_id
      and player1_answer is null;
    get diagnostics v_update_count = row_count;
  else
    update public.matches
    set player2_answer = p_answer,
        player2_answered_at = now()
    where id = p_match_id
      and player2_answer is null;
    get diagnostics v_update_count = row_count;
  end if;

  -- 6. Check FOUND: If update didn't affect any rows, race condition occurred
  if v_update_count = 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Answer already submitted (race condition)',
      'already_answered', true
    );
  end if;

  -- 7. Check if both answered (in same transaction) and get current match state
  select
    (player1_answer is not null and player2_answer is not null) as both_answered,
    player1_answer,
    player2_answer,
    coalesce(player1_round_wins, 0),
    coalesce(player2_round_wins, 0),
    coalesce(target_rounds_to_win, 3),
    coalesce(round_number, 0)
  into v_both_answered, v_p1_answer, v_p2_answer,
       v_player1_round_wins, v_player2_round_wins, v_target_rounds_to_win, v_round_number
  from public.matches
  where id = p_match_id;

  -- 8. If both answered, compute results and update round wins atomically
  if v_both_answered then
    -- Fetch correct answer from question (do this once)
    select (steps->0->>'correctAnswer')::int
    into v_correct_answer
    from public.questions_v2
    where id = v_match.question_id;

    -- Determine round winner based on correctness (NULL = draw)
    if v_p1_answer = v_correct_answer and v_p2_answer != v_correct_answer then
      v_round_winner := v_match.player1_id;
    elsif v_p2_answer = v_correct_answer and v_p1_answer != v_correct_answer then
      v_round_winner := v_match.player2_id;
    else
      v_round_winner := null;
    end if;

    -- Update round wins based on round winner (draw => both +1)
    if v_round_winner = v_match.player1_id then
      v_player1_round_wins := v_player1_round_wins + 1;
    elsif v_round_winner = v_match.player2_id then
      v_player2_round_wins := v_player2_round_wins + 1;
    else
      v_player1_round_wins := v_player1_round_wins + 1;
      v_player2_round_wins := v_player2_round_wins + 1;
    end if;

    -- Sudden death: must reach target AND be strictly ahead
    if v_player1_round_wins >= v_target_rounds_to_win and v_player1_round_wins > v_player2_round_wins then
      v_match_over := true;
      v_match_winner_id := v_match.player1_id;
    elsif v_player2_round_wins >= v_target_rounds_to_win and v_player2_round_wins > v_player1_round_wins then
      v_match_over := true;
      v_match_winner_id := v_match.player2_id;
    else
      v_match_over := false;
      v_match_winner_id := null;
    end if;

    -- Increment round number
    v_round_number := v_round_number + 1;

    -- Update match with all results, round wins, and match status
    update public.matches
    set
      both_answered_at = now(),
      correct_answer = v_correct_answer,
      player1_correct = (v_p1_answer = v_correct_answer),
      player2_correct = (v_p2_answer = v_correct_answer),
      round_winner = v_round_winner,
      results_computed_at = now(),
      player1_round_wins = v_player1_round_wins,
      player2_round_wins = v_player2_round_wins,
      round_number = v_round_number,
      winner_id = case when v_match_over then v_match_winner_id else null end,
      status = case when v_match_over then 'finished' else 'in_progress' end
    where id = p_match_id
      and results_computed_at is null;

    -- If match continues, clear answer fields for next round
    if not v_match_over then
      update public.matches
      set
        player1_answer = null,
        player2_answer = null,
        player1_answered_at = null,
        player2_answered_at = null,
        both_answered_at = null,
        correct_answer = null,
        player1_correct = null,
        player2_correct = null,
        round_winner = null,
        results_computed_at = null
      where id = p_match_id;
      v_next_round_ready := true;
    end if;

    -- Return full result payload (use values we computed, not DB selects)
    return jsonb_build_object(
      'success', true,
      'both_answered', true,
      'result', jsonb_build_object(
        'player1_answer', v_p1_answer,
        'player2_answer', v_p2_answer,
        'correct_answer', v_correct_answer,
        'player1_correct', (v_p1_answer = v_correct_answer),
        'player2_correct', (v_p2_answer = v_correct_answer),
        'round_winner', v_round_winner,
        'round_number', v_round_number,
        'target_rounds_to_win', v_target_rounds_to_win,
        'player1_round_wins', v_player1_round_wins,
        'player2_round_wins', v_player2_round_wins,
        'player_round_wins', jsonb_build_object(
          v_match.player1_id::text, v_player1_round_wins,
          v_match.player2_id::text, v_player2_round_wins
        ),
        'match_over', v_match_over,
        'match_winner_id', v_match_winner_id,
        'next_round_ready', v_next_round_ready
      )
    );
  else
    -- Only one answered - return simple response
    return jsonb_build_object(
      'success', true,
      'both_answered', false
    );
  end if;
end;
$$;

alter function public.submit_round_answer_v2(uuid, uuid, integer) set search_path = public;
grant execute on function public.submit_round_answer_v2(uuid, uuid, integer) to authenticated;

commit;


