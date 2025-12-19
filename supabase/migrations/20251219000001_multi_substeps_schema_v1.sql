-- 20251219000001_multi_substeps_schema_v1.sql
-- Enable multiple sub-steps per step by:
-- - Adding sub_step_index to match_step_answers_v2 (so we can store multiple 'sub' answers per step)
-- - Adding current_sub_step_index to match_round_player_progress_v1 (async segments system)
-- - Updating async segment RPCs to use sub_step_index and to treat subSteps[] as the canonical shape
--
-- Backward compatibility:
-- - If a step still uses legacy `subStep` (object), it is treated as subSteps length = 1.
-- - Existing rows default to sub_step_index = 0, which represents the single sub-step (or main segment).

begin;

-- ============================================================================
-- 1) match_step_answers_v2: add sub_step_index and update uniqueness
-- ============================================================================
do $$
declare
  v_table regclass := 'public.match_step_answers_v2'::regclass;
  r record;
  cols6 text[] := array['match_id','player_id','question_id','round_index','segment','step_index'];
  cols7 text[] := array['match_id','player_id','question_id','round_index','segment','step_index','sub_step_index'];
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_step_answers_v2'
  ) then
    return;
  end if;

  -- Ensure segment exists (older DBs)
  begin
    alter table public.match_step_answers_v2
      add column if not exists segment text not null default 'main';
  exception when others then
    null;
  end;

  -- Ensure selected_option is nullable (timeouts)
  begin
    alter table public.match_step_answers_v2
      alter column selected_option drop not null;
  exception when others then
    null;
  end;

  -- Add sub_step_index (0 = main segment OR first sub-step)
  begin
    alter table public.match_step_answers_v2
      add column if not exists sub_step_index integer not null default 0;
  exception when others then
    null;
  end;

  -- Drop legacy UNIQUE constraints/indexes that ignore sub_step_index (and/or segment)
  -- 1) Drop unique constraints matching old column sets
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = v_table
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = v_table
         and a.attnum = k.attnum
      ) in (cols6, cols7) -- we'll recreate cols7 below
  loop
    execute format('alter table public.match_step_answers_v2 drop constraint %I', r.conname);
  end loop;

  -- 2) Drop unique indexes matching old column sets (if any exist without a constraint)
  for r in
    select idx.relname as indexname
    from pg_index ix
    join pg_class idx on idx.oid = ix.indexrelid
    where ix.indrelid = v_table
      and ix.indisunique
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(ix.indkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = v_table
         and a.attnum = k.attnum
      ) in (cols6)
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;

  -- Ensure our canonical UNIQUE exists for ON CONFLICT targets
  alter table public.match_step_answers_v2
    add constraint match_step_answers_v2_unique_answer
    unique (match_id, round_index, player_id, question_id, step_index, segment, sub_step_index);

  -- Enforce: main segment always uses sub_step_index=0
  alter table public.match_step_answers_v2
    drop constraint if exists match_step_answers_v2_sub_step_index_check;

  alter table public.match_step_answers_v2
    add constraint match_step_answers_v2_sub_step_index_check
    check (
      (segment = 'main' and sub_step_index = 0)
      or
      (segment = 'sub' and sub_step_index >= 0)
    );

  create index if not exists idx_match_step_answers_v2_match_round_step_segment_sub
    on public.match_step_answers_v2(match_id, round_index, step_index, segment, sub_step_index);
end $$;

-- ============================================================================
-- 2) match_round_player_progress_v1: add current_sub_step_index
-- ============================================================================
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_round_player_progress_v1'
  ) then
    alter table public.match_round_player_progress_v1
      add column if not exists current_sub_step_index integer not null default 0;

    alter table public.match_round_player_progress_v1
      drop constraint if exists match_round_player_progress_v1_sub_index_check;

    alter table public.match_round_player_progress_v1
      add constraint match_round_player_progress_v1_sub_index_check
      check (
        (current_segment = 'main' and current_sub_step_index = 0)
        or
        (current_segment = 'sub' and current_sub_step_index >= 0)
      );
  end if;
end $$;

-- ============================================================================
-- 3) RPC: submit_segment_v1 (async segments) - update to use subSteps[] + sub_step_index
-- ============================================================================
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
  v_sub_count int := 0;

  v_next_step_index int;
  v_next_segment text;
  v_next_sub_index int;
  v_next_seconds int;
  v_next_sub jsonb;
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

  -- Out-of-sync / double-submit protection: do not mutate, return canonical state for resync
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

  -- Load question steps to decide sub-step count and to set timer seconds
  select q.steps
  into v_steps
  from public.questions_v2 q
  where q.id = v_round.question_id;

  if jsonb_typeof(v_steps) = 'array' then
    v_step := v_steps -> p_step_index;
  else
    v_step := null;
  end if;

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
    if p_step_index >= 3 then
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
    segment_ends_at = case
      when v_timed_out then v_now
      else v_now + make_interval(secs => v_next_seconds)
    end,
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

