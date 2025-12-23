-- 20251224000000_target_rounds_to_win_default_3.sql
-- Standardize match win condition: first to 3 round wins.

begin;

-- Update default for new matches
alter table public.matches
  alter column target_rounds_to_win set default 3;

-- Update comment to match new default
comment on column public.matches.target_rounds_to_win
  is 'Number of rounds needed to win the match (default: 3)';

-- Backfill existing pending/in_progress matches that still use the old default (4)
update public.matches
set target_rounds_to_win = 3
where status in ('pending', 'in_progress')
  and (target_rounds_to_win is null or target_rounds_to_win = 4);

commit;


