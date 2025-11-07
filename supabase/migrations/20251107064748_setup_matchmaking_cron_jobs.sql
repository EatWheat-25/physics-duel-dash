/*
  # Setup Matchmaking Cron Jobs (Fixed)

  This migration sets up automated cron jobs for the real-time matchmaking system.

  1. Cron Jobs
    - `matchmaker_tick`: Runs every 2 seconds to match players in queue
    - `cleanup_stale_queue`: Runs every 30 seconds to remove inactive players

  2. Configuration
    - Uses pg_cron extension to schedule recurring jobs
    - Uses pg_net extension to make HTTP requests to Edge Functions
    - Uses proper seconds syntax: '2 seconds' not '*/2 * * * * *'

  3. Security
    - Edge functions validate requests from pg_cron by User-Agent
    - Only internal system can trigger these functions
    - Cron jobs run with database privileges to manage matchmaking
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron jobs if they exist
DO $$
BEGIN
  PERFORM cron.unschedule('matchmaker_tick_job');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup_stale_queue_job');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule matchmaker to run every 2 seconds
SELECT cron.schedule(
  'matchmaker_tick_job',
  '2 seconds',
  $$
  SELECT net.http_post(
    url:='https://pwsgotzkeflizgfgqfbd.supabase.co/functions/v1/matchmaker_tick',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Schedule cleanup to run every 30 seconds
SELECT cron.schedule(
  'cleanup_stale_queue_job',
  '30 seconds',
  $$
  SELECT net.http_post(
    url:='https://pwsgotzkeflizgfgqfbd.supabase.co/functions/v1/cleanup_queue',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
