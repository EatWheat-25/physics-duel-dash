# Manual Migration Application Instructions

Since the CLI is stuck on authentication, apply these migrations manually via Supabase Dashboard SQL Editor.

## Steps:

1. **Go to Supabase Dashboard** → Your Project → SQL Editor

2. **Apply each migration in order** (copy-paste the SQL below):

---

## Migration 1: Round Identity and Results Versioning

Copy and paste this entire SQL block:

```sql
-- 20251212000001_v2_round_identity_and_results_versioning.sql
begin;

-- Ensure match_rounds table exists (create if it doesn't)
CREATE TABLE IF NOT EXISTS public.match_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  round_number INT,
  status TEXT NOT NULL DEFAULT 'active',
  player1_round_score INT NOT NULL DEFAULT 0,
  player2_round_score INT NOT NULL DEFAULT 0,
  player1_answered_at TIMESTAMPTZ,
  player2_answered_at TIMESTAMPTZ,
  player1_answer_payload JSONB,
  player2_answer_payload JSONB,
  round_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add question_id FK if questions table exists and FK doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'questions_v2') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'match_rounds_question_id_fkey' 
      AND table_name = 'match_rounds'
    ) THEN
      ALTER TABLE public.match_rounds
        ADD CONSTRAINT match_rounds_question_id_fkey 
        FOREIGN KEY (question_id) REFERENCES public.questions_v2(id);
    END IF;
  END IF;
END $$;

-- ===== matches: round identity + results payload/versioning =====
alter table public.matches
  add column if not exists current_round_id uuid null,
  add column if not exists current_round_number int not null default 0,
  add column if not exists results_round_id uuid null,
  add column if not exists results_version int not null default 0,
  add column if not exists results_payload jsonb null;

-- Add foreign key constraints
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_rounds') then
    if not exists (
      select 1 from information_schema.table_constraints 
      where constraint_name = 'matches_current_round_id_fkey' 
      and table_name = 'matches'
    ) then
      alter table public.matches
        add constraint matches_current_round_id_fkey 
        foreign key (current_round_id) references public.match_rounds(id);
    end if;
    
    if not exists (
      select 1 from information_schema.table_constraints 
      where constraint_name = 'matches_results_round_id_fkey' 
      and table_name = 'matches'
    ) then
      alter table public.matches
        add constraint matches_results_round_id_fkey 
        foreign key (results_round_id) references public.match_rounds(id);
    end if;
  end if;
end $$;

-- ===== match_rounds: status + payload defaults + elimination/deadlines =====
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_rounds') then
    alter table public.match_rounds
      add column if not exists question_payload jsonb null,
      add column if not exists step_deadlines jsonb null,
      add column if not exists p1_eliminated_at timestamptz null,
      add column if not exists p2_eliminated_at timestamptz null;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_rounds' and column_name = 'player1_answer_payload') then
      alter table public.match_rounds
        alter column player1_answer_payload set default '{"version":2,"steps":[]}'::jsonb;
    end if;
    
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_rounds' and column_name = 'player2_answer_payload') then
      alter table public.match_rounds
        alter column player2_answer_payload set default '{"version":2,"steps":[]}'::jsonb;
    end if;

    update public.match_rounds
    set status = case status
      when 'active' then 'main'
      when 'evaluating' then 'steps'
      when 'finished' then 'done'
      when 'results' then 'results'
      when 'done' then 'done'
      when 'main' then 'main'
      when 'steps' then 'steps'
      else 'main'
    end
    where status is not null;

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
    end;

    if exists (
      select 1 from pg_constraint 
      where conname = 'match_rounds_status_check' 
      and conrelid = 'public.match_rounds'::regclass
    ) then
      alter table public.match_rounds drop constraint match_rounds_status_check;
    end if;
    
    alter table public.match_rounds
      add constraint match_rounds_status_check
      check (status in ('main','steps','results','done'));
  end if;
end $$;

commit;
```

---

## Migration 2: Update submit_round_answer_v2

Copy and paste this entire SQL block:

