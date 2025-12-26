-- Add subject and level columns to questions table
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'physics',
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'a2';

CREATE INDEX IF NOT EXISTS idx_questions_subject_level
  ON public.questions(subject, level);



































