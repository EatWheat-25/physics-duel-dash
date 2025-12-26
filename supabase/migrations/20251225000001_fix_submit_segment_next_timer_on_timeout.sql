-- 20251225000001_fix_submit_segment_next_timer_on_timeout.sql
-- Fix: When a player submits after a segment timed out, we still advance them,
-- but the NEXT segment must get a real timer window (now + next_seconds).
--
-- Previously, submit_segment_v1 set segment_ends_at = now() when v_timed_out=true.
-- That makes the next segment immediately overdue, which can chain-skip sub-steps/steps
-- and looks like a random desync for the slower player.

begin;

create or replace function public.submit_segment_v1(
  p_match_id uuid,
  p_round_id uuid,
  p_player_id uuid,
  p_step_index int,
  p_segment text,
  p_answer_index int,
  p_is_correct boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_round public.match_rounds%rowtype;
  v_progress public.match_round_player_progress_v1%rowtype;
  v_round_index int;
  v_now timestamptz := now();
  v_timed_out boolean := false;

  v_steps jsonb;
  v_step jsonb;
  v_step_count int := 0;
  v_last_step_index int := -1;
  v_sub_count int := 0;

  v_next_step_index int;
  v_next_segment text;
  v_next_sub_index int;
  v_next_seconds int;
  v_next_sub jsonb;
begin
  if p_segment not in ('main','sub') then
    return jsonb_build_object('success', false, 'error', 'invalid_segment');
  end if;

  -- Serialize per match/round/player to prevent double-submits breaking progression
  perform pg_advisory_xact_lock(hashtext(p_match_id::text || ':' || p_round_id::text || ':' || p_player_id::text)::bigint);

  select *
  into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'match_not_found');
  end if;

  if v_match.current_round_id is null or v_match.current_round_id <> p_round_id then
    return jsonb_build_object('success', false, 'error', 'round_id_mismatch');
  end if;

  if p_player_id <> v_match.player1_id and p_player_id <> v_match.player2_id then
    return jsonb_build_object('success', false, 'error', 'not_in_match');
  end if;

  select *
  into v_round
  from public.match_rounds
  where id = p_round_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'round_not_found');
  end if;

  v_round_index := greatest(0, coalesce(v_match.current_round_number, 1) - 1);

  -- Load question steps and validate step bounds
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
  v_last_step_index := v_step_count - 1;

  if p_step_index < 0 or p_step_index > v_last_step_index then
    return jsonb_build_object('success', false, 'error', 'invalid_step_index');
  end if;

  -- Ensure progress row exists (idempotent, does not reset existing timers)
  insert into public.match_round_player_progress_v1 (
    match_id, round_id, round_index, question_id, player_id,
    current_step_index, current_segment, current_sub_step_index, segment_ends_at
  )
  values (
    p_match_id, p_round_id, v_round_index, v_round.question_id, p_player_id,
    0, 'main', 0, v_now + make_interval(secs => 15)
  )
  on conflict (match_id, round_id, player_id) do nothing;

  -- Lock the progress row for update
  select *
  into v_progress
  from public.match_round_player_progress_v1
  where match_id = p_match_id
    and round_id = p_round_id
    and player_id = p_player_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'progress_not_found');
  end if;

  -- If already complete, return canonical state
  if v_progress.completed_at is not null then
    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'completed', true,
      'stepIndex', v_progress.current_step_index,
      'segment', v_progress.current_segment,
      'segmentEndsAt', v_progress.segment_ends_at,
      'subStepIndex', v_progress.current_sub_step_index
    );
  end if;

  -- Out-of-sync protection: do not mutate; return canonical state for resync
  if v_progress.current_step_index <> p_step_index or v_progress.current_segment <> p_segment then
    return jsonb_build_object(
      'success', true,
      'out_of_sync', true,
      'completed', false,
      'canonical', jsonb_build_object(
        'stepIndex', v_progress.current_step_index,
        'segment', v_progress.current_segment,
        'segmentEndsAt', v_progress.segment_ends_at,
        'subStepIndex', v_progress.current_sub_step_index
      )
    );
  end if;

  -- Server-side timeout check
  if v_progress.segment_ends_at is not null and v_now > v_progress.segment_ends_at then
    v_timed_out := true;
  end if;

  -- Insert answer exactly once (ignore further attempts)
  insert into public.match_step_answers_v2 (
    match_id, round_index, question_id, player_id,
    step_index, segment, sub_step_index,
    selected_option, is_correct, response_time_ms, answered_at
  )
  values (
    p_match_id, v_round_index, v_round.question_id, p_player_id,
    p_step_index, p_segment,
    case when p_segment = 'sub' then coalesce(v_progress.current_sub_step_index, 0) else 0 end,
    case when v_timed_out then null else p_answer_index end,
    case when v_timed_out then false else coalesce(p_is_correct, false) end,
    0,
    v_now
  )
  on conflict (match_id, round_index, player_id, question_id, step_index, segment, sub_step_index) do nothing;

  -- Load current step JSON to decide sub-step count and timer seconds
  v_step := v_steps -> p_step_index;
  v_sub_count := 0;

  if v_step is not null then
    if (v_step ? 'subSteps' and jsonb_typeof(v_step->'subSteps') = 'array') then
      v_sub_count := jsonb_array_length(v_step->'subSteps');
    elsif (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object') then
      v_sub_count := 1;
    elsif (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object') then
      v_sub_count := 1;
    else
      v_sub_count := 0;
    end if;
  end if;

  -- Determine next segment/step
  if p_segment = 'main' and v_sub_count > 0 then
    -- Enter first sub-step
    v_next_step_index := p_step_index;
    v_next_segment := 'sub';
    v_next_sub_index := 0;

    v_next_seconds := 5;
    if (v_step ? 'subSteps' and jsonb_typeof(v_step->'subSteps') = 'array') then
      v_next_sub := v_step->'subSteps'->v_next_sub_index;
      v_next_seconds := public._coalesce_int(
        coalesce(v_next_sub->>'timeLimitSeconds', v_next_sub->>'time_limit_seconds'),
        5
      );
    else
      -- Legacy single subStep
      v_next_seconds := public._coalesce_int(
        coalesce(
          (v_step->'subStep'->>'timeLimitSeconds'),
          (v_step->'sub_step'->>'timeLimitSeconds'),
          (v_step->'subStep'->>'time_limit_seconds'),
          (v_step->'sub_step'->>'time_limit_seconds')
        ),
        5
      );
    end if;
  elsif p_segment = 'sub' and v_sub_count > 0 and (v_progress.current_sub_step_index + 1) < v_sub_count then
    -- Advance to next sub-step within the same step
    v_next_step_index := p_step_index;
    v_next_segment := 'sub';
    v_next_sub_index := v_progress.current_sub_step_index + 1;

    v_next_seconds := 5;
    if (v_step ? 'subSteps' and jsonb_typeof(v_step->'subSteps') = 'array') then
      v_next_sub := v_step->'subSteps'->v_next_sub_index;
      v_next_seconds := public._coalesce_int(
        coalesce(v_next_sub->>'timeLimitSeconds', v_next_sub->>'time_limit_seconds'),
        5
      );
    end if;
  else
    -- Move to next main step (or complete)
    if p_step_index >= v_last_step_index then
      update public.match_round_player_progress_v1
      set
        completed_at = v_now,
        segment_ends_at = null,
        updated_at = v_now
      where id = v_progress.id;

      return jsonb_build_object(
        'success', true,
        'completed', true,
        'stepIndex', v_progress.current_step_index,
        'segment', v_progress.current_segment,
        'segmentEndsAt', null,
        'subStepIndex', v_progress.current_sub_step_index
      );
    end if;

    v_next_step_index := p_step_index + 1;
    v_next_segment := 'main';
    v_next_sub_index := 0;
    v_next_seconds := public._coalesce_int(
      coalesce((v_steps->v_next_step_index)->>'timeLimitSeconds', (v_steps->v_next_step_index)->>'time_limit_seconds'),
      15
    );
  end if;

  update public.match_round_player_progress_v1
  set
    current_step_index = v_next_step_index,
    current_segment = v_next_segment,
    current_sub_step_index = v_next_sub_index,
    -- IMPORTANT: even if the current segment timed out, start a real timer for the next segment.
    segment_ends_at = v_now + make_interval(secs => v_next_seconds),
    updated_at = v_now
  where id = v_progress.id;

  return jsonb_build_object(
    'success', true,
    'completed', false,
    'stepIndex', v_next_step_index,
    'segment', v_next_segment,
    'segmentEndsAt', (select segment_ends_at from public.match_round_player_progress_v1 where id = v_progress.id),
    'subStepIndex', v_next_sub_index
  );
end;
$$;

grant execute on function public.submit_segment_v1(uuid, uuid, uuid, int, text, int, boolean) to service_role;

commit;