```sql
-- 20251212000002_v2_update_submit_round_answer_v2.sql
begin;

create or replace function public.submit_round_answer_v2(
  p_match_id uuid,
  p_player_id uuid,
  p_answer integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_round public.match_rounds%rowtype;
  v_correct_answer int;
  v_p1_is bool;
  v_p2_is bool;
  v_now timestamptz := now();
  v_p1_answer int;
  v_p2_answer int;
  v_p1_correct bool;
  v_p2_correct bool;
  v_round_winner uuid;
  v_p1_wins int;
  v_p2_wins int;
  v_finished bool := false;
  v_results_version int;
  v_payload jsonb;
begin
  if p_answer is null then
    raise exception 'answer cannot be null';
  end if;

  -- ===== NON-NEGOTIABLE: lock match row =====
  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match not found';
  end if;

  if v_match.status not in ('pending','in_progress') then
    return jsonb_build_object('success', false, 'reason', 'match_not_active');
  end if;

  v_p1_is := (p_player_id = v_match.player1_id);
  v_p2_is := (p_player_id = v_match.player2_id);

  if not (v_p1_is or v_p2_is) then
    raise exception 'player not in match';
  end if;

  if v_match.current_round_id is null then
    raise exception 'current_round_id is null (no active round)';
  end if;

  select *
  into v_round
  from public.match_rounds
  where id = v_match.current_round_id;

  if not found then
    raise exception 'match_round not found for current_round_id';
  end if;

  -- Idempotency: if player already answered, return early
  if v_p1_is and v_match.player1_answered_at is not null then
    return jsonb_build_object('success', true, 'already_answered', true);
  end if;
  if v_p2_is and v_match.player2_answered_at is not null then
    return jsonb_build_object('success', true, 'already_answered', true);
  end if;

  -- Store answer on matches (simple question path; keep until clear_round_results)
  if v_p1_is then
    update public.matches
    set player1_answer = p_answer,
        player1_answered_at = v_now
    where id = p_match_id;
  else
    update public.matches
    set player2_answer = p_answer,
        player2_answered_at = v_now
    where id = p_match_id;
  end if;

  -- Refresh current answers
  select player1_answer, player2_answer
  into v_p1_answer, v_p2_answer
  from public.matches
  where id = p_match_id;

  -- If both not answered yet, just ACK
  if v_p1_answer is null or v_p2_answer is null then
    return jsonb_build_object(
      'success', true,
      'both_answered', false,
      'current_round_id', v_match.current_round_id
    );
  end if;

  -- ===== Compute correct answer from match_rounds.question_id (NOT matches.question_id) =====
  select (q.steps->0->>'correctAnswer')::int
  into v_correct_answer
  from public.match_rounds mr
  join public.questions_v2 q on q.id = mr.question_id
  where mr.id = v_match.current_round_id;

  v_p1_correct := (v_p1_answer = v_correct_answer);
  v_p2_correct := (v_p2_answer = v_correct_answer);

  -- Winner logic for simple T/F or MCQ:
  -- one correct beats incorrect; both correct or both incorrect = tie (null)
  v_round_winner :=
    case
      when v_p1_correct and not v_p2_correct then v_match.player1_id
      when v_p2_correct and not v_p1_correct then v_match.player2_id
      else null
    end;

  -- Current wins
  v_p1_wins := coalesce(v_match.player1_round_wins, 0);
  v_p2_wins := coalesce(v_match.player2_round_wins, 0);

  if v_round_winner = v_match.player1_id then
    v_p1_wins := v_p1_wins + 1;
  elsif v_round_winner = v_match.player2_id then
    v_p2_wins := v_p2_wins + 1;
  end if;

  -- Determine match completion
  if v_match.target_rounds_to_win is not null then
    if v_p1_wins >= v_match.target_rounds_to_win then
      v_finished := true;
    elsif v_p2_wins >= v_match.target_rounds_to_win then
      v_finished := true;
    end if;
  end if;

  -- Increment results version and store payload + round identity
  v_results_version := v_match.results_version + 1;

  v_payload := jsonb_build_object(
    'mode', 'simple',
    'round_id', v_match.current_round_id,
    'round_number', v_match.current_round_number,
    'question_id', v_round.question_id,
    'correct_answer', v_correct_answer,
    'p1', jsonb_build_object(
      'answer', v_p1_answer,
      'correct', v_p1_correct,
      'score_delta', case when v_round_winner = v_match.player1_id then 1 else 0 end,
      'total', v_p1_wins
    ),
    'p2', jsonb_build_object(
      'answer', v_p2_answer,
      'correct', v_p2_correct,
      'score_delta', case when v_round_winner = v_match.player2_id then 1 else 0 end,
      'total', v_p2_wins
    ),
    'round_winner', v_round_winner,
    'computed_at', v_now
  );

  update public.matches
  set correct_answer = v_correct_answer,
      player1_correct = v_p1_correct,
      player2_correct = v_p2_correct,
      round_winner = v_round_winner,
      both_answered_at = v_now,
      results_computed_at = v_now,
      results_round_id = v_match.current_round_id,
      results_version = v_results_version,
      results_payload = v_payload,
      player1_round_wins = v_p1_wins,
      player2_round_wins = v_p2_wins,
      status = case when v_finished then 'finished' else v_match.status end,
      winner_id = case
        when v_finished and v_p1_wins >= v_match.target_rounds_to_win then v_match.player1_id
        when v_finished and v_p2_wins >= v_match.target_rounds_to_win then v_match.player2_id
        else v_match.winner_id
      end
  where id = p_match_id;

  -- Also mark round status -> results (optional but helpful)
  update public.match_rounds
  set status = 'results'
  where id = v_match.current_round_id;

  return jsonb_build_object(
    'success', true,
    'both_answered', true,
    'results_version', v_results_version,
    'results_round_id', v_match.current_round_id,
    'results_payload', v_payload
  );
end;
$$;

commit;
```

