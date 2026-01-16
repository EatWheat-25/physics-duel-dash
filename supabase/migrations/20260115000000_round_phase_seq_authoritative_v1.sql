-- 20260115000000_round_phase_seq_authoritative_v1.sql
-- Add authoritative round phase sequencing + timing for sync-safe progression.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_rounds'
  ) then
    alter table public.match_rounds
      add column if not exists phase text,
      add column if not exists phase_seq int not null default 0,
      add column if not exists phase_started_at timestamptz null,
      add column if not exists ends_at timestamptz null,
      add column if not exists updated_at timestamptz not null default now();

    alter table public.match_rounds
      alter column phase set default 'main';

    -- Backfill phase from status when missing (status already normalized to main/steps/results/done).
    update public.match_rounds
    set phase = coalesce(phase, status, 'main')
    where phase is null;

    alter table public.match_rounds
      alter column phase set not null;

    -- Backfill ends_at from existing timers if available.
    update public.match_rounds
    set ends_at = coalesce(ends_at, main_question_ends_at, step_ends_at)
    where ends_at is null;

    -- Phase CHECK constraint.
    if exists (
      select 1 from pg_constraint
      where conname = 'match_rounds_phase_check'
        and conrelid = 'public.match_rounds'::regclass
    ) then
      alter table public.match_rounds drop constraint match_rounds_phase_check;
    end if;

    alter table public.match_rounds
      add constraint match_rounds_phase_check
      check (phase in ('main','steps','results','done'));

    -- Helpful indexes for schedulers.
    create index if not exists idx_match_rounds_phase_due
      on public.match_rounds(phase, ends_at);

    create index if not exists idx_match_rounds_match_phase_seq
      on public.match_rounds(match_id, phase_seq);
  end if;
end $$;

-- Updated_at trigger
create or replace function public.set_updated_at_match_rounds()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_match_rounds on public.match_rounds;
create trigger set_updated_at_match_rounds
before update on public.match_rounds
for each row execute function public.set_updated_at_match_rounds();

commit;
