-- 20260121000000_rollback_round_results_durable.sql
-- Roll back durable round results storage and restore pre-79a8981 functions.

begin;

-- Remove per-round results storage columns added for durability.
alter table public.match_rounds
  drop column if exists results_payload,
  drop column if exists results_version,
  drop column if exists results_computed_at;

-- ----------------------------------------------------------------------------
-- Restore baseline finish_match (pre-ranked)
-- ----------------------------------------------------------------------------
drop function if exists public.finish_match(uuid);

create or replace function public.finish_match(
  p_match_id uuid
) returns jsonb
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

-- ----------------------------------------------------------------------------
-- Restore submit_round_answer_v2 (variable options, no durable results)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Restore compute_multi_step_results_v3 (baseline from 2026-01-16)
-- ----------------------------------------------------------------------------
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
  v_sub_steps jsonb;
  i int;
  j int;

  v_step_count int := 0;

  v_p1_parts_correct int := 0;
  v_p2_parts_correct int := 0;

  v_p1_marks_points int := 0;
  v_p2_marks_points int := 0;
  v_p1_sub_points int := 0;
  v_p2_sub_points int := 0;
  v_p1_round_points int := 0;
  v_p2_round_points int := 0;

  v_p1_wins int;
  v_p2_wins int;
  v_target_rounds_to_win int;
  v_finished boolean := false;
  v_round_winner uuid;
  v_match_winner uuid := null;

  v_p1_main_answer int;
  v_p2_main_answer int;
  v_p1_sub_answer int;
  v_p2_sub_answer int;

  v_p1_main_correct boolean;
  v_p2_main_correct boolean;
  v_p1_sub_correct boolean;
  v_p2_sub_correct boolean;

  v_p1_sub_correct_count int := 0;
  v_p2_sub_correct_count int := 0;

  v_has_sub boolean := false;
  v_sub_count int := 0;
  v_marks int;
  v_main_correct_answer int;
  v_sub_correct_answer int;

  v_sub_correct_answers jsonb := '[]'::jsonb;
  v_p1_sub_answers jsonb := '[]'::jsonb;
  v_p2_sub_answers jsonb := '[]'::jsonb;

  v_p1_part_correct boolean;
  v_p2_part_correct boolean;

  v_p1_step_awarded int;
  v_p2_step_awarded int;

  v_step_results jsonb := '[]'::jsonb;
  v_payload jsonb;
