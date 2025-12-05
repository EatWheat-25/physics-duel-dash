-- ========================================
-- Add Match Scoring Fields
-- 
-- Adds scoring, win condition, and lifecycle tracking fields to matches table.
-- Updates status constraint to exactly: 'pending' | 'in_progress' | 'finished' | 'abandoned'
-- ========================================

-- Add scoring and lifecycle columns
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS target_points        INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_rounds           INT NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS player1_score        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player2_score        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winner_id            UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS started_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_round_number INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rules_version        INT NOT NULL DEFAULT 1;

-- Update status constraint to exactly: 'pending' | 'in_progress' | 'finished' | 'abandoned'
-- First, drop the old constraint if it exists
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

-- Update any existing 'active' status to 'in_progress'
UPDATE public.matches
SET status = 'in_progress'
WHERE status = 'active';

-- Add the new constraint with exact status values
ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check 
  CHECK (status IN ('pending', 'in_progress', 'finished', 'abandoned'));

-- Comments documenting semantics
COMMENT ON COLUMN public.matches.current_round_number IS 'Number of completed rounds (incremented in evaluate_round)';
COMMENT ON COLUMN public.matches.winner_id IS 'Winner when match finishes. NULL = draw when final scores are equal';
COMMENT ON COLUMN public.matches.target_points IS 'Points needed to win (first to X)';
COMMENT ON COLUMN public.matches.max_rounds IS 'Maximum rounds before forced end (best-of-9 style)';
COMMENT ON COLUMN public.matches.rules_version IS 'Version for future rule changes';




