-- ========================================
-- Stage 2: Add Answer Columns to Matches
-- 
-- Adds columns for storing player answers, timestamps, and computed results.
-- Enables atomic answer submission and result computation.
-- ========================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS player1_answer INTEGER,
  ADD COLUMN IF NOT EXISTS player2_answer INTEGER,
  ADD COLUMN IF NOT EXISTS player1_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS player2_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS both_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correct_answer INTEGER,
  ADD COLUMN IF NOT EXISTS player1_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS player2_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS round_winner UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS results_computed_at TIMESTAMPTZ;

-- Index for fast lookups on completed rounds
CREATE INDEX IF NOT EXISTS idx_matches_both_answered 
  ON public.matches(both_answered_at) 
  WHERE both_answered_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.matches.player1_answer IS 'Answer index (0 or 1 for True/False) submitted by player1';
COMMENT ON COLUMN public.matches.player2_answer IS 'Answer index (0 or 1 for True/False) submitted by player2';
COMMENT ON COLUMN public.matches.correct_answer IS 'Authoritative correct answer from question.steps[0].correctAnswer';
COMMENT ON COLUMN public.matches.round_winner IS 'Winner of this round (player1_id, player2_id, or NULL for draw)';
COMMENT ON COLUMN public.matches.results_computed_at IS 'Timestamp when results were computed (idempotency guard)';


