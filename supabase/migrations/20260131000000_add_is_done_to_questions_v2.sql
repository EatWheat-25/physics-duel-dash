-- Add done flag for questions_v2
-- Done questions should be easy to spot in admin list views

ALTER TABLE public.questions_v2
  ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS questions_v2_is_done_idx
  ON public.questions_v2 (is_done);

COMMENT ON COLUMN public.questions_v2.is_done IS
  'Admin-controlled flag. When true, this question is marked as done in admin views.';

