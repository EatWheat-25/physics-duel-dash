-- 20260302000000_add_bot_player.sql
-- Seed a service-only bot user + player row for matchmaking bots.

begin;

-- Bot identity (must be consistent with server constants).
-- NOTE: Keep this UUID in sync with BOT_PLAYER_ID in game-ws.
do $$
declare
  v_bot_id uuid := '8f7f6c2a-1f4d-4f0b-9b7d-1a2b3c4d5e6f';
  v_instance_id uuid;
begin
  select id into v_instance_id from auth.instances limit 1;
  if v_instance_id is null then
    raise exception 'auth.instances has no rows; cannot seed bot user';
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  select
    v_bot_id,
    v_instance_id,
    'authenticated',
    'authenticated',
    'bot@physics-duel.local',
    '',
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('bot', true),
    now(),
    now()
  where not exists (
    select 1 from auth.users where id = v_bot_id
  );

  insert into public.players (id, display_name, mmr, updated_at)
  values (v_bot_id, 'BOT', 1000, now())
  on conflict (id) do update
    set display_name = excluded.display_name,
        mmr = excluded.mmr,
        updated_at = excluded.updated_at;
end $$;

commit;
