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
-- Add columns first without FK constraints (FK will be added after match_rounds is confirmed to exist)
alter table public.matches
  add column if not exists current_round_id uuid null,
  add column if not exists current_round_number int not null default 0,
  add column if not exists results_round_id uuid null,
  add column if not exists results_version int not null default 0,
  add column if not exists results_payload jsonb null;

-- Add foreign key constraints only if match_rounds table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_rounds') then
    -- Add FK constraints if match_rounds exists
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

-- results_computed_at already exists; keep as compatibility signal

-- ===== match_rounds: status + payload defaults + elimination/deadlines =====
-- Only alter match_rounds if it exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_rounds') then
    -- Add new columns
    alter table public.match_rounds
      add column if not exists question_payload jsonb null,
      add column if not exists step_deadlines jsonb null,
      add column if not exists p1_eliminated_at timestamptz null,
      add column if not exists p2_eliminated_at timestamptz null;

    -- Ensure payload columns exist and default cleanly (only if columns exist)
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_rounds' and column_name = 'player1_answer_payload') then
      alter table public.match_rounds
        alter column player1_answer_payload set default '{"version":2,"steps":[]}'::jsonb;
    end if;
    
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_rounds' and column_name = 'player2_answer_payload') then
      alter table public.match_rounds
        alter column player2_answer_payload set default '{"version":2,"steps":[]}'::jsonb;
    end if;

    -- Migrate existing status values to new phase model
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

    -- Drop any existing CHECK constraint that mentions "status"
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

    -- Add new status CHECK constraint (drop first if exists)
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
