-- 20251218000000_async_segments_progress_v1.sql
-- V1: Per-player segment progress (main/sub) for async multi-step rounds.
-- Enables "no waiting between parts" by making step progression independent per player.

begin;

-- 1) Progress table: one row per player per round
create table if not exists public.match_round_player_progress_v1 (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  round_id uuid not null references public.match_rounds(id) on delete cascade,
  round_index integer not null,
  question_id uuid not null references public.questions_v2(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  current_step_index integer not null default 0,
  current_segment text not null default 'main',
  segment_ends_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure segment values are constrained
alter table public.match_round_player_progress_v1
  drop constraint if exists match_round_player_progress_v1_segment_check;
alter table public.match_round_player_progress_v1
  add constraint match_round_player_progress_v1_segment_check
  check (current_segment in ('main','sub'));

-- Unique row per (match, round, player)
alter table public.match_round_player_progress_v1
  drop constraint if exists match_round_player_progress_v1_unique;
alter table public.match_round_player_progress_v1
  add constraint match_round_player_progress_v1_unique
  unique (match_id, round_id, player_id);

-- Helpful indexes
create index if not exists idx_mrpp_v1_match_round
  on public.match_round_player_progress_v1(match_id, round_id);

create index if not exists idx_mrpp_v1_match_round_completed
  on public.match_round_player_progress_v1(match_id, round_id, completed_at);

create index if not exists idx_mrpp_v1_player
  on public.match_round_player_progress_v1(player_id);

-- 2) Extend match_step_answers_v2 to support segments and timeouts
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_step_answers_v2'
  ) then
    -- Segment column (main/sub)
    alter table public.match_step_answers_v2
      add column if not exists segment text not null default 'main';

    -- Allow NULL selected_option so we can record timeouts as "no answer"
    begin
      alter table public.match_step_answers_v2
        alter column selected_option drop not null;
    exception
      when others then
        -- ignore (already nullable or column missing)
        null;
    end;

    -- Segment CHECK constraint
    if exists (
      select 1
      from pg_constraint
      where conname = 'match_step_answers_v2_segment_check'
        and conrelid = 'public.match_step_answers_v2'::regclass
    ) then
      alter table public.match_step_answers_v2
        drop constraint match_step_answers_v2_segment_check;
    end if;

    alter table public.match_step_answers_v2
      add constraint match_step_answers_v2_segment_check
      check (segment in ('main','sub'));

    -- Replace uniqueness: one answer per player per step per segment per round
    if exists (
      select 1
      from pg_constraint
      where conname = 'match_step_answers_v2_unique_answer'
        and conrelid = 'public.match_step_answers_v2'::regclass
    ) then
      alter table public.match_step_answers_v2
        drop constraint match_step_answers_v2_unique_answer;
    end if;

    alter table public.match_step_answers_v2
      add constraint match_step_answers_v2_unique_answer
      unique (match_id, round_index, player_id, question_id, step_index, segment);

    create index if not exists idx_match_step_answers_v2_match_round_step_segment
      on public.match_step_answers_v2(match_id, round_index, step_index, segment);
  end if;
end $$;

-- 3) RLS for progress table (service_role writes; players may read their own for debugging)
alter table public.match_round_player_progress_v1 enable row level security;

drop policy if exists "Players can read their own progress v1" on public.match_round_player_progress_v1;
create policy "Players can read their own progress v1"
  on public.match_round_player_progress_v1
  for select
  to authenticated
  using (player_id = auth.uid());

drop policy if exists "Service role can manage progress v1" on public.match_round_player_progress_v1;
create policy "Service role can manage progress v1"
  on public.match_round_player_progress_v1
  for all
  to service_role
  using (true)
  with check (true);

commit;









