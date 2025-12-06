-- Add idempotency columns to matches table
-- These track if/when a question was sent to prevent duplicate sends

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS question_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS question_id UUID;

-- Index for performance (speeds up the atomic lock check)
CREATE INDEX IF NOT EXISTS idx_matches_question_id ON public.matches(question_id);

-- Optional FK (only if you're confident questions_v2 is stable)
-- Uncomment if you want referential integrity:
-- ALTER TABLE public.matches
--   ADD CONSTRAINT matches_question_id_fkey
--   FOREIGN KEY (question_id) REFERENCES public.questions_v2(id)
--   ON DELETE SET NULL;

