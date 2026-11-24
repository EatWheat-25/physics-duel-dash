-- 20261123000004_stop_legacy_cron_and_purge_logs_v1.sql
--
-- matchmaker_tick_job (every 2 s) and cleanup_stale_queue_job (every 30 s) call the
-- legacy `queue` matchmaker, which the app no longer uses (matchmaking runs through
-- matchmake-simple / matchmake_simple_v1 on matchmaking_queue). Every run left a row in
-- cron.job_run_details and net._http_response: ~10 GB by Nov 2026, which pushed the
-- disk past the plan quota, throttled the database, and made PostgREST schema reloads
-- time out (PGRST002 outages after migrations).
--
-- This unschedules both jobs and empties the two log tables (history only, no game data).
-- No DDL on exposed schemas, so it does not trigger a PostgREST schema reload.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('matchmaker_tick_job'); exception when others then null; end;
    begin perform cron.unschedule('cleanup_stale_queue_job'); exception when others then null; end;
  end if;
end $$;

do $$
begin
  begin
    truncate cron.job_run_details;
  exception when insufficient_privilege then
    delete from cron.job_run_details;
  end;
  begin
    truncate net._http_response;
  exception when insufficient_privilege then
    delete from net._http_response;
  end;
end $$;
