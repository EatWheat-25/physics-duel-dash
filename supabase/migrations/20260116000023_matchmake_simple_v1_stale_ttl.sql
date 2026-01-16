-- 20260116000023_matchmake_simple_v1_stale_ttl.sql
-- Harden matchmake_simple_v1 to ignore stale queue rows and clean dead matches.

begin;

create or replace function public.matchmake_simple_v1(
  p_player_id uuid,
  p_subject text,
  p_level text,
  p_force_new boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_user_queue public.matchmaking_queue%rowtype;
  v_opponent public.matchmaking_queue%rowtype;
  v_player1 uuid;
  v_player2 uuid;
  v_cutoff timestamptz := now() - interval '90 seconds';
begin
  -- Serialize by subject+level to avoid double-match races.
  perform pg_advisory_xact_lock(hashtext(coalesce(p_subject, '') || ':' || coalesce(p_level, '')));

  -- Drop stale queue rows.
  delete from public.matchmaking_queue
  where last_seen_at < v_cutoff;

  -- Drop stale pending matches with no connections.
  delete from public.matches
  where status = 'pending'
    and created_at < now() - interval '2 minutes'
    and player1_connected_at is null
    and player2_connected_at is null;

  -- Clean up any stale solo pending match for this user.
  delete from public.matches
  where status = 'pending'
    and (
      (player1_id = p_player_id and player2_id is null)
      or (player2_id = p_player_id and player1_id is null)
    );

  if not coalesce(p_force_new, false) then
    select *
    into v_match
    from public.matches
    where (player1_id = p_player_id or player2_id = p_player_id)
      and status in ('pending', 'active', 'results')
      and player1_id is not null
      and player2_id is not null
    order by created_at desc
    limit 1;

    if found then
      return jsonb_build_object(
        'matched', true,
        'match', to_jsonb(v_match),
        'match_id', v_match.id,
        'reused', true
      );
    end if;
  end if;

  -- Ensure user is queued (preserve original created_at if already waiting).
  insert into public.matchmaking_queue (
    player_id, status, subject, level, created_at, last_seen_at
  ) values (
    p_player_id, 'waiting', p_subject, p_level, now(), now()
  )
  on conflict (player_id) do update
  set status = 'waiting',
      subject = excluded.subject,
      level = excluded.level,
      last_seen_at = now()
  returning * into v_user_queue;

  -- Find earliest compatible opponent who is still waiting and fresh.
  select *
  into v_opponent
  from public.matchmaking_queue q
  where q.status = 'waiting'
    and q.subject = p_subject
    and q.level = p_level
    and q.player_id <> p_player_id
    and q.last_seen_at >= v_cutoff
    and not exists (
      select 1
      from public.matches m
      where (m.player1_id = q.player_id or m.player2_id = q.player_id)
        and m.status in ('pending', 'active', 'results')
    )
  order by q.created_at asc
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object(
      'matched', false,
      'queued', true,
      'queued_at', v_user_queue.created_at
    );
  end if;

  update public.matchmaking_queue
  set status = 'matched'
  where player_id in (p_player_id, v_opponent.player_id);

  -- Stable ordering: earlier queue time is player1.
  if v_user_queue.created_at <= v_opponent.created_at then
    v_player1 := p_player_id;
    v_player2 := v_opponent.player_id;
  else
    v_player1 := v_opponent.player_id;
    v_player2 := p_player_id;
  end if;

  insert into public.matches (
    player1_id,
    player2_id,
    subject,
    mode,
    status,
    target_rounds_to_win,
    max_rounds,
    target_points
  ) values (
    v_player1,
    v_player2,
    p_subject,
    p_level,
    'pending',
    3,
    3,
    5
  )
  returning * into v_match;

  delete from public.matchmaking_queue
  where player_id in (p_player_id, v_opponent.player_id);

  return jsonb_build_object(
    'matched', true,
    'match', to_jsonb(v_match),
    'match_id', v_match.id
  );
end;
$$;

grant execute on function public.matchmake_simple_v1(uuid, text, text, boolean) to service_role;

commit;
