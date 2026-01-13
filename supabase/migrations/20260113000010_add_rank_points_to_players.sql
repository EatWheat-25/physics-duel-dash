-- 20260113000010_add_rank_points_to_players.sql
-- Introduce ranked points separate from matchmaking MMR.
-- Rank points are season-resettable and drive the Bronze->Ruby ladder (0..1500).

begin;

-- Players: keep mmr for matchmaking; add rank_points for ranked progression.
alter table public.players
  add column if not exists rank_points int not null default 0;

comment on column public.players.rank_points is 'Ranked points for ladder progression (0..1500). Separate from matchmaking MMR.';

-- Matches: store ranked summary payload for the post-match results screen.
alter table public.matches
  add column if not exists ranked_payload jsonb,
  add column if not exists ranked_applied_at timestamptz;

comment on column public.matches.ranked_payload is 'Server-computed ranked summary: points delta, accuracy, totals (per player).';
comment on column public.matches.ranked_applied_at is 'Timestamp when ranked points were applied for this match.';

-- Ranked history table (season 1)
create table if not exists public.player_rank_points_history (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  opponent_id uuid not null references public.players(id) on delete cascade,
  old_points int not null,
  new_points int not null,
  delta int not null,
  outcome text not null check (outcome in ('win','loss','draw')),
  accuracy_pct int not null check (accuracy_pct >= 0 and accuracy_pct <= 100),
  correct_parts int not null,
  total_parts int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_rank_points_history_player_created
  on public.player_rank_points_history(player_id, created_at desc);

alter table public.player_rank_points_history enable row level security;

drop policy if exists player_rank_points_history_select_own on public.player_rank_points_history;
create policy player_rank_points_history_select_own
  on public.player_rank_points_history for select
  to authenticated
  using (auth.uid() = player_id);

commit;

