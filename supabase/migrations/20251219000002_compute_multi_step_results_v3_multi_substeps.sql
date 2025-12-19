-- 20251219000002_compute_multi_step_results_v3_multi_substeps.sql
-- Extend compute_multi_step_results_v3 to support multiple sub-steps per step:
-- - Step JSON can define either:
--   - subSteps: [ { ... }, { ... }, ... ]   (preferred)
--   - subStep: { ... } / sub_step: { ... }  (legacy, treated as subSteps length=1)
-- - Sub-step answers are stored in match_step_answers_v2 with:
--   segment='sub' and sub_step_index=0..n-1
-- - A step/part is correct only if:
--   main segment is correct AND ALL sub-step segments are correct (if any exist)
-- - Draw rules and sudden-death rules are preserved from 20251219000000

begin;

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

  v_p1_parts_correct int := 0;
  v_p2_parts_correct int := 0;

  v_p1_wins int;
  v_p2_wins int;
  v_target_rounds_to_win int;
  v_finished boolean := false;
  v_round_winner uuid;
  v_match_winner uuid := null;

  -- Per-step answer aggregates (legacy single-value fields kept for UI compatibility)
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

    -- Correct answers (main). We support both correctAnswer and correct_answer.correctIndex
    v_main_correct_answer := public._coalesce_int(
      coalesce(
        v_step->>'correctAnswer',
        case when jsonb_typeof(v_step->'correct_answer') = 'number' then v_step->>'correct_answer' else null end,
        v_step->'correct_answer'->>'correctIndex'
      ),
      0
    );

    -- Normalize subSteps (preferred) / legacy subStep (object) into an array
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

    -- Build sub correct answer array (one per sub-step)
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

      -- Legacy single value: first sub-step correct answer
      v_sub_correct_answer := case
        when jsonb_typeof(v_sub_correct_answers->0) = 'number' then (v_sub_correct_answers->>0)::int
        else null
      end;
    end if;

    -- Aggregate answers for this step (main + first sub for legacy) and count correct sub-answers
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

    -- Sub correctness means ALL sub-steps correct (if any exist)
    v_p1_sub_correct := case when v_has_sub then (v_p1_sub_correct_count = v_sub_count) else null end;
    v_p2_sub_correct := case when v_has_sub then (v_p2_sub_correct_count = v_sub_count) else null end;

    -- Build per-player sub answer arrays aligned to sub_step_index (includes nulls for missing/timeouts)
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

    v_step_results := v_step_results || jsonb_build_array(
      jsonb_build_object(
        'stepIndex', i,
        'marks', v_marks,
        -- New multi-sub fields
        'hasSubSteps', v_has_sub,
        'totalSubSteps', v_sub_count,
        'subCorrectAnswers', v_sub_correct_answers,
        'p1SubAnswerIndices', v_p1_sub_answers,
        'p2SubAnswerIndices', v_p2_sub_answers,
        -- Legacy fields kept (single-sub UI)
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
        -- Main fields
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

commit;


