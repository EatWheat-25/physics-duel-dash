-- 20260116000020_rollback_matchflow_to_20260106.sql
-- Roll back match flow + rank changes introduced after 2026-01-06.
-- Keeps question data intact.

begin;

-- ----------------------------------------------------------------------------
-- Rank system rollback (columns, tables, functions)
-- ----------------------------------------------------------------------------
drop function if exists public.reset_ranked_season_v1();
drop function if exists public.get_players_rank_public_v1(uuid[]);
drop function if exists public.points_from_outcome_accuracy_v1(text, numeric);
drop function if exists public.compute_match_accuracy_v1(uuid);
drop function if exists public._clamp_int(int, int, int);

drop table if exists public.player_rank_points_history;

alter table public.players
  drop column if exists rank_points;

alter table public.matches
  drop column if exists ranked_payload,
  drop column if exists ranked_applied_at;

-- ----------------------------------------------------------------------------
-- Match round phase sequencing rollback
-- ----------------------------------------------------------------------------
alter table public.match_rounds
  drop constraint if exists match_rounds_phase_check;

drop index if exists public.idx_match_rounds_phase_due;
drop index if exists public.idx_match_rounds_match_phase_seq;

drop trigger if exists set_updated_at_match_rounds on public.match_rounds;
drop function if exists public.set_updated_at_match_rounds();

drop trigger if exists bump_match_rounds_state_version on public.match_rounds;
drop function if exists public.bump_match_rounds_state_version();

drop trigger if exists touch_match_round_state on public.match_round_player_progress_v1;
drop function if exists public.touch_match_round_state();

alter table public.match_rounds
  drop column if exists phase,
  drop column if exists phase_seq,
  drop column if exists phase_started_at,
  drop column if exists ends_at,
  drop column if exists updated_at,
  drop column if exists state_version;

drop function if exists public.get_match_snapshot_v1(uuid);
drop function if exists public.advance_round_phase_v1(uuid, uuid, int, timestamptz);

-- ----------------------------------------------------------------------------
-- Restore baseline finish_match (pre-rank)
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
-- Restore baseline async segment progression (pre-2026-01-07)
-- ----------------------------------------------------------------------------
drop function if exists public.auto_advance_overdue_segments_v1(uuid, uuid);

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

  insert into public.match_round_player_progress_v1 (
    match_id, round_id, round_index, question_id, player_id,
    current_step_index, current_segment, current_sub_step_index, segment_ends_at
  )
  values (
    p_match_id, p_round_id, v_round_index, v_round.question_id, p_player_id,
    0, 'main', 0, v_now + make_interval(secs => 15)
  )
  on conflict (match_id, round_id, player_id) do nothing;

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

  if v_progress.segment_ends_at is not null and v_now > v_progress.segment_ends_at then
    v_timed_out := true;
  end if;

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

  if p_segment = 'main' and v_sub_count > 0 then
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
  v_step_count int := 0;
  v_last_step_index int := -1;
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

  perform public.init_round_progress_v1(p_match_id, p_round_id);

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

  for v_player in
    select unnest(array[v_match.player1_id, v_match.player2_id])
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

    if v_progress.completed_at is not null then
      v_completed_count := v_completed_count + 1;
      continue;
    end if;

    if not v_force and v_progress.segment_ends_at is not null and v_now <= v_progress.segment_ends_at then
      continue;
    end if;

    if v_progress.current_step_index < 0 then
      v_next_step_index := 0;
      v_next_segment := 'main';
      v_next_sub_index := 0;
      v_next_seconds := 15;

      v_step := v_steps -> 0;
      v_next_seconds := public._coalesce_int(
        coalesce(v_step->>'timeLimitSeconds', v_step->>'time_limit_seconds'),
        15
      );

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
        select *
        into v_progress
        from public.match_round_player_progress_v1
        where id = v_progress.id;
      end if;
    end if;

    if v_progress.current_step_index > v_last_step_index then
      update public.match_round_player_progress_v1
      set
        completed_at = v_now,
        segment_ends_at = null,
        updated_at = v_now
      where id = v_progress.id;
      v_completed_count := v_completed_count + 1;
      continue;
    end if;

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

    v_sub_count := 0;
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
      if v_progress.current_step_index >= v_last_step_index then
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

-- ----------------------------------------------------------------------------
-- Restore baseline compute_multi_step_results_v3 (+1 sub-step bonus)
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

commit;
