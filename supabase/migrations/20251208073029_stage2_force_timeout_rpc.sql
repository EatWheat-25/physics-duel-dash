-- ========================================
-- Stage 2: Force Timeout RPC
-- 
-- Server-only function to mark unanswered player as wrong after timeout.
-- Prevents matches from being stuck forever.
-- 
-- Security: NOT granted to authenticated - only server (service_role) can call
-- ========================================

CREATE OR REPLACE FUNCTION public.force_timeout_stage2(p_match_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_correct_answer INTEGER;
BEGIN
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
    AND question_id IS NOT NULL
    AND results_computed_at IS NULL
    AND status = 'in_progress'  -- Match must be in progress
    AND winner_id IS NULL;  -- No winner yet

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found, not in progress, or results already computed');
  END IF;

  IF v_match.player1_answer IS NOT NULL AND v_match.player2_answer IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Both players already answered');
  END IF;

  SELECT (steps->0->>'correctAnswer')::int
  INTO v_correct_answer
  FROM public.questions_v2
  WHERE id = v_match.question_id;

  UPDATE public.matches
  SET
    player1_answer = COALESCE(player1_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END),
    player2_answer = COALESCE(player2_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END),
    player1_answered_at = COALESCE(player1_answered_at, NOW()),
    player2_answered_at = COALESCE(player2_answered_at, NOW()),
    both_answered_at = NOW(),
    correct_answer = v_correct_answer,
    player1_correct = (COALESCE(player1_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END) = v_correct_answer),
    player2_correct = (COALESCE(player2_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END) = v_correct_answer),
    round_winner = CASE
      WHEN (COALESCE(player1_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END) = v_correct_answer)
       AND (COALESCE(player2_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END) <> v_correct_answer)
        THEN player1_id
      WHEN (COALESCE(player2_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END) = v_correct_answer)
       AND (COALESCE(player1_answer, CASE WHEN v_correct_answer = 0 THEN 1 ELSE 0 END) <> v_correct_answer)
        THEN player2_id
      ELSE NULL
    END,
    results_computed_at = NOW()
  WHERE id = p_match_id
    AND results_computed_at IS NULL;

  RETURN jsonb_build_object('success', true, 'timeout_applied', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Set search_path explicitly (defense in depth)
ALTER FUNCTION public.force_timeout_stage2(UUID) SET search_path = public;

-- SECURITY: Do NOT grant to authenticated users - only server (service_role) should call this
-- This prevents griefing/cheating by allowing players to force timeouts
-- Server calls this via service_role key, so no GRANT needed


