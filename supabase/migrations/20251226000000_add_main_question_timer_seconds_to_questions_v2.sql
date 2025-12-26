-- Add configurable main-question timer to questions_v2
-- Default: 90s, Allowed range: 5–600s

ALTER TABLE public.questions_v2
  ADD COLUMN IF NOT EXISTS main_question_timer_seconds integer;

-- Backfill existing rows
UPDATE public.questions_v2
SET main_question_timer_seconds = 90
WHERE main_question_timer_seconds IS NULL;

-- Enforce default + non-null
ALTER TABLE public.questions_v2
  ALTER COLUMN main_question_timer_seconds SET DEFAULT 90,
  ALTER COLUMN main_question_timer_seconds SET NOT NULL;

-- Range constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_v2_main_question_timer_seconds_range'
  ) THEN
    ALTER TABLE public.questions_v2
      ADD CONSTRAINT questions_v2_main_question_timer_seconds_range
      CHECK (main_question_timer_seconds BETWEEN 5 AND 600);
  END IF;
END $$;

COMMENT ON COLUMN public.questions_v2.main_question_timer_seconds IS 'Time limit (seconds) for the main question phase before steps (5–600).';


