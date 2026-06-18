-- 20260306000000_record_solo_challenge_rank_v2.sql
-- Solo Challenge ranked points:
-- - Win if accuracy >= 65%
-- - +10 points on win, -10 points on loss

begin;

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

grant execute on function public.record_solo_challenge_v1(uuid, text, text, int, int) to authenticated;

commit;

