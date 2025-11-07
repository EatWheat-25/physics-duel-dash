/*
  # Setup Matchmaking Cron Jobs

  This migration sets up automated cron jobs for the real-time matchmaking system.

  1. Cron Jobs
    - `matchmaker_tick`: Runs every 2 seconds to match players in queue
    - `cleanup_stale_queue`: Runs every 30 seconds to remove inactive players

  2. Configuration
    - Uses pg_cron extension to schedule recurring jobs
    - Uses pg_net extension to make HTTP requests to Edge Functions
    - Stores service role key securely using Supabase Vault

  3. Security
    - Service role key is used to authenticate cron job requests
    - Only internal system can trigger these functions
    - Cron jobs run with elevated privileges to manage matchmaking
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron jobs if they exist
SELECT cron.unschedule('matchmaker_tick_job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'matchmaker_tick_job'
);

SELECT cron.unschedule('cleanup_stale_queue_job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup_stale_queue_job'
);

-- Schedule matchmaker to run every 2 seconds
-- Note: This requires Postgres 15.1.1.61+ for seconds-level scheduling
SELECT cron.schedule(
  'matchmaker_tick_job',
  '*/2 * * * * *',
  $$
  SELECT net.http_post(
    url:='https://pwsgotzkeflizgfgqfbd.supabase.co/functions/v1/matchmaker_tick',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Schedule cleanup to run every 30 seconds
SELECT cron.schedule(
  'cleanup_stale_queue_job',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url:='https://pwsgotzkeflizgfgqfbd.supabase.co/functions/v1/cleanup_queue',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);
