-- 20251212000001_v2_round_identity_and_results_versioning.sql
begin;

-- ===== matches: round identity + results payload/versioning =====
alter table public.matches
  add column if not exists current_round_id uuid null references public.match_rounds(id),
  add column if not exists current_round_number int not null default 0,
  add column if not exists results_round_id uuid null references public.match_rounds(id),
  add column if not exists results_version int not null default 0,
  add column if not exists results_payload jsonb null;

-- results_computed_at already exists; keep as compatibility signal

-- ===== match_rounds: status + payload defaults + elimination/deadlines =====
alter table public.match_rounds
  add column if not exists question_payload jsonb null,
  add column if not exists step_deadlines jsonb null,         -- optional: array of step deadline timestamptz strings
  add column if not exists p1_eliminated_at timestamptz null,
  add column if not exists p2_eliminated_at timestamptz null;

-- Ensure payload columns exist and default cleanly
alter table public.match_rounds
  alter column player1_answer_payload set default '{"version":2,"steps":[]}'::jsonb,
  alter column player2_answer_payload set default '{"version":2,"steps":[]}'::jsonb;

-- ----- migrate existing status values to new phase model -----
-- Your current constraint is ('active','evaluating','finished').
-- Map:
-- active     -> main
-- evaluating -> steps
-- finished   -> done
update public.match_rounds
set status = case status
  when 'active' then 'main'
  when 'evaluating' then 'steps'
  when 'finished' then 'done'
  when 'results' then 'results' -- if you already had it
  when 'done' then 'done'
  when 'main' then 'main'
  when 'steps' then 'steps'
  else 'main'
end
where status is not null;

-- Drop any existing CHECK constraint that mentions "status"
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.match_rounds'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.match_rounds drop constraint %I', r.conname);
  end loop;
end $$;

-- Add new status CHECK constraint
alter table public.match_rounds
  add constraint match_rounds_status_check
  check (status in ('main','steps','results','done'));

commit;
