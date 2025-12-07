-- Stage 1b: Add idempotency columns to matches table
-- questions_v2.id is UUID (verified in 20251127000000_questions_v2_clean.sql)
-- This enables atomic question claim to ensure both players see same question

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS question_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES public.questions_v2(id);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_matches_question_id 
  ON public.matches(question_id) 
  WHERE question_id IS NOT NULL;

