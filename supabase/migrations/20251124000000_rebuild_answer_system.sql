create table if not exists public.match_rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches_new(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  round_number int not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  winner_player_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.match_answers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches_new(id) on delete cascade not null,
  round_id uuid references public.match_rounds(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  step_id text not null,
  answer_index int not null,
  is_correct boolean not null,
  answered_at timestamp with time zone default now() not null
);

-- Indexes for performance
create index if not exists idx_match_rounds_match_id on public.match_rounds(match_id);
create index if not exists idx_match_answers_match_id on public.match_answers(match_id);
create index if not exists idx_match_answers_round_id on public.match_answers(round_id);
create index if not exists idx_match_answers_player_id on public.match_answers(player_id);

-- RLS Policies (Basic)
alter table public.match_rounds enable row level security;
alter table public.match_answers enable row level security;

create policy "Users can view rounds for their matches"
  on public.match_rounds for select
  using (
    exists (
      select 1 from public.matches_new m
      where m.id = match_rounds.match_id
      and (m.p1 = auth.uid() or m.p2 = auth.uid())
    )
  );

create policy "Users can view answers for their matches"
  on public.match_answers for select
  using (
    exists (
      select 1 from public.matches_new m
      where m.id = match_answers.match_id
      and (m.p1 = auth.uid() or m.p2 = auth.uid())
    )
  );

create policy "Service role can manage rounds"
  on public.match_rounds for all
  using (true)
  with check (true);

create policy "Service role can manage answers"
  on public.match_answers for all
  using (true)
  with check (true);