---

## Migration 3: Clear Round Results

Copy and paste this entire SQL block:

```sql
-- 20251212000006_v2_clear_round_results.sql
begin;

create or replace function public.clear_round_results(
  p_match_id uuid,
  p_expected_round_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match not found';
  end if;

  -- Safety: no-op if results_round_id is NULL (first round / abandoned match)
  if v_match.results_round_id is null then
    return jsonb_build_object('success', true, 'reason', 'nothing_to_clear');
  end if;

  -- Safety: only clear if we're clearing what we think we're clearing
  if v_match.results_round_id is distinct from p_expected_round_id then
    return jsonb_build_object(
      'success', false,
      'reason', 'results_round_id_mismatch',
      'results_round_id', v_match.results_round_id,
      'expected_round_id', p_expected_round_id
    );
  end if;

  update public.matches
  set results_computed_at = null,
      results_payload = null,
      results_round_id = null,

      -- clear per-round answer fields (simple question path)
      player1_answer = null,
      player2_answer = null,
      player1_answered_at = null,
      player2_answered_at = null,
      both_answered_at = null,
      correct_answer = null,
      player1_correct = null,
      player2_correct = null,
      round_winner = null
  where id = p_match_id;

  return jsonb_build_object('success', true);
end;
$$;

commit;
```

---

## Migration 4: Enable Realtime + RLS

Copy and paste this entire SQL block:

```sql
-- 20251212000005_v2_enable_realtime_and_rls.sql
begin;

-- Enable RLS on matches (if not already enabled)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies if they exist
DROP POLICY IF EXISTS "Players can view their own matches" ON public.matches;

-- Create strict SELECT policy for matches
CREATE POLICY "Players can view their own matches"
  ON public.matches FOR SELECT
  USING (
    player1_id = auth.uid() OR player2_id = auth.uid()
  );

-- Enable RLS on match_rounds (if not already enabled)
ALTER TABLE public.match_rounds ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies if they exist
DROP POLICY IF EXISTS "Players can view their match rounds" ON public.match_rounds;

-- Create strict SELECT policy for match_rounds
CREATE POLICY "Players can view their match rounds"
  ON public.match_rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_rounds.match_id
      AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );

-- Add match_rounds to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'match_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_rounds;
  END IF;
END $$;

commit;
```

---

## After Applying Migrations:

1. ✅ Verify columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name IN ('current_round_id', 'results_round_id', 'results_version', 'results_payload');
```

2. ✅ Verify functions exist:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('submit_round_answer_v2', 'clear_round_results');
```

3. ✅ Test Realtime:
- Go to Database → Replication
- Verify `match_rounds` is in the publication

4. ✅ Deploy Edge Function:
```bash
supabase functions deploy game-ws
```

---

## Alternative: Fix CLI Authentication

If you prefer to use CLI, set the password:

**Windows PowerShell:**
```powershell
$env:SUPABASE_DB_PASSWORD = "your-database-password"
supabase db push
```

**Or permanently in .env file:**
```
SUPABASE_DB_PASSWORD=your-database-password
```

To get your database password: Supabase Dashboard → Project Settings → Database → Database Password (reset if needed).










