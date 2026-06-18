-- 20260601000005_queue_policy_and_cron_secret_v1.sql
-- Security hardening, phase 4 (hygiene):
--   * matchmaking_queue: players can only see their own queue row.
--   * cron jobs: send a shared secret header instead of relying on the
--     spoofable pg_net User-Agent check.
--
-- REQUIRED MANUAL SETUP for the cron secret:
--   1. Pick a long random secret.
--   2. In the SQL editor:  alter database postgres set app.settings.cron_secret = '<secret>';
--   3. In Edge Function secrets:  supabase secrets set CRON_SECRET=<secret>
--   (matchmaker_tick / cleanup_queue reject cron calls without it.)

begin;

-- ----------------------------------------------------------------------------
-- matchmaking_queue: SELECT restricted to own row.
-- ----------------------------------------------------------------------------
drop policy if exists "Users can view queue" on public.matchmaking_queue;
drop policy if exists "queue_select_self" on public.matchmaking_queue;

create policy "queue_select_self"
  on public.matchmaking_queue
  for select
  to authenticated
  using (auth.uid() = player_id);

-- ----------------------------------------------------------------------------
-- Reschedule cron jobs with the shared secret header.
-- (No-ops gracefully if pg_cron is not installed in this environment.)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping cron job reschedule';
    return;
  end if;

  begin
    perform cron.unschedule('matchmaker_tick_job');
  exception when others then null;
  end;

  begin
    perform cron.unschedule('cleanup_stale_queue_job');
  exception when others then null;
  end;

  perform cron.schedule(
    'matchmaker_tick_job',
    '2 seconds',
    $job$
    select net.http_post(
      url:='https://qvunaswogfwhixecjpcn.supabase.co/functions/v1/matchmaker_tick',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
      ),
      body:='{}'::jsonb
    ) as request_id;
    $job$
  );

  perform cron.schedule(
    'cleanup_stale_queue_job',
    '30 seconds',
    $job$
    select net.http_post(
      url:='https://qvunaswogfwhixecjpcn.supabase.co/functions/v1/cleanup_queue',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')
      ),
      body:='{}'::jsonb
    ) as request_id;
    $job$
  );
end $$;

commit;
