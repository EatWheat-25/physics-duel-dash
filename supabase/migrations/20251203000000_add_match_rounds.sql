-- ========================================
-- Match Rounds Table
-- 
-- Tracks which question is assigned to each match.
-- Ensures idempotency: each match gets exactly one question.
-- ========================================

-- Create match_rounds table to track question assignment per match
CREATE TABLE IF NOT EXISTS public.match_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one active round per match
-- Note: We use a partial unique index instead of a constraint to allow multiple finished rounds
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_rounds_match_active 
  ON public.match_rounds(match_id) 
  WHERE status = 'active';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_match_rounds_match_status 
  ON public.match_rounds(match_id, status);

CREATE INDEX IF NOT EXISTS idx_match_rounds_question 
  ON public.match_rounds(question_id);

-- RLS: Players can view rounds for their matches
ALTER TABLE public.match_rounds ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Players can view their match rounds" ON public.match_rounds;

CREATE POLICY "Players can view their match rounds"
  ON public.match_rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_rounds.match_id
      AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );

