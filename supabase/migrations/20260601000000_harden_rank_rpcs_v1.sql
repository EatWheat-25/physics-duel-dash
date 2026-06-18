-- 20260601000000_harden_rank_rpcs_v1.sql
-- Security hardening, phase 1:
--   * record_solo_challenge_v1 / record_campaign_challenge_v1: caller must BE p_player_id (service_role exempt)
--   * submit_round_answer_v2: revoke client execute (only game-ws / service_role uses it)
--   * finish_match / get_match_question_report_v1: caller must be a participant (service_role exempt)
--   * delete_question_cascade: admin only (has_role)

begin;

-- ----------------------------------------------------------------------------
-- Helper: is the current request running with the service_role key?
-- ----------------------------------------------------------------------------
create or replace function public._is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

-- ----------------------------------------------------------------------------
-- record_solo_challenge_v1: guard p_player_id = auth.uid()
-- ----------------------------------------------------------------------------
create or replace function public.record_solo_challenge_v1(
  p_player_id uuid,
  p_subject   text,
  p_level     text,
  p_correct_parts int,
  p_total_parts   int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accuracy_pct int;
  v_outcome      text;
  v_old_points   int;
  v_delta        int;
  v_new_points   int;
  v_required_pct int := 65;
begin
  if not public._is_service_role() and p_player_id is distinct from auth.uid() then
    raise exception 'record_solo_challenge_v1: caller is not the player';
  end if;

  if p_total_parts <= 0 then
    raise exception 'total_parts must be > 0';
  end if;

  v_accuracy_pct := floor(p_correct_parts::numeric / p_total_parts * 100);
  v_accuracy_pct := public._clamp_int(v_accuracy_pct, 0, 100);

  if v_accuracy_pct >= v_required_pct then
    v_outcome := 'win';
    v_delta := 10;
  else
    v_outcome := 'loss';
    v_delta := -10;
  end if;

  select coalesce(rank_points, 0) into v_old_points
    from public.players
   where id = p_player_id
   for update;

  if not found then
    raise exception 'player not found';
  end if;

  v_new_points := public._clamp_int(v_old_points + v_delta, 0, 2000);

  update public.players
     set rank_points = v_new_points,
         updated_at  = now()
   where id = p_player_id;

  insert into public.player_rank_points_history (
    player_id, match_id, opponent_id,
    old_points, new_points, delta, outcome,
    accuracy_pct, correct_parts, total_parts
  ) values (
    p_player_id, null, null,
    v_old_points, v_new_points, v_new_points - v_old_points, v_outcome,
    v_accuracy_pct, p_correct_parts, p_total_parts
  );

  return jsonb_build_object(
    'outcome',      v_outcome,
    'accuracy_pct', v_accuracy_pct,
    'old_points',   v_old_points,
    'new_points',   v_new_points,
    'delta',        v_new_points - v_old_points
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- record_campaign_challenge_v1: guard p_player_id = auth.uid()
-- ----------------------------------------------------------------------------
create or replace function public.record_campaign_challenge_v1(
  p_player_id uuid,
  p_subject text,
  p_level text,
  p_topic_kind text,
  p_topic_key text,
  p_topic_label text,
  p_correct_parts int,
  p_total_parts int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accuracy_pct int;
  v_outcome text;
  v_old_points int;
  v_delta int;
  v_new_points int;
  v_required_pct int := 65;
begin
  if not public._is_service_role() and p_player_id is distinct from auth.uid() then
    raise exception 'record_campaign_challenge_v1: caller is not the player';
  end if;

  if p_total_parts <= 0 then
    raise exception 'total_parts must be > 0';
  end if;

  if p_subject not in ('math', 'physics', 'chemistry') then
    raise exception 'invalid subject %', p_subject;
  end if;

  if p_level not in ('A1', 'A2') then
    raise exception 'invalid level %', p_level;
  end if;

  if p_topic_kind not in ('chapter', 'topicTag') then
    raise exception 'invalid topic_kind %', p_topic_kind;
  end if;

  if length(trim(coalesce(p_topic_key, ''))) = 0 then
    raise exception 'topic_key is required';
  end if;

  if length(trim(coalesce(p_topic_label, ''))) = 0 then
    raise exception 'topic_label is required';
  end if;

  perform 1
    from public.players
   where id = p_player_id
   for update;

  if not found then
    raise exception 'player not found';
  end if;

  v_accuracy_pct := floor(p_correct_parts::numeric / p_total_parts * 100);
  v_accuracy_pct := public._clamp_int(v_accuracy_pct, 0, 100);

  if v_accuracy_pct >= v_required_pct then
    v_outcome := 'win';
    v_delta := 50;
  else
    v_outcome := 'loss';
    v_delta := -10;
  end if;

  insert into public.campaign_rank_points (
    player_id,
    subject,
    level,
    topic_kind,
    topic_key,
    topic_label,
    rank_points
  ) values (
    p_player_id,
    p_subject,
    p_level,
    p_topic_kind,
    trim(p_topic_key),
    trim(p_topic_label),
    0
  )
  on conflict (player_id, subject, level, topic_kind, topic_key)
  do update set
    topic_label = excluded.topic_label
  returning rank_points into v_old_points;

  v_new_points := public._clamp_int(v_old_points + v_delta, 0, 2000);

  update public.campaign_rank_points
     set rank_points = v_new_points,
         topic_label = trim(p_topic_label),
         updated_at = now()
   where player_id = p_player_id
     and subject = p_subject
     and level = p_level
     and topic_kind = p_topic_kind
     and topic_key = trim(p_topic_key);

  insert into public.campaign_rank_points_history (
    player_id,
    subject,
    level,
    topic_kind,
    topic_key,
    topic_label,
    old_points,
    new_points,
    delta,
    outcome,
    accuracy_pct,
    correct_parts,
    total_parts
  ) values (
    p_player_id,
    p_subject,
    p_level,
    p_topic_kind,
    trim(p_topic_key),
    trim(p_topic_label),
    v_old_points,
    v_new_points,
    v_new_points - v_old_points,
    v_outcome,
    v_accuracy_pct,
    p_correct_parts,
    p_total_parts
  );

  return jsonb_build_object(
    'outcome', v_outcome,
    'accuracy_pct', v_accuracy_pct,
    'old_points', v_old_points,
    'new_points', v_new_points,
    'delta', v_new_points - v_old_points,
    'topic_kind', p_topic_kind,
    'topic_key', trim(p_topic_key),
    'topic_label', trim(p_topic_label)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- submit_round_answer_v2: only the game-ws edge function (service_role) calls
-- this; clients must not be able to submit answers for other players.
-- ----------------------------------------------------------------------------
revoke all on function public.submit_round_answer_v2(uuid, uuid, integer) from public;
revoke all on function public.submit_round_answer_v2(uuid, uuid, integer) from anon;
revoke all on function public.submit_round_answer_v2(uuid, uuid, integer) from authenticated;
grant execute on function public.submit_round_answer_v2(uuid, uuid, integer) to service_role;

-- ----------------------------------------------------------------------------
-- finish_match: caller must be a participant of the match (service_role exempt).
-- Body identical to 20260302000003 with the guard prepended.
-- ----------------------------------------------------------------------------
create or replace function public.finish_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_winner_id uuid;
  v_stats jsonb;

  v_p1_old int;
  v_p2_old int;
  v_p1_new int;
  v_p2_new int;
  v_p1_delta int;
  v_p2_delta int;
  v_p1_outcome text;
  v_p2_outcome text;

  v_p1_pct int;
  v_p2_pct int;
  v_p1_correct int;
  v_p2_correct int;
  v_p1_total int;
  v_p2_total int;

  v_bot_id uuid := '8f7f6c2a-1f4d-4f0b-9b7d-1a2b3c4d5e6f';
  v_bot_min_accuracy_pct int;
  v_human_id uuid;
  v_human_pct int;
  v_is_idle_bot_match boolean := false;
begin
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match not found: %', p_match_id;
  end if;

  if not public._is_service_role()
     and auth.uid() is distinct from v_match.player1_id
     and auth.uid() is distinct from v_match.player2_id then
    raise exception 'finish_match: caller is not a participant';
  end if;

  if v_match.status = 'finished' and v_match.ranked_applied_at is not null then
    return jsonb_build_object(
      'winner_id', v_match.winner_id,
      'player1_final_score', v_match.player1_score,
      'player2_final_score', v_match.player2_score,
      'total_rounds', v_match.current_round_number,
      'ranked_payload', v_match.ranked_payload
    );
  end if;

  -- Ensure players rows exist before writing rank history.
  perform public.ensure_players_for_match_v1(p_match_id);

  -- Compute per-player accuracy from recorded parts
  v_stats := public.compute_match_accuracy_v1(p_match_id);
  v_p1_pct := coalesce((v_stats->'p1'->>'accuracy_pct')::int, 0);
  v_p2_pct := coalesce((v_stats->'p2'->>'accuracy_pct')::int, 0);
  v_p1_correct := coalesce((v_stats->'p1'->>'correct_parts')::int, 0);
  v_p2_correct := coalesce((v_stats->'p2'->>'correct_parts')::int, 0);
  v_p1_total := coalesce((v_stats->'p1'->>'total_parts')::int, 0);
  v_p2_total := coalesce((v_stats->'p2'->>'total_parts')::int, 0);

  v_is_idle_bot_match := (v_match.bot_behavior = 'idle' or v_match.bot_min_accuracy_pct is not null)
    and (v_match.player1_id = v_bot_id or v_match.player2_id = v_bot_id);

  if v_is_idle_bot_match then
    v_bot_min_accuracy_pct := coalesce(v_match.bot_min_accuracy_pct, 70);
    if v_match.player1_id = v_bot_id then
      v_human_id := v_match.player2_id;
      v_human_pct := v_p2_pct;
    else
      v_human_id := v_match.player1_id;
      v_human_pct := v_p1_pct;
    end if;

    if v_human_pct > v_bot_min_accuracy_pct then
      v_winner_id := v_human_id;
    else
      v_winner_id := v_bot_id;
    end if;
  else
    -- Winner logic: higher correct wins; tie -> compare accuracy pct; else draw
    if v_p1_correct > v_p2_correct then
      v_winner_id := v_match.player1_id;
    elsif v_p2_correct > v_p1_correct then
      v_winner_id := v_match.player2_id;
    elsif v_p1_pct > v_p2_pct then
      v_winner_id := v_match.player1_id;
    elsif v_p2_pct > v_p1_pct then
      v_winner_id := v_match.player2_id;
    else
      v_winner_id := null;
    end if;
  end if;

  update public.matches
  set status = 'finished',
      completed_at = now(),
      winner_id = v_winner_id
  where id = p_match_id;

  if v_winner_id is null then
    v_p1_outcome := 'draw';
    v_p2_outcome := 'draw';
  elsif v_winner_id = v_match.player1_id then
    v_p1_outcome := 'win';
    v_p2_outcome := 'loss';
  else
    v_p1_outcome := 'loss';
    v_p2_outcome := 'win';
  end if;

  select rank_points into v_p1_old from public.players where id = v_match.player1_id;
  select rank_points into v_p2_old from public.players where id = v_match.player2_id;
  v_p1_old := coalesce(v_p1_old, 0);
  v_p2_old := coalesce(v_p2_old, 0);

  v_p1_delta := public.points_from_outcome_accuracy_v1(v_p1_outcome, v_p1_pct);
  v_p2_delta := public.points_from_outcome_accuracy_v1(v_p2_outcome, v_p2_pct);

  v_p1_new := public._clamp_int(v_p1_old + v_p1_delta, 0, 2000);
  v_p2_new := public._clamp_int(v_p2_old + v_p2_delta, 0, 2000);

  update public.players set rank_points = v_p1_new, updated_at = now() where id = v_match.player1_id;
  update public.players set rank_points = v_p2_new, updated_at = now() where id = v_match.player2_id;

  insert into public.player_rank_points_history (
    player_id, match_id, opponent_id,
    old_points, new_points, delta, outcome,
    accuracy_pct, correct_parts, total_parts
  ) values
    (v_match.player1_id, p_match_id, v_match.player2_id, v_p1_old, v_p1_new, v_p1_new - v_p1_old, v_p1_outcome, v_p1_pct, v_p1_correct, v_p1_total),
    (v_match.player2_id, p_match_id, v_match.player1_id, v_p2_old, v_p2_new, v_p2_new - v_p2_old, v_p2_outcome, v_p2_pct, v_p2_correct, v_p2_total);

  update public.matches
  set ranked_payload = jsonb_build_object(
        'winner_id', v_winner_id,
        'p1', jsonb_build_object(
          'player_id', v_match.player1_id,
          'outcome', v_p1_outcome,
          'old_points', v_p1_old,
          'new_points', v_p1_new,
          'delta', v_p1_new - v_p1_old,
          'accuracy_pct', v_p1_pct,
          'correct_parts', v_p1_correct,
          'total_parts', v_p1_total
        ),
        'p2', jsonb_build_object(
          'player_id', v_match.player2_id,
          'outcome', v_p2_outcome,
          'old_points', v_p2_old,
          'new_points', v_p2_new,
          'delta', v_p2_new - v_p2_old,
          'accuracy_pct', v_p2_pct,
          'correct_parts', v_p2_correct,
          'total_parts', v_p2_total
        )
      ),
      ranked_applied_at = now()
  where id = p_match_id;

  return jsonb_build_object(
    'winner_id', v_winner_id,
    'player1_final_score', v_match.player1_score,
    'player2_final_score', v_match.player2_score,
    'total_rounds', v_match.current_round_number,
    'ranked_payload', (select ranked_payload from public.matches where id = p_match_id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- get_match_question_report_v1: caller must be a participant (service_role exempt).
-- Converted to plpgsql to allow the guard; result set unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.get_match_question_report_v1(p_match_id uuid)
returns table(
  round_index int,
  question_id uuid,
  title text,
  stem text,
  p1_correct_parts int,
  p1_total_parts int,
  p2_correct_parts int,
  p2_total_parts int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_service_role() and not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (m.player1_id = auth.uid() or m.player2_id = auth.uid())
  ) then
    raise exception 'get_match_question_report_v1: caller is not a participant';
  end if;

  return query
  with match_players as (
    select player1_id as p1_id, player2_id as p2_id
    from public.matches
    where id = p_match_id
  ),
  per_question as (
    select
      a.round_index,
      a.question_id,
      a.player_id,
      sum(case when a.is_correct then 1 else 0 end)::int as correct_parts,
      count(*)::int as total_parts
    from public.match_step_answers_v2 a
    where a.match_id = p_match_id
    group by a.round_index, a.question_id, a.player_id
  )
  select
    qsum.round_index,
    qsum.question_id,
    q.title,
    q.stem,
    coalesce(p1.correct_parts, 0) as p1_correct_parts,
    coalesce(p1.total_parts, 0) as p1_total_parts,
    coalesce(p2.correct_parts, 0) as p2_correct_parts,
    coalesce(p2.total_parts, 0) as p2_total_parts
  from (
    select distinct pq.round_index, pq.question_id
    from per_question pq
  ) qsum
  join public.questions_v2 q on q.id = qsum.question_id
  cross join match_players mp
  left join per_question p1
    on p1.question_id = qsum.question_id
   and p1.round_index = qsum.round_index
   and p1.player_id = mp.p1_id
  left join per_question p2
    on p2.question_id = qsum.question_id
   and p2.round_index = qsum.round_index
   and p2.player_id = mp.p2_id
  order by qsum.round_index;
end;
$$;

grant execute on function public.get_match_question_report_v1(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- delete_question_cascade: admin only.
-- ----------------------------------------------------------------------------
create or replace function public.delete_question_cascade(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer := 0;
  v_error_message text;
begin
  if not public._is_service_role() and not public.has_role(auth.uid(), 'admin') then
    return jsonb_build_object(
      'success', false,
      'error', 'admin role required',
      'question_id', p_question_id
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_answers') then
    delete from public.match_answers where question_id = p_question_id;
    get diagnostics v_deleted_count = row_count;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_rounds') then
    delete from public.match_rounds where question_id = p_question_id;
    get diagnostics v_deleted_count = row_count;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_questions') then
    delete from public.match_questions where question_id = p_question_id;
    get diagnostics v_deleted_count = row_count;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'matches'
    and column_name = 'question_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'question_id'
      and is_nullable = 'YES'
    ) then
      update public.matches set question_id = null where question_id = p_question_id;
      get diagnostics v_deleted_count = row_count;
    else
      delete from public.matches where question_id = p_question_id;
      get diagnostics v_deleted_count = row_count;
    end if;
  end if;

  delete from public.questions_v2 where id = p_question_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Question not found',
      'question_id', p_question_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Question and all related records deleted successfully',
    'question_id', p_question_id
  );

exception
  when others then
    get stacked diagnostics v_error_message = message_text;
    return jsonb_build_object(
      'success', false,
      'error', v_error_message,
      'question_id', p_question_id
    );
end;
$$;

commit;
