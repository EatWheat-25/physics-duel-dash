-- 20261123000003_revert_lock_server_only_rpcs_v2.sql
-- Emergency revert of 20261123000002 (same PGRST002 outage): after it was applied the REST API (PostgREST)
-- failed to load its schema cache (PGRST002, every request 503). This restores the
-- previous privileges exactly, so the API comes back while the cause is investigated.

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
    execute format('grant execute on function %s to public, anon, authenticated', fn.sig);
  end loop;
end;
$$;

-- These three were already server-only before 20261123000000 (see 20260601000000 and
-- 20260603000000), so they stay locked.
--   submit_round_answer_v2, record_solo_challenge_v1, record_campaign_challenge_v1

notify pgrst, 'reload schema';

commit;
