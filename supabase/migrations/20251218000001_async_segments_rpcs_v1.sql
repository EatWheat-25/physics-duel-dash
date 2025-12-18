-- 20251218000001_async_segments_rpcs_v1.sql
-- V1: Transactional RPCs for async segment progression (main/sub) per player.
-- Non-negotiables enforced here:
-- - serialized updates via advisory xact locks
-- - server-side timeout enforcement via segment_ends_at
-- - sub-step treated as a segment inside a step (not an extra step)

begin;

-- Utility: safely coerce to int with a default
create or replace function public._coalesce_int(p_text text, p_default int)
returns int
language sql
immutable
as $$
  select coalesce(nullif(trim(p_text), '')::int, p_default);
$$;

grant execute on function public._coalesce_int(text, int) to service_role;

-- Initialize progress rows for the active round (idempotent; does not reset timers)
create or replace function public.init_round_progress_v1(
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
  v_round_index int;
  v_now timestamptz := now();
  v_initial_seconds int := 15;
begin
  -- Serialize init per match/round
  perform pg_advisory_xact_lock(hashtext(p_match_id::text || ':' || p_round_id::text)::bigint);

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

  select *
  into v_round
  from public.match_rounds
  where id = p_round_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'round_not_found');
  end if;

  v_round_index := greatest(0, coalesce(v_match.current_round_number, 1) - 1);

  -- Insert progress rows (do not reset if already present)
  if v_match.player1_id is not null then
    insert into public.match_round_player_progress_v1 (
      match_id, round_id, round_index, question_id, player_id,
      current_step_index, current_segment, segment_ends_at
    )
    values (
      p_match_id, p_round_id, v_round_index, v_round.question_id, v_match.player1_id,
      0, 'main', v_now + make_interval(secs => v_initial_seconds)
    )
    on conflict (match_id, round_id, player_id) do nothing;
  end if;

  if v_match.player2_id is not null then
    insert into public.match_round_player_progress_v1 (
      match_id, round_id, round_index, question_id, player_id,
      current_step_index, current_segment, segment_ends_at
    )
    values (
      p_match_id, p_round_id, v_round_index, v_round.question_id, v_match.player2_id,
      0, 'main', v_now + make_interval(secs => v_initial_seconds)
    )
    on conflict (match_id, round_id, player_id) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'round_index', v_round_index
  );
end;
$$;

grant execute on function public.init_round_progress_v1(uuid, uuid) to service_role;

-- Submit one segment answer and advance the caller's progress atomically.
-- NOTE: correctness is provided by server (Edge Function) via service_role.
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
  v_has_sub boolean := false;

  v_next_step_index int;
  v_next_segment text;
  v_next_seconds int;
