-- 20260118000000_match_rounds_results_ack.sql
begin;

alter table public.match_rounds
  add column if not exists p1_results_ack_at timestamptz,
  add column if not exists p2_results_ack_at timestamptz;

commit;
