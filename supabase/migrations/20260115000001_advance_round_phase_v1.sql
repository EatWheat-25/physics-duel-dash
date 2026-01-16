-- 20260115000001_advance_round_phase_v1.sql
-- Idempotent phase advance with phase_seq guard (server-only).

begin;

create or replace function public.advance_round_phase_v1(
  p_match_id uuid,
  p_round_id uuid,
  p_expected_phase_seq int,
  p_client_seen_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.match_rounds%rowtype;
  v_match public.matches%rowtype;
  v_now timestamptz := now();
  v_phase text;
  v_next_phase text;
  v_next_ends_at timestamptz;
  v_new_seq int;
  v_results jsonb;
  v_results_round_id uuid;
  v_steps jsonb;
  v_step jsonb;
  v_sub jsonb;
  v_step_count int := 0;
  v_sub_count int := 0;
  v_total_seconds int := 0;
  v_first_step_seconds int := 15;
  v_first_step_ends_at timestamptz;
  v_progress_total int := 0;
  v_progress_done int := 0;
  v_has_sub boolean := false;
  i int;
  j int;
begin
  -- Lock round row
  select *
  into v_round
  from public.match_rounds
  where id = p_round_id
    and match_id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'round_not_found');
  end if;

  v_phase := coalesce(v_round.phase, v_round.status, 'main');

  if v_round.phase_seq <> p_expected_phase_seq then
    return jsonb_build_object(
      'success', false,
      'error', 'phase_seq_mismatch',
      'phase', v_phase,
      'phase_seq', v_round.phase_seq,
      'ends_at', v_round.ends_at
    );
  end if;

  -- Lock match row (needed for results and validation)
  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'match_not_found');
  end if;

  if v_match.current_round_id is null or v_match.current_round_id <> p_round_id then
    return jsonb_build_object('success', false, 'error', 'round_id_mismatch');
  end if;

  v_results := v_match.results_payload;
  v_results_round_id := v_match.results_round_id;

  -- ===== Phase: main =====
  if v_phase = 'main' then
    -- If results already computed (single-step), advance immediately.
    if v_results is not null and v_results_round_id = p_round_id then
      v_next_phase := 'results';
      v_next_ends_at := v_now + make_interval(secs => 10);
      v_new_seq := v_round.phase_seq + 1;

      update public.match_rounds
      set
        phase = v_next_phase,
        status = v_next_phase,
        phase_seq = v_new_seq,
        phase_started_at = v_now,
        ends_at = v_next_ends_at
      where id = p_round_id;

      return jsonb_build_object(
        'success', true,
        'advanced', true,
        'phase', v_next_phase,
        'phase_seq', v_new_seq,
        'ends_at', v_next_ends_at,
        'reason', 'results_ready'
      );
    end if;

    -- Not due yet
    if v_round.ends_at is not null and v_now < v_round.ends_at then
      return jsonb_build_object(
        'success', true,
        'advanced', false,
        'phase', v_phase,
        'phase_seq', v_round.phase_seq,
        'ends_at', v_round.ends_at,
        'reason', 'not_due'
      );
    end if;

    -- Load steps to determine whether this is multi-step.
    select q.steps
    into v_steps
    from public.questions_v2 q
    where q.id = v_round.question_id;

    if jsonb_typeof(v_steps) = 'array' then
      v_step_count := jsonb_array_length(v_steps);
    else
      v_step_count := 0;
    end if;

    if v_step_count > 0 then
      v_step := v_steps -> 0;
      v_has_sub := (
        v_step is not null
        and (
          (v_step ? 'subSteps' and jsonb_typeof(v_step->'subSteps') = 'array')
          or (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object')
          or (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object')
        )
      );
    else
      v_has_sub := false;
    end if;

    -- If multi-step, transition to steps; otherwise force timeout and go to results.
    if v_step_count > 1 or v_has_sub then
      -- Ensure progress rows exist (idempotent)
      perform public.init_round_progress_v1(p_match_id, p_round_id);

      -- Compute total step time (sum of step + sub-step durations)
      v_total_seconds := 0;
      for i in 0..(v_step_count - 1) loop
        v_step := v_steps -> i;
        v_total_seconds := v_total_seconds + public._coalesce_int(
          coalesce(v_step->>'timeLimitSeconds', v_step->>'time_limit_seconds'),
          15
        );

        v_sub_count := 0;
        if v_step ? 'subSteps' and jsonb_typeof(v_step->'subSteps') = 'array' then
          v_sub_count := jsonb_array_length(v_step->'subSteps');
          for j in 0..(v_sub_count - 1) loop
            v_sub := v_step->'subSteps'->j;
            v_total_seconds := v_total_seconds + public._coalesce_int(
              coalesce(v_sub->>'timeLimitSeconds', v_sub->>'time_limit_seconds'),
              15
            );
          end loop;
        elsif v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object' then
          v_total_seconds := v_total_seconds + public._coalesce_int(
            coalesce(
              v_step->'subStep'->>'timeLimitSeconds',
              v_step->'subStep'->>'time_limit_seconds'
            ),
            15
          );
        elsif v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object' then
          v_total_seconds := v_total_seconds + public._coalesce_int(
            coalesce(
              v_step->'sub_step'->>'timeLimitSeconds',
              v_step->'sub_step'->>'time_limit_seconds'
            ),
            15
          );
        end if;
      end loop;

      -- Seed step 0 timer for all players still in main sentinel.
      v_first_step_seconds := public._coalesce_int(
        coalesce((v_steps->0)->>'timeLimitSeconds', (v_steps->0)->>'time_limit_seconds'),
        15
      );
      v_first_step_ends_at := v_now + make_interval(secs => v_first_step_seconds);

      update public.match_round_player_progress_v1
      set
        current_step_index = 0,
        current_segment = 'main',
        current_sub_step_index = 0,
        segment_ends_at = v_first_step_ends_at,
        updated_at = v_now
      where match_id = p_match_id
        and round_id = p_round_id
        and current_step_index < 0;

      v_next_phase := 'steps';
      v_next_ends_at := v_now + make_interval(secs => (v_total_seconds + 3));
      v_new_seq := v_round.phase_seq + 1;

      update public.match_rounds
      set
        phase = v_next_phase,
        status = v_next_phase,
        phase_seq = v_new_seq,
        phase_started_at = v_now,
        ends_at = v_next_ends_at,
        current_step_index = 0,
        step_ends_at = null
      where id = p_round_id;

      return jsonb_build_object(
        'success', true,
        'advanced', true,
        'phase', v_next_phase,
        'phase_seq', v_new_seq,
        'ends_at', v_next_ends_at,
        'reason', 'main_timeout_to_steps'
      );
    end if;

    -- Single-step timeout: compute results via force_timeout_stage3 (if available)
    if to_regprocedure('public.force_timeout_stage3(uuid)') is not null then
      perform public.force_timeout_stage3(p_match_id);
    else
      return jsonb_build_object('success', false, 'error', 'force_timeout_stage3_missing');
    end if;

    -- Reload results after timeout
    select results_payload, results_round_id
    into v_results, v_results_round_id
    from public.matches
    where id = p_match_id;

    if v_results is not null and v_results_round_id = p_round_id then
      v_next_phase := 'results';
      v_next_ends_at := v_now + make_interval(secs => 10);
      v_new_seq := v_round.phase_seq + 1;

      update public.match_rounds
      set
        phase = v_next_phase,
        status = v_next_phase,
        phase_seq = v_new_seq,
        phase_started_at = v_now,
        ends_at = v_next_ends_at
      where id = p_round_id;

      return jsonb_build_object(
        'success', true,
        'advanced', true,
        'phase', v_next_phase,
        'phase_seq', v_new_seq,
        'ends_at', v_next_ends_at,
        'reason', 'timeout_results'
      );
    end if;

    return jsonb_build_object('success', false, 'error', 'results_missing_after_timeout');
  end if;

  -- ===== Phase: steps =====
  if v_phase = 'steps' then
    -- If results already computed, advance to results.
    if v_results is not null and v_results_round_id = p_round_id then
      v_next_phase := 'results';
      v_next_ends_at := v_now + make_interval(secs => 10);
      v_new_seq := v_round.phase_seq + 1;

      update public.match_rounds
      set
        phase = v_next_phase,
        status = v_next_phase,
        phase_seq = v_new_seq,
        phase_started_at = v_now,
        ends_at = v_next_ends_at
      where id = p_round_id;

      return jsonb_build_object(
        'success', true,
        'advanced', true,
        'phase', v_next_phase,
        'phase_seq', v_new_seq,
        'ends_at', v_next_ends_at,
        'reason', 'results_ready'
      );
    end if;

    -- Check if both players completed
    select count(*) into v_progress_total
    from public.match_round_player_progress_v1
    where match_id = p_match_id
      and round_id = p_round_id;

    select count(*) into v_progress_done
    from public.match_round_player_progress_v1
    where match_id = p_match_id
      and round_id = p_round_id
      and completed_at is not null;

    if v_progress_total > 0 and v_progress_done = v_progress_total then
      if to_regprocedure('public.compute_multi_step_results_v3(uuid, uuid)') is not null then
        perform public.compute_multi_step_results_v3(p_match_id, p_round_id);
      end if;
    end if;

    -- Reload results after compute attempt
    select results_payload, results_round_id
    into v_results, v_results_round_id
    from public.matches
    where id = p_match_id;

    if v_results is not null and v_results_round_id = p_round_id then
      v_next_phase := 'results';
      v_next_ends_at := v_now + make_interval(secs => 10);
      v_new_seq := v_round.phase_seq + 1;

      update public.match_rounds
      set
        phase = v_next_phase,
        status = v_next_phase,
        phase_seq = v_new_seq,
        phase_started_at = v_now,
        ends_at = v_next_ends_at
      where id = p_round_id;

      return jsonb_build_object(
        'success', true,
        'advanced', true,
        'phase', v_next_phase,
        'phase_seq', v_new_seq,
        'ends_at', v_next_ends_at,
        'reason', 'steps_completed'
      );
    end if;

    -- Not due yet
    if v_round.ends_at is not null and v_now < v_round.ends_at then
      return jsonb_build_object(
        'success', true,
        'advanced', false,
        'phase', v_phase,
        'phase_seq', v_round.phase_seq,
        'ends_at', v_round.ends_at,
        'reason', 'not_due'
      );
    end if;

    -- Force overdue segments, then compute results
    if to_regprocedure('public.auto_advance_overdue_segments_v1(uuid, uuid, boolean)') is not null then
      perform public.auto_advance_overdue_segments_v1(p_match_id, p_round_id, true);
    end if;
    if to_regprocedure('public.compute_multi_step_results_v3(uuid, uuid)') is not null then
      perform public.compute_multi_step_results_v3(p_match_id, p_round_id);
    end if;

    select results_payload, results_round_id
    into v_results, v_results_round_id
    from public.matches
    where id = p_match_id;

    if v_results is not null and v_results_round_id = p_round_id then
      v_next_phase := 'results';
      v_next_ends_at := v_now + make_interval(secs => 10);
      v_new_seq := v_round.phase_seq + 1;

      update public.match_rounds
      set
        phase = v_next_phase,
        status = v_next_phase,
        phase_seq = v_new_seq,
        phase_started_at = v_now,
        ends_at = v_next_ends_at
      where id = p_round_id;

      return jsonb_build_object(
        'success', true,
        'advanced', true,
        'phase', v_next_phase,
        'phase_seq', v_new_seq,
        'ends_at', v_next_ends_at,
        'reason', 'forced_timeout'
      );
    end if;

    return jsonb_build_object('success', false, 'error', 'results_missing_after_force');
  end if;

  -- ===== Phase: results =====
  if v_phase = 'results' then
    if v_round.ends_at is not null and v_now < v_round.ends_at then
      return jsonb_build_object(
        'success', true,
        'advanced', false,
        'phase', v_phase,
        'phase_seq', v_round.phase_seq,
        'ends_at', v_round.ends_at,
        'reason', 'not_due'
      );
    end if;

    v_next_phase := 'done';
    v_new_seq := v_round.phase_seq + 1;

    update public.match_rounds
    set
      phase = v_next_phase,
      status = v_next_phase,
      phase_seq = v_new_seq,
      phase_started_at = v_now,
      ends_at = null
    where id = p_round_id;

    return jsonb_build_object(
      'success', true,
      'advanced', true,
      'phase', v_next_phase,
      'phase_seq', v_new_seq,
      'ends_at', null,
      'reason', 'results_done'
    );
  end if;

  -- ===== Phase: done or unknown =====
  return jsonb_build_object(
    'success', true,
    'advanced', false,
    'phase', v_phase,
    'phase_seq', v_round.phase_seq,
    'ends_at', v_round.ends_at,
    'reason', 'no_transition'
  );
end;
$$;

grant execute on function public.advance_round_phase_v1(uuid, uuid, int, timestamptz) to service_role;

commit;
