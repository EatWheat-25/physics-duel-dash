-- 20261123000006_end_abandoned_matches_v1.sql
--
-- Matches never ended when a player left: game-ws only cleared player*_connected_at,
-- so ~300 matches sat at 'in_progress' forever. This adds:
--
--   1. player*_disconnected_at, stamped by a trigger when game-ws clears a
--      connected_at, so we know how long a player has been gone.
--   2. A terminal-status guard: once a match is 'finished' or 'abandoned' its status
--      can't change (game-ws sets status = 'in_progress' when it sends a question,
--      which could otherwise revive an ended match).
--   3. forfeit_match_v1(match, winner): ends a match for the player who stayed and
--      applies ranked points like finish_match (win/loss, by accuracy so far).
--   4. reap_stale_matches_v1(): run every minute by pg_cron (pure SQL, no HTTP):
--        * one player gone > 90 s, the other still there  -> forfeit to the one who stayed
--        * both gone > 90 s                                -> 'abandoned' (no rank change)
--        * 'pending' > 5 min, or any open match > 45 min   -> 'abandoned'
--      "Present" = connected_at heartbeat within 90 s (client pings every 25 s).
--      The bot always counts as present.
--   5. A daily purge of cron.job_run_details so job history can't bloat the disk again
--      (see 20261123000004).

begin;

-- 1. Disconnect timestamps -----------------------------------------------------
alter table public.matches
  add column if not exists player1_disconnected_at timestamptz,
  add column if not exists player2_disconnected_at timestamptz;

-- 2. Presence stamps + terminal-status guard -------------------------------------
create or replace function public.matches_presence_and_terminal_guard_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('finished', 'abandoned') and new.status is distinct from old.status then
    new.status := old.status;
  end if;

  if new.player1_connected_at is null and old.player1_connected_at is not null then
    new.player1_disconnected_at := now();
  elsif new.player1_connected_at is not null then
    new.player1_disconnected_at := null;
  end if;

  if new.player2_connected_at is null and old.player2_connected_at is not null then
    new.player2_disconnected_at := now();
  elsif new.player2_connected_at is not null then
    new.player2_disconnected_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_presence_and_terminal_guard_v1 on public.matches;
create trigger matches_presence_and_terminal_guard_v1
  before update on public.matches
  for each row execute function public.matches_presence_and_terminal_guard_v1();

-- 3. Forfeit --------------------------------------------------------------------
create or replace function public.forfeit_match_v1(p_match_id uuid, p_winner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_stats jsonb;
  v_loser_id uuid;
  v_p1_outcome text;
  v_p2_outcome text;
  v_p1_pct int;
  v_p2_pct int;
  v_p1_correct int;
  v_p2_correct int;
  v_p1_total int;
  v_p2_total int;
  v_p1_old int;
  v_p2_old int;
  v_p1_new int;
  v_p2_new int;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'match_not_found');
  end if;
  if v_match.status in ('finished', 'abandoned') then
    return jsonb_build_object('success', false, 'error', 'already_ended');
  end if;
  if p_winner_id is distinct from v_match.player1_id and p_winner_id is distinct from v_match.player2_id then
    return jsonb_build_object('success', false, 'error', 'winner_not_in_match');
  end if;

  v_loser_id := case when p_winner_id = v_match.player1_id then v_match.player2_id else v_match.player1_id end;

  perform public.ensure_players_for_match_v1(p_match_id);

  v_stats := public.compute_match_accuracy_v1(p_match_id);
  v_p1_pct := coalesce((v_stats->'p1'->>'accuracy_pct')::int, 0);
  v_p2_pct := coalesce((v_stats->'p2'->>'accuracy_pct')::int, 0);
  v_p1_correct := coalesce((v_stats->'p1'->>'correct_parts')::int, 0);
  v_p2_correct := coalesce((v_stats->'p2'->>'correct_parts')::int, 0);
  v_p1_total := coalesce((v_stats->'p1'->>'total_parts')::int, 0);
  v_p2_total := coalesce((v_stats->'p2'->>'total_parts')::int, 0);

  v_p1_outcome := case when p_winner_id = v_match.player1_id then 'win' else 'loss' end;
  v_p2_outcome := case when p_winner_id = v_match.player2_id then 'win' else 'loss' end;

  select coalesce(rank_points, 0) into v_p1_old from public.players where id = v_match.player1_id;
  select coalesce(rank_points, 0) into v_p2_old from public.players where id = v_match.player2_id;
  v_p1_old := coalesce(v_p1_old, 0);
  v_p2_old := coalesce(v_p2_old, 0);
  v_p1_new := public._clamp_int(v_p1_old + public.points_from_outcome_accuracy_v1(v_p1_outcome, v_p1_pct), 0, 2000);
  v_p2_new := public._clamp_int(v_p2_old + public.points_from_outcome_accuracy_v1(v_p2_outcome, v_p2_pct), 0, 2000);

  update public.players set rank_points = v_p1_new, updated_at = now() where id = v_match.player1_id;
  update public.players set rank_points = v_p2_new, updated_at = now() where id = v_match.player2_id;

  insert into public.player_rank_points_history (
    player_id, match_id, opponent_id, old_points, new_points, delta, outcome,
    accuracy_pct, correct_parts, total_parts
  )
  select v_match.player1_id, p_match_id, v_match.player2_id, v_p1_old, v_p1_new, v_p1_new - v_p1_old, v_p1_outcome,
         v_p1_pct, v_p1_correct, v_p1_total
  where exists (select 1 from public.players where id = v_match.player1_id)
    and exists (select 1 from public.players where id = v_match.player2_id)
  union all
  select v_match.player2_id, p_match_id, v_match.player1_id, v_p2_old, v_p2_new, v_p2_new - v_p2_old, v_p2_outcome,
         v_p2_pct, v_p2_correct, v_p2_total
  where exists (select 1 from public.players where id = v_match.player1_id)
    and exists (select 1 from public.players where id = v_match.player2_id);

  update public.matches
  set status = 'finished',
      completed_at = now(),
      winner_id = p_winner_id,
      ranked_payload = jsonb_build_object(
        'winner_id', p_winner_id,
        'reason', 'forfeit',
        'forfeited_by', v_loser_id,
        'p1', jsonb_build_object('player_id', v_match.player1_id, 'outcome', v_p1_outcome,
              'old_points', v_p1_old, 'new_points', v_p1_new, 'delta', v_p1_new - v_p1_old,
              'accuracy_pct', v_p1_pct, 'correct_parts', v_p1_correct, 'total_parts', v_p1_total),
        'p2', jsonb_build_object('player_id', v_match.player2_id, 'outcome', v_p2_outcome,
              'old_points', v_p2_old, 'new_points', v_p2_new, 'delta', v_p2_new - v_p2_old,
              'accuracy_pct', v_p2_pct, 'correct_parts', v_p2_correct, 'total_parts', v_p2_total)
      ),
      ranked_applied_at = now()
  where id = p_match_id;

  return jsonb_build_object('success', true, 'winner_id', p_winner_id, 'forfeited_by', v_loser_id);
