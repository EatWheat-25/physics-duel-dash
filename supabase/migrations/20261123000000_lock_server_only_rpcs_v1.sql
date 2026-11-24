-- 20261123000000_lock_server_only_rpcs_v1.sql
--
-- Postgres lets PUBLIC execute every new function unless that is revoked, and
-- Supabase exposes every public-schema function over the REST API. So functions
-- that were only meant for the game server (game-ws / matchmake-simple, which use
-- the service key) were callable by any browser, even signed out. The worst one,
-- submit_segment_v1, takes the "is this answer correct" flag from its caller, so a
-- player could mark their own answers correct in ranked matches.
--
-- This migration:
--   1. Revokes EXECUTE from public / anon / authenticated on every SECURITY DEFINER
--      function in the public schema, except the ones the browser legitimately
--      calls (allowlist below — each of those checks the caller itself).
--   2. Grants EXECUTE on all of them to service_role so edge functions keep working.
--   3. Changes the default so functions created by future migrations are NOT
--      callable by clients until a migration explicitly grants them.
--      => A new client-facing RPC needs: grant execute on function ... to authenticated;
--
-- Trigger functions and pg_cron jobs are unaffected (execute privilege is not
-- checked when a trigger fires; cron runs as the owner).

begin;

do $$
declare
  -- Functions the web client calls directly, plus has_role() which RLS policies use.
  client_allowlist text[] := array[
    'has_role',
    'get_questions_for_play_v1',
    'get_question_topics_v1',
    'check_step_answer_v1',
    'grade_solo_attempt_v1',
    'get_players_rank_public_v1',
    'ensure_players_for_match_v1',
    'get_match_round_state_v2',
    'get_match_question_report_v1',
    'finish_match',
    'delete_question_cascade'
  ];
  fn record;
  locked int := 0;
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef                      -- SECURITY DEFINER only
      and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
      and not exists (                     -- skip functions owned by extensions
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('grant execute on function %s to service_role', fn.sig);
    if fn.proname = any (client_allowlist) then
      continue;
    end if;
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
    locked := locked + 1;
    raise notice 'locked to service_role: %', fn.sig;
  end loop;
  raise notice 'lock_server_only_rpcs_v1: % functions locked', locked;
end;
$$;

-- Future functions start locked; client-facing ones must be granted explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

commit;
