-- ========================================
-- Manual Fix: Create match_rounds table
-- 
-- This migration was marked as applied but the table doesn't exist.
-- Run this in Supabase Dashboard → SQL Editor, then run: supabase db push
-- ========================================

BEGIN;

-- Create match_rounds table if it doesn't exist
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

-- Add columns to matches table
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS current_round_id uuid null,
  ADD COLUMN IF NOT EXISTS current_round_number int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results_round_id uuid null,
  ADD COLUMN IF NOT EXISTS results_version int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results_payload jsonb null;

-- Add foreign key constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_rounds') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'matches_current_round_id_fkey' 
      AND table_name = 'matches'
    ) THEN
      ALTER TABLE public.matches
        ADD CONSTRAINT matches_current_round_id_fkey 
        FOREIGN KEY (current_round_id) REFERENCES public.match_rounds(id);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'matches_results_round_id_fkey' 
      AND table_name = 'matches'
    ) THEN
      ALTER TABLE public.matches
        ADD CONSTRAINT matches_results_round_id_fkey 
        FOREIGN KEY (results_round_id) REFERENCES public.match_rounds(id);
    END IF;
  END IF;
END $$;

-- Add additional columns to match_rounds
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_rounds') THEN
    ALTER TABLE public.match_rounds
      ADD COLUMN IF NOT EXISTS question_payload jsonb null,
      ADD COLUMN IF NOT EXISTS step_deadlines jsonb null,
      ADD COLUMN IF NOT EXISTS p1_eliminated_at timestamptz null,
      ADD COLUMN IF NOT EXISTS p2_eliminated_at timestamptz null;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'match_rounds' AND column_name = 'player1_answer_payload') THEN
      ALTER TABLE public.match_rounds
        ALTER COLUMN player1_answer_payload SET DEFAULT '{"version":2,"steps":[]}'::jsonb;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'match_rounds' AND column_name = 'player2_answer_payload') THEN
      ALTER TABLE public.match_rounds
        ALTER COLUMN player2_answer_payload SET DEFAULT '{"version":2,"steps":[]}'::jsonb;
    END IF;

    -- Update status values
    UPDATE public.match_rounds
    SET status = CASE status
      WHEN 'active' THEN 'main'
      WHEN 'evaluating' THEN 'steps'
      WHEN 'finished' THEN 'done'
      WHEN 'results' THEN 'results'
      WHEN 'done' THEN 'done'
      WHEN 'main' THEN 'main'
      WHEN 'steps' THEN 'steps'
      ELSE 'main'
    END
    WHERE status IS NOT NULL;

    -- Drop existing status constraints
    DO $inner$
    DECLARE
      r record;
    BEGIN
      FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.match_rounds'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE public.match_rounds DROP CONSTRAINT %I', r.conname);
      END LOOP;
    END $inner$;

    -- Add new status constraint
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'match_rounds_status_check' 
      AND conrelid = 'public.match_rounds'::regclass
    ) THEN
      ALTER TABLE public.match_rounds DROP CONSTRAINT match_rounds_status_check;
    END IF;
    
    ALTER TABLE public.match_rounds
      ADD CONSTRAINT match_rounds_status_check
      CHECK (status IN ('main','steps','results','done'));
  END IF;
END $$;

COMMIT;

