-- 20251217000000_match_rounds_step_state.sql
-- Adds explicit, DB-authoritative step state for multi-step rounds.
-- This enables cross-instance safe step progression via Realtime on match_rounds.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_rounds'
  ) then
    -- Step state (explicit columns; avoid JSON blob coupling)
    alter table public.match_rounds
      add column if not exists current_step_index int,
      add column if not exists step_ends_at timestamptz null,
      add column if not exists main_question_ends_at timestamptz null;

    -- Backfill + constraints for current_step_index
    update public.match_rounds
    set current_step_index = 0
    where current_step_index is null;

    alter table public.match_rounds
      alter column current_step_index set default 0;

    alter table public.match_rounds
      alter column current_step_index set not null;

    -- Helpful indexes for round watchers / schedulers
    create index if not exists idx_match_rounds_match_step_index
      on public.match_rounds(match_id, current_step_index);

    create index if not exists idx_match_rounds_match_step_ends_at
      on public.match_rounds(match_id, step_ends_at);
  end if;
end $$;

commit;



