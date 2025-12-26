-- ========================================
-- V2: Add Round Wins Tracking Columns
-- 
-- Adds columns to matches table for tracking round wins per player.
-- This enables DB-driven round wins tracking instead of in-memory state.
-- ========================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS player1_round_wins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player2_round_wins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_rounds_to_win INT NOT NULL DEFAULT 4;

-- Index for fast lookups on round wins
CREATE INDEX IF NOT EXISTS idx_matches_round_wins 
  ON public.matches(player1_round_wins, player2_round_wins) 
  WHERE status = 'in_progress';

-- Comments
COMMENT ON COLUMN public.matches.player1_round_wins IS 'Number of rounds won by player1';
COMMENT ON COLUMN public.matches.player2_round_wins IS 'Number of rounds won by player2';
COMMENT ON COLUMN public.matches.target_rounds_to_win IS 'Number of rounds needed to win the match (default: 4)';











