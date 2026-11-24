-- 20261123000005_lock_server_only_rpcs_v3.sql
--
-- Third attempt (v1 and v2 were reverted after PostgREST schema reloads timed out —
-- caused by 10 GB of cron/pg_net log bloat, cleared in 20261123000004). Was: the REST API
-- failed to reload its schema cache). This version only revokes client EXECUTE on
-- the named server-only functions — the same per-function pattern that
-- 20260601000000 and 20260603000000 applied safely. It does NOT touch default
-- privileges.
--
-- These functions are called only by edge functions (service key) or by other
-- SECURITY DEFINER functions. submit_segment_v1 in particular takes the
-- "answer is correct" flag from its caller, so client access let players mark
-- their own answers correct.

begin;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'matchmake_simple_v1','force_timeout_stage2','get_active_player_count','pick_next_question_v3',
        'start_match','submit_answer_stage2','start_next_round_stage3','clear_round_results',
        'upsert_questions','complete_step_v2','compute_multi_step_results_v2','pick_next_question_v2',
        'submit_answer','compute_multi_step_results_v3','compute_match_accuracy_v1','force_timeout_stage3',
        'auto_advance_overdue_segments_v1','init_round_progress_v1','submit_segment_v1',
        'request_early_answer_v1','get_taxonomy_v1'
      ])
  loop
    execute format('revoke all on function %s from public', fn.sig);
    execute format('revoke all on function %s from anon', fn.sig);
    execute format('revoke all on function %s from authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end;
$$;

commit;