begin
  if p_step_index < 0 or p_step_index > 3 then
    return jsonb_build_object('success', false, 'error', 'invalid_step_index');
  end if;

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

  -- Ensure progress row exists (idempotent, does not reset existing timers)
  insert into public.match_round_player_progress_v1 (
    match_id, round_id, round_index, question_id, player_id,
    current_step_index, current_segment, segment_ends_at
  )
  values (
    p_match_id, p_round_id, v_round_index, v_round.question_id, p_player_id,
    0, 'main', v_now + make_interval(secs => 15)
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
      'segmentEndsAt', v_progress.segment_ends_at
    );
  end if;

  -- Out-of-sync / double-submit protection: do not mutate, return canonical state for resync
  if v_progress.current_step_index <> p_step_index or v_progress.current_segment <> p_segment then
    return jsonb_build_object(
      'success', true,
      'out_of_sync', true,
      'completed', false,
      'canonical', jsonb_build_object(
        'stepIndex', v_progress.current_step_index,
        'segment', v_progress.current_segment,
        'segmentEndsAt', v_progress.segment_ends_at
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
    step_index, segment, selected_option, is_correct, response_time_ms, answered_at
  )
  values (
    p_match_id, v_round_index, v_round.question_id, p_player_id,
    p_step_index, p_segment,
    case when v_timed_out then null else p_answer_index end,
    case when v_timed_out then false else coalesce(p_is_correct, false) end,
    0,
    v_now
  )
  on conflict (match_id, round_index, player_id, question_id, step_index, segment) do nothing;

  -- Load question steps to decide if this step has a sub segment and to set timer seconds
  select q.steps
  into v_steps
  from public.questions_v2 q
  where q.id = v_round.question_id;

  if jsonb_typeof(v_steps) = 'array' then
    v_step := v_steps -> p_step_index;
  else
    v_step := null;
  end if;

  v_has_sub := (
    v_step is not null
    and (
      (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object')
      or (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object')
    )
  );

  -- Determine next segment/step
  if p_segment = 'main' and v_has_sub then
    v_next_step_index := p_step_index;
    v_next_segment := 'sub';
    v_next_seconds := public._coalesce_int(
      coalesce(
        (v_step->'subStep'->>'timeLimitSeconds'),
        (v_step->'sub_step'->>'timeLimitSeconds'),
        (v_step->'subStep'->>'time_limit_seconds'),
        (v_step->'sub_step'->>'time_limit_seconds')
      ),
      5
    );
  else
    if p_step_index >= 3 then
      -- Completed the last segment of the last step
      update public.match_round_player_progress_v1
      set
        completed_at = v_now,
        segment_ends_at = null,
        updated_at = v_now
      where id = v_progress.id;

      return jsonb_build_object(
        'success', true,
        'timed_out', v_timed_out,
        'completed', true
      );
    end if;

    v_next_step_index := p_step_index + 1;
    v_next_segment := 'main';
    v_next_seconds := 15;

    if jsonb_typeof(v_steps) = 'array' then
      v_step := v_steps -> v_next_step_index;
      v_next_seconds := public._coalesce_int(
        coalesce(
          v_step->>'timeLimitSeconds',
          v_step->>'time_limit_seconds'
        ),
        15
      );
    end if;
  end if;

  update public.match_round_player_progress_v1
  set
    current_step_index = v_next_step_index,
    current_segment = v_next_segment,
    segment_ends_at = v_now + make_interval(secs => v_next_seconds),
    updated_at = v_now
  where id = v_progress.id;

  return jsonb_build_object(
    'success', true,
    'timed_out', v_timed_out,
    'completed', false,
    'next', jsonb_build_object(
      'stepIndex', v_next_step_index,
      'segment', v_next_segment,
      'segmentEndsAt', (v_now + make_interval(secs => v_next_seconds))
    )
  );
end;
$$;

grant execute on function public.submit_segment_v1(uuid, uuid, uuid, int, text, int, boolean) to service_role;

-- Auto-advance overdue segments for both players.
-- - If now() > segment_ends_at, auto-submit as wrong and advance immediately.
-- - If the round exceeds a computed max duration (sum of segment limits), force-complete remaining segments as wrong.
create or replace function public.auto_advance_overdue_segments_v1(
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
  v_round_index int;
  v_now timestamptz := now();

  v_steps jsonb;
  i int;
  v_total_seconds int := 0;
  v_deadline timestamptz;
  v_force boolean := false;

  v_progress public.match_round_player_progress_v1%rowtype;
  v_player uuid;

  v_step jsonb;
  v_has_sub boolean;
  v_next_step_index int;
  v_next_segment text;
  v_next_seconds int;

  v_completed_count int := 0;
begin
  -- Serialize sweeps per match/round
  perform pg_advisory_xact_lock(hashtext(p_match_id::text || ':' || p_round_id::text || ':sweep')::bigint);

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

  select *
  into v_round
  from public.match_rounds
  where id = p_round_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'round_not_found');
  end if;

  v_round_index := greatest(0, coalesce(v_match.current_round_number, 1) - 1);

  -- Ensure progress rows exist (idempotent)
  perform public.init_round_progress_v1(p_match_id, p_round_id);

  -- Load steps to compute max round duration (anti-stall)
  select q.steps
  into v_steps
  from public.questions_v2 q
  where q.id = v_round.question_id;

  if jsonb_typeof(v_steps) = 'array' then
    for i in 0..3 loop
      v_step := v_steps -> i;
      v_total_seconds := v_total_seconds + public._coalesce_int(
        coalesce(v_step->>'timeLimitSeconds', v_step->>'time_limit_seconds'),
        15
      );

      v_has_sub := (
        v_step is not null
        and (
          (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object')
          or (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object')
        )
      );

      if v_has_sub then
        v_total_seconds := v_total_seconds + public._coalesce_int(
          coalesce(
            (v_step->'subStep'->>'timeLimitSeconds'),
            (v_step->'sub_step'->>'timeLimitSeconds'),
            (v_step->'subStep'->>'time_limit_seconds'),
            (v_step->'sub_step'->>'time_limit_seconds')
          ),
          5
        );
      end if;
    end loop;
  else
    -- fallback: 4 main segments at 15s
    v_total_seconds := 60;
  end if;

  -- Small buffer to avoid edge timing jitter
  v_deadline := v_round.created_at + make_interval(secs => (v_total_seconds + 3));
  v_force := v_now > v_deadline;

  -- Sweep both players
  foreach v_player in array array[v_match.player1_id, v_match.player2_id]
  loop
    if v_player is null then
      continue;
    end if;

    select *
    into v_progress
    from public.match_round_player_progress_v1
    where match_id = p_match_id
      and round_id = p_round_id
      and player_id = v_player
    for update;

    if not found then
      continue;
    end if;

    -- Advance overdue segments (or force-complete everything once deadline exceeded)
    while v_progress.completed_at is null loop
      if not v_force and v_progress.segment_ends_at is not null and v_now <= v_progress.segment_ends_at then
        exit;
      end if;

      -- Auto-submit this segment as wrong (timeout/no answer). Idempotent insert.
      insert into public.match_step_answers_v2 (
        match_id, round_index, question_id, player_id,
        step_index, segment, selected_option, is_correct, response_time_ms, answered_at
      )
      values (
        p_match_id, v_round_index, v_round.question_id, v_player,
        v_progress.current_step_index, v_progress.current_segment,
        null, false, 0, v_now
      )
      on conflict (match_id, round_index, player_id, question_id, step_index, segment) do nothing;

      -- Determine if current step has sub segment
      v_has_sub := false;
      if jsonb_typeof(v_steps) = 'array' then
        v_step := v_steps -> v_progress.current_step_index;
        v_has_sub := (
          v_step is not null
          and (
            (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object')
            or (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object')
          )
        );
      end if;

      if v_progress.current_segment = 'main' and v_has_sub then
        v_next_step_index := v_progress.current_step_index;
        v_next_segment := 'sub';
        v_next_seconds := public._coalesce_int(
          coalesce(
            (v_step->'subStep'->>'timeLimitSeconds'),
            (v_step->'sub_step'->>'timeLimitSeconds'),
            (v_step->'subStep'->>'time_limit_seconds'),
            (v_step->'sub_step'->>'time_limit_seconds')
          ),
          5
        );
      else
        if v_progress.current_step_index >= 3 then
          update public.match_round_player_progress_v1
          set
            completed_at = v_now,
            segment_ends_at = null,
            updated_at = v_now
          where id = v_progress.id;

          -- Keep local row in sync so completion counters are correct
          v_progress.completed_at := v_now;
          v_progress.segment_ends_at := null;
          exit;
        end if;

        v_next_step_index := v_progress.current_step_index + 1;
        v_next_segment := 'main';
        v_next_seconds := 15;

        if jsonb_typeof(v_steps) = 'array' then
          v_step := v_steps -> v_next_step_index;
          v_next_seconds := public._coalesce_int(
            coalesce(v_step->>'timeLimitSeconds', v_step->>'time_limit_seconds'),
            15
          );
        end if;
      end if;

      update public.match_round_player_progress_v1
      set
        current_step_index = v_next_step_index,
        current_segment = v_next_segment,
        segment_ends_at = case
          when v_force then v_now
          else v_now + make_interval(secs => v_next_seconds)
        end,
        updated_at = v_now
      where id = v_progress.id;

      -- Refresh local row for possible multi-advance
      select *
      into v_progress
      from public.match_round_player_progress_v1
      where id = v_progress.id;
    end loop;

    if v_progress.completed_at is not null then
      v_completed_count := v_completed_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'forced', v_force,
    'completed_count', v_completed_count
  );
end;
$$;

grant execute on function public.auto_advance_overdue_segments_v1(uuid, uuid) to service_role;

commit;


