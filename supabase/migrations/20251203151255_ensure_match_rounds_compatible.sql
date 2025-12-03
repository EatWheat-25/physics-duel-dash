-- ========================================
-- Ensure Match Rounds Table Compatibility
-- 
-- Ensures match_rounds references matches (not matches_new) and has all required columns
-- for scoring, answer payloads, and round lifecycle tracking.
-- ========================================

-- Ensure match_id references public.matches (not matches_new)
-- Drop and recreate foreign key if it references wrong table
DO $$
BEGIN
  -- Check if foreign key exists and references wrong table
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'match_rounds'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'match_id'
  ) THEN
    -- Drop existing foreign key
    ALTER TABLE public.match_rounds DROP CONSTRAINT IF EXISTS match_rounds_match_id_fkey;
  END IF;
END $$;

-- Add foreign key to public.matches
ALTER TABLE public.match_rounds
  DROP CONSTRAINT IF EXISTS match_rounds_match_id_fkey,
  ADD CONSTRAINT match_rounds_match_id_fkey 
    FOREIGN KEY (match_id) 
    REFERENCES public.matches(id) 
    ON DELETE CASCADE;

-- Add required columns
ALTER TABLE public.match_rounds
  ADD COLUMN IF NOT EXISTS round_number             INT,
  ADD COLUMN IF NOT EXISTS player1_round_score      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player2_round_score      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player1_answered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS player2_answered_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS player1_answer_payload   JSONB,
  ADD COLUMN IF NOT EXISTS player2_answer_payload   JSONB,
  ADD COLUMN IF NOT EXISTS round_deadline            TIMESTAMPTZ;

-- Make round_number NOT NULL after ensuring existing rows have values
-- Set default to 1 for existing rows if null
UPDATE public.match_rounds
SET round_number = 1
WHERE round_number IS NULL;

ALTER TABLE public.match_rounds
  ALTER COLUMN round_number SET NOT NULL;

-- Update status constraint to include 'evaluating'
ALTER TABLE public.match_rounds DROP CONSTRAINT IF EXISTS match_rounds_status_check;

-- Update any existing status values if needed
UPDATE public.match_rounds
SET status = 'finished'
WHERE status NOT IN ('active', 'evaluating', 'finished');

-- Add new constraint with exact status values
ALTER TABLE public.match_rounds
  ADD CONSTRAINT match_rounds_status_check 
  CHECK (status IN ('active', 'evaluating', 'finished'));

-- Comments documenting semantics
COMMENT ON TABLE public.match_rounds IS 'One question = one round. Tracks round-level scoring and answer payloads.';
COMMENT ON COLUMN public.match_rounds.round_number IS 'Display index for this round (1-based)';
COMMENT ON COLUMN public.match_rounds.round_deadline IS 'Round-level timeout cut-off';
COMMENT ON COLUMN public.match_rounds.player1_answer_payload IS 'Full answer payload (versioned JSON). Format: {"version": 1, "steps": [{"step_index": 0, "answer_index": 2, "response_time_ms": 1200}, ...]}. Single source of truth for step-level analytics.';
COMMENT ON COLUMN public.match_rounds.player2_answer_payload IS 'Full answer payload (versioned JSON). Format: {"version": 1, "steps": [{"step_index": 0, "answer_index": 2, "response_time_ms": 1200}, ...]}. Single source of truth for step-level analytics.';


