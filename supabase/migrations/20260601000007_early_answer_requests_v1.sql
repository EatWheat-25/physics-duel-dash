-- 20260601000007_early_answer_requests_v1.sql
-- Early-answer (skip main question) consent must be visible across edge
-- function instances. Each player's WebSocket may be served by a different
-- isolate with its own in-memory state, so the request set is persisted on
-- the round row. Clients also receive it through the existing match_rounds
-- realtime subscription, which keeps both players' UIs in sync.

begin;

alter table public.match_rounds
  add column if not exists early_answer_player_ids uuid[] not null default '{}';

create or replace function public.request_early_answer_v1(
  p_match_id uuid,
  p_round_id uuid,
  p_player_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in sync with BOT_PLAYER_ID in game-ws (bots auto-agree).
  v_bot_id uuid := '8f7f6c2a-1f4d-4f0b-9b7d-1a2b3c4d5e6f';
  v_match public.matches%rowtype;
  v_round public.match_rounds%rowtype;
  v_requested uuid[];
  v_all_ready boolean;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'match_not_found');
  end if;

  if p_player_id is distinct from v_match.player1_id
     and p_player_id is distinct from v_match.player2_id then
    return jsonb_build_object('success', false, 'error', 'not_a_participant');
  end if;

  select * into v_round
  from public.match_rounds
  where id = p_round_id
    and match_id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'round_not_found');
  end if;

  if coalesce(v_round.phase, v_round.status, 'main') <> 'main' then
    return jsonb_build_object(
      'success', false,
      'error', 'not_in_main_phase',
      'requested_by', to_jsonb(coalesce(v_round.early_answer_player_ids, '{}'::uuid[]))
    );
  end if;

  v_requested := coalesce(v_round.early_answer_player_ids, '{}'::uuid[]);
  if not (p_player_id = any(v_requested)) then
    v_requested := array_append(v_requested, p_player_id);
    update public.match_rounds
    set early_answer_player_ids = v_requested
    where id = p_round_id;
  end if;

  -- Ready once every human participant has requested (bots auto-agree).
  v_all_ready := not exists (
    select 1
    from unnest(array[v_match.player1_id, v_match.player2_id]) as pid
    where pid is not null
      and pid <> v_bot_id
      and not (pid = any(v_requested))
  );

  return jsonb_build_object(
    'success', true,
    'requested_by', to_jsonb(v_requested),
    'all_ready', v_all_ready
  );
end;
$$;

revoke all on function public.request_early_answer_v1(uuid, uuid, uuid) from public;
revoke all on function public.request_early_answer_v1(uuid, uuid, uuid) from anon;
revoke all on function public.request_early_answer_v1(uuid, uuid, uuid) from authenticated;
grant execute on function public.request_early_answer_v1(uuid, uuid, uuid) to service_role;

commit;
