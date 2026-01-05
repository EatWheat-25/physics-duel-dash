-- Add enabled/disabled flag for questions_v2
-- Disabled questions should be excluded from online matchmaking selection (handled in Edge Function)

ALTER TABLE public.questions_v2
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS questions_v2_is_enabled_idx
  ON public.questions_v2 (is_enabled);

COMMENT ON COLUMN public.questions_v2.is_enabled IS
  'Admin-controlled flag. When false, this question should not be selected for online battles.';


