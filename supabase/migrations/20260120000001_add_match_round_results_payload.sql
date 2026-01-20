-- 20260120000001_add_match_round_results_payload.sql
-- Persist per-round results for reliable client resync.

begin;

alter table public.match_rounds
  add column if not exists results_payload jsonb null,
  add column if not exists results_version int not null default 0,
  add column if not exists results_computed_at timestamptz null;

commit;