begin
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

  select q.steps
  into v_steps
  from public.questions_v2 q
  where q.id = v_round.question_id;

  if jsonb_typeof(v_steps) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'question_steps_invalid');
  end if;

  v_step_count := jsonb_array_length(v_steps);
  if v_step_count <= 0 then
    return jsonb_build_object('success', false, 'error', 'question_steps_empty');
  end if;

  for i in 0..(v_step_count - 1) loop
    v_step := v_steps -> i;

    v_marks := public._coalesce_int(v_step->>'marks', 1);

    v_main_correct_answer := public._coalesce_int(
      coalesce(
        v_step->>'correctAnswer',
        case when jsonb_typeof(v_step->'correct_answer') = 'number' then v_step->>'correct_answer' else null end,
        v_step->'correct_answer'->>'correctIndex'
      ),
      0
    );

    v_sub_steps := null;
    v_sub_count := 0;
    if v_step is not null then
      if (v_step ? 'subSteps' and jsonb_typeof(v_step->'subSteps') = 'array') then
        v_sub_steps := v_step->'subSteps';
        v_sub_count := jsonb_array_length(v_sub_steps);
      elsif (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object') then
        v_sub_steps := jsonb_build_array(v_step->'subStep');
        v_sub_count := 1;
      elsif (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object') then
        v_sub_steps := jsonb_build_array(v_step->'sub_step');
        v_sub_count := 1;
      end if;
    end if;

    v_has_sub := (v_sub_count > 0);

    v_sub_correct_answers := '[]'::jsonb;
    v_sub_correct_answer := null;
    if v_has_sub then
      for j in 0..(v_sub_count - 1) loop
        v_sub := v_sub_steps -> j;
        v_sub_correct_answer := public._coalesce_int(
          coalesce(
            v_sub->>'correctAnswer',
            case when jsonb_typeof(v_sub->'correct_answer') = 'number' then v_sub->>'correct_answer' else null end,
            v_sub->'correct_answer'->>'correctIndex'
          ),
          0
        );
        v_sub_correct_answers := v_sub_correct_answers || jsonb_build_array(v_sub_correct_answer);
      end loop;

      v_sub_correct_answer := case
        when jsonb_typeof(v_sub_correct_answers->0) = 'number' then (v_sub_correct_answers->>0)::int
        else null
      end;
    end if;

    select
      max(case when player_id = v_match.player1_id and segment = 'main' and sub_step_index = 0 then selected_option end),
      max(case when player_id = v_match.player2_id and segment = 'main' and sub_step_index = 0 then selected_option end),
      max(case when player_id = v_match.player1_id and segment = 'sub' and sub_step_index = 0 then selected_option end),
      max(case when player_id = v_match.player2_id and segment = 'sub' and sub_step_index = 0 then selected_option end),
      bool_or(case when player_id = v_match.player1_id and segment = 'main' and sub_step_index = 0 then is_correct else false end),
      bool_or(case when player_id = v_match.player2_id and segment = 'main' and sub_step_index = 0 then is_correct else false end),
      coalesce(sum(case when player_id = v_match.player1_id and segment = 'sub' and sub_step_index >= 0 and sub_step_index < v_sub_count and is_correct then 1 else 0 end), 0),
      coalesce(sum(case when player_id = v_match.player2_id and segment = 'sub' and sub_step_index >= 0 and sub_step_index < v_sub_count and is_correct then 1 else 0 end), 0)
    into
      v_p1_main_answer,
      v_p2_main_answer,
      v_p1_sub_answer,
      v_p2_sub_answer,
      v_p1_main_correct,
      v_p2_main_correct,
      v_p1_sub_correct_count,
      v_p2_sub_correct_count
    from public.match_step_answers_v2
    where match_id = p_match_id
      and round_index = v_round_index
      and question_id = v_round.question_id
      and step_index = i
      and (
        (segment = 'main' and sub_step_index = 0)
        or (segment = 'sub' and sub_step_index >= 0 and sub_step_index < v_sub_count)
      );

    v_p1_sub_correct := case when v_has_sub then (v_p1_sub_correct_count = v_sub_count) else null end;
    v_p2_sub_correct := case when v_has_sub then (v_p2_sub_correct_count = v_sub_count) else null end;

    v_p1_sub_points := v_p1_sub_points + coalesce(v_p1_sub_correct_count, 0);
    v_p2_sub_points := v_p2_sub_points + coalesce(v_p2_sub_correct_count, 0);

    v_p1_sub_answers := '[]'::jsonb;
    v_p2_sub_answers := '[]'::jsonb;
    if v_has_sub then
      select jsonb_agg(a.selected_option order by gs.idx)
      into v_p1_sub_answers
      from generate_series(0, v_sub_count - 1) as gs(idx)
      left join public.match_step_answers_v2 a
        on a.match_id = p_match_id
       and a.round_index = v_round_index
       and a.question_id = v_round.question_id
       and a.step_index = i
       and a.segment = 'sub'
       and a.sub_step_index = gs.idx
       and a.player_id = v_match.player1_id;

      select jsonb_agg(a.selected_option order by gs.idx)
      into v_p2_sub_answers
      from generate_series(0, v_sub_count - 1) as gs(idx)
      left join public.match_step_answers_v2 a
        on a.match_id = p_match_id
       and a.round_index = v_round_index
       and a.question_id = v_round.question_id
       and a.step_index = i
       and a.segment = 'sub'
       and a.sub_step_index = gs.idx
       and a.player_id = v_match.player2_id;
    end if;

    v_p1_part_correct := coalesce(v_p1_main_correct, false) and (case when v_has_sub then coalesce(v_p1_sub_correct, false) else true end);
    v_p2_part_correct := coalesce(v_p2_main_correct, false) and (case when v_has_sub then coalesce(v_p2_sub_correct, false) else true end);

    if v_p1_part_correct then v_p1_parts_correct := v_p1_parts_correct + 1; end if;
    if v_p2_part_correct then v_p2_parts_correct := v_p2_parts_correct + 1; end if;

    v_p1_step_awarded := case when v_p1_part_correct then v_marks else 0 end;
    v_p2_step_awarded := case when v_p2_part_correct then v_marks else 0 end;

    v_p1_marks_points := v_p1_marks_points + coalesce(v_p1_step_awarded, 0);
    v_p2_marks_points := v_p2_marks_points + coalesce(v_p2_step_awarded, 0);

    v_step_results := v_step_results || jsonb_build_array(
      jsonb_build_object(
        'stepIndex', i,
        'marks', v_marks,
        'hasSubSteps', v_has_sub,
        'totalSubSteps', v_sub_count,
        'subCorrectAnswers', v_sub_correct_answers,
        'p1SubAnswerIndices', v_p1_sub_answers,
        'p2SubAnswerIndices', v_p2_sub_answers,
        'hasSubStep', v_has_sub,
        'subCorrectAnswer', v_sub_correct_answer,
        'p1SubAnswerIndex', case
          when v_has_sub and jsonb_typeof(v_p1_sub_answers->0) = 'number' then (v_p1_sub_answers->>0)::int
          else null
        end,
        'p2SubAnswerIndex', case
          when v_has_sub and jsonb_typeof(v_p2_sub_answers->0) = 'number' then (v_p2_sub_answers->>0)::int
          else null
        end,
        'mainCorrectAnswer', v_main_correct_answer,
        'p1MainAnswerIndex', v_p1_main_answer,
        'p2MainAnswerIndex', v_p2_main_answer,
        'p1PartCorrect', v_p1_part_correct,
        'p2PartCorrect', v_p2_part_correct,
        'p1StepAwarded', v_p1_step_awarded,
        'p2StepAwarded', v_p2_step_awarded
      )
    );
  end loop;

  v_p1_round_points := coalesce(v_p1_marks_points, 0) + coalesce(v_p1_sub_points, 0);
  v_p2_round_points := coalesce(v_p2_marks_points, 0) + coalesce(v_p2_sub_points, 0);

  if v_p1_round_points > v_p2_round_points then
    v_round_winner := v_match.player1_id;
  elsif v_p2_round_points > v_p1_round_points then
    v_round_winner := v_match.player2_id;
  else
    v_round_winner := null;
  end if;

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
    'total_parts', v_step_count,
    'p1_parts_correct', v_p1_parts_correct,
    'p2_parts_correct', v_p2_parts_correct,
    'p1_sub_points', v_p1_sub_points,
    'p2_sub_points', v_p2_sub_points,
    'p1_round_points', v_p1_round_points,
    'p2_round_points', v_p2_round_points,
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

-- ----------------------------------------------------------------------------
-- Restore force_timeout_stage3 (no durable per-round results)
-- ----------------------------------------------------------------------------
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
