-- 20260423001000_campaign_rank_balance_v2.sql
-- Make campaign progression more generous for learning-focused runs.

begin;

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

commit;
