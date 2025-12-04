-- ========================================
-- Set max_rounds to 3 for testing
-- ========================================

-- Change the default for new matches
ALTER TABLE public.matches
  ALTER COLUMN max_rounds SET DEFAULT 3;

-- Update existing pending/in_progress matches to 3 rounds
UPDATE public.matches
SET max_rounds = 3
WHERE status IN ('pending', 'in_progress');

-- Update the comment
COMMENT ON COLUMN public.matches.max_rounds IS 'Maximum rounds before forced end (set to 3 for testing)';