-- ============================================================================
-- 4) RPC: auto_advance_overdue_segments_v1 - update to use subSteps[] + sub_step_index
-- ============================================================================
-- NOTE: The function is originally created in 20251218000003_main_question_phase_v1.sql.
-- Here we replace it to support multi-sub-step progression.
create or replace function public.auto_advance_overdue_segments_v1(
  p_match_id uuid,
  p_round_id uuid,
  p_force boolean default false
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
  v_force boolean := coalesce(p_force, false);

  v_steps jsonb;
  v_step jsonb;
  v_sub_count int := 0;
  v_next_sub jsonb;

  v_player uuid;
  v_progress public.match_round_player_progress_v1%rowtype;

  v_next_step_index int;
  v_next_segment text;
  v_next_sub_index int;
  v_next_seconds int;
  v_completed_count int := 0;
begin
  -- Serialize per match/round
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

  select q.steps
  into v_steps
  from public.questions_v2 q
  where q.id = v_round.question_id;

  for v_player in
    select unnest(array[v_match.player1_id, v_match.player2_id])
  loop
    if v_player is null then
      continue;
    end if;

    -- Lock the progress row for update
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

    if v_progress.completed_at is not null then
      v_completed_count := v_completed_count + 1;
      continue;
    end if;

    -- Only advance if overdue (or forced)
    if not v_force and v_progress.segment_ends_at is not null and v_now <= v_progress.segment_ends_at then
      continue;
    end if;

    -- Main-question sentinel: move into step 0 without recording an answer
    if v_progress.current_step_index < 0 then
      v_next_step_index := 0;
      v_next_segment := 'main';
      v_next_sub_index := 0;
      v_next_seconds := 15;

      if jsonb_typeof(v_steps) = 'array' then
        v_step := v_steps -> 0;
        v_next_seconds := public._coalesce_int(
          coalesce(v_step->>'timeLimitSeconds', v_step->>'time_limit_seconds'),
          15
        );
      end if;

      update public.match_round_player_progress_v1
      set
        current_step_index = v_next_step_index,
        current_segment = v_next_segment,
        current_sub_step_index = v_next_sub_index,
        segment_ends_at = case
          when v_force then v_now
          else v_now + make_interval(secs => v_next_seconds)
        end,
        updated_at = v_now
      where id = v_progress.id;

      if not v_force then
        continue;
      else
        -- forced: allow multi-advance
        select *
        into v_progress
        from public.match_round_player_progress_v1
        where id = v_progress.id;
      end if;
    end if;

    -- Auto-submit this segment as wrong (timeout/no answer). Idempotent insert.
    insert into public.match_step_answers_v2 (
      match_id, round_index, question_id, player_id,
      step_index, segment, sub_step_index,
      selected_option, is_correct, response_time_ms, answered_at
    )
    values (
      p_match_id, v_round_index, v_round.question_id, v_player,
      v_progress.current_step_index, v_progress.current_segment,
      case when v_progress.current_segment = 'sub' then coalesce(v_progress.current_sub_step_index, 0) else 0 end,
      null, false, 0, v_now
    )
    on conflict (match_id, round_index, player_id, question_id, step_index, segment, sub_step_index) do nothing;

    -- Determine sub-step count for the current step
    v_sub_count := 0;
    if jsonb_typeof(v_steps) = 'array' then
      v_step := v_steps -> v_progress.current_step_index;
      if v_step is not null then
        if (v_step ? 'subSteps' and jsonb_typeof(v_step->'subSteps') = 'array') then
          v_sub_count := jsonb_array_length(v_step->'subSteps');
        elsif (v_step ? 'subStep' and jsonb_typeof(v_step->'subStep') = 'object') then
          v_sub_count := 1;
        elsif (v_step ? 'sub_step' and jsonb_typeof(v_step->'sub_step') = 'object') then
          v_sub_count := 1;
        end if;
      end if;
    end if;

    if v_progress.current_segment = 'main' and v_sub_count > 0 then
      v_next_step_index := v_progress.current_step_index;
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
    elsif v_progress.current_segment = 'sub' and v_sub_count > 0 and (v_progress.current_sub_step_index + 1) < v_sub_count then
      v_next_step_index := v_progress.current_step_index;
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
      if v_progress.current_step_index >= 3 then
        update public.match_round_player_progress_v1
        set
          completed_at = v_now,
          segment_ends_at = null,
          updated_at = v_now
        where id = v_progress.id;

        v_completed_count := v_completed_count + 1;
        continue;
      end if;

      v_next_step_index := v_progress.current_step_index + 1;
      v_next_segment := 'main';
      v_next_sub_index := 0;
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
      current_sub_step_index = v_next_sub_index,
      segment_ends_at = case
        when v_force then v_now
        else v_now + make_interval(secs => v_next_seconds)
      end,
      updated_at = v_now
    where id = v_progress.id;
  end loop;

  return jsonb_build_object(
    'success', true,
    'forced', v_force,
    'completed_count', v_completed_count
  );
end;
$$;

grant execute on function public.auto_advance_overdue_segments_v1(uuid, uuid, boolean) to service_role;

-- ============================================================================
-- 5) RPC: complete_step_v2 - ensure it counts ONLY main segment answers
-- ============================================================================
-- Without this, introducing sub_step_index would cause sub-step rows to be counted as step answers.
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

  -- count distinct player answers for this step (MAIN segment only)
  select count(distinct player_id)
  into v_answered_count
  from match_step_answers_v2
  where match_id = p_match_id
    and round_index = p_round_index
    and step_index = p_step_index
    and segment = 'main'
    and sub_step_index = 0;

  if p_force_timeout then
    -- on timeout, advance regardless
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

commit;


