-- ========================================
-- Stage 3: Add Tug-of-War Tracking Columns
-- 
-- Adds columns to track consecutive wins and round progression
-- for the tug-of-war multi-round system.
-- ========================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS last_round_winner UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS consecutive_wins_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_number INT NOT NULL DEFAULT 0;

-- Optional index on last_round_winner for quick lookups (not critical)
CREATE INDEX IF NOT EXISTS idx_matches_last_round_winner 
  ON public.matches(last_round_winner) 
  WHERE last_round_winner IS NOT NULL;

COMMENT ON COLUMN public.matches.last_round_winner IS 'Who won the last round (NULL = neutral/draw)';
COMMENT ON COLUMN public.matches.consecutive_wins_count IS 'Current consecutive wins streak (0, 1, or 2+)';
COMMENT ON COLUMN public.matches.round_number IS 'Total rounds played (incremented after each round)';

