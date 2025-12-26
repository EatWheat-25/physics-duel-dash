-- Add subject and level columns to matchmaking_queue table
ALTER TABLE public.matchmaking_queue
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'maths',
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'a2';

CREATE INDEX IF NOT EXISTS idx_queue_subject_level_status
  ON public.matchmaking_queue(subject, level, status);



