end;
$$;

-- 4. Reaper ---------------------------------------------------------------------
create or replace function public.reap_stale_matches_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot_id constant uuid := '8f7f6c2a-1f4d-4f0b-9b7d-1a2b3c4d5e6f';
  v_grace constant interval := interval '90 seconds';
  v_now timestamptz := now();
  m record;
  v_p1_present boolean;
  v_p2_present boolean;
  v_p1_gone boolean;
  v_p2_gone boolean;
  v_forfeits int := 0;
  v_abandoned int := 0;
begin
  for m in
    select id, status, player1_id, player2_id, created_at, started_at,
           player1_connected_at, player2_connected_at,
           player1_disconnected_at, player2_disconnected_at
    from public.matches
    where status in ('pending', 'in_progress', 'active')
    order by created_at
    limit 500
  loop
    -- Hard caps: never-started lobbies and anything open far longer than a full match.
    if (m.status = 'pending' and m.created_at < v_now - interval '5 minutes')
       or m.created_at < v_now - interval '45 minutes' then
      update public.matches set status = 'abandoned', completed_at = v_now
      where id = m.id and status in ('pending', 'in_progress', 'active');
      v_abandoned := v_abandoned + 1;
      continue;
    end if;

    continue when m.status = 'pending';

    v_p1_present := m.player1_id = v_bot_id or m.player1_connected_at >= v_now - v_grace;
    v_p2_present := m.player2_id = v_bot_id or m.player2_connected_at >= v_now - v_grace;
    v_p1_gone := not v_p1_present and coalesce(m.player1_connected_at, m.player1_disconnected_at,
                                               m.started_at, m.created_at) < v_now - v_grace;
    v_p2_gone := not v_p2_present and coalesce(m.player2_connected_at, m.player2_disconnected_at,
                                               m.started_at, m.created_at) < v_now - v_grace;

    if v_p1_gone and v_p2_gone then
      update public.matches set status = 'abandoned', completed_at = v_now
      where id = m.id and status in ('in_progress', 'active');
      v_abandoned := v_abandoned + 1;
    elsif v_p1_gone and v_p2_present then
      perform public.forfeit_match_v1(m.id, m.player2_id);
      v_forfeits := v_forfeits + 1;
    elsif v_p2_gone and v_p1_present then
      perform public.forfeit_match_v1(m.id, m.player1_id);
      v_forfeits := v_forfeits + 1;
    end if;
  end loop;

  return jsonb_build_object('forfeits', v_forfeits, 'abandoned', v_abandoned);
end;
$$;

-- Server-only, like the other match-settling functions.
revoke all on function public.forfeit_match_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reap_stale_matches_v1() from public, anon, authenticated;
grant execute on function public.forfeit_match_v1(uuid, uuid) to service_role;
grant execute on function public.reap_stale_matches_v1() to service_role;

-- 5. Schedules (pure SQL, no net.http_post) -------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping schedules';
    return;
  end if;
  begin perform cron.unschedule('reap_stale_matches'); exception when others then null; end;
  begin perform cron.unschedule('purge_cron_history'); exception when others then null; end;

  perform cron.schedule('reap_stale_matches', '* * * * *', 'select public.reap_stale_matches_v1()');
  perform cron.schedule('purge_cron_history', '17 3 * * *',
    $job$delete from cron.job_run_details where end_time < now() - interval '2 days'$job$);
end $$;

commit;
