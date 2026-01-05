-- Set default Main Question timer to 180 seconds (3 minutes)
-- Applies to all questions in questions_v2.

-- Defensive: ensure column exists (older DBs / partial migrations)
ALTER TABLE public.questions_v2
  ADD COLUMN IF NOT EXISTS main_question_timer_seconds integer;

-- Apply 180s to ALL existing questions
UPDATE public.questions_v2
SET main_question_timer_seconds = 180;

-- Ensure future inserts default to 180s and remain non-null
ALTER TABLE public.questions_v2
  ALTER COLUMN main_question_timer_seconds SET DEFAULT 180,
  ALTER COLUMN main_question_timer_seconds SET NOT NULL;



