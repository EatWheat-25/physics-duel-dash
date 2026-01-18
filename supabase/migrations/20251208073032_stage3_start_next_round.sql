-- ========================================
-- Stage 3: Start Next Round RPC
-- 
-- Clears answer fields and prepares match for next round.
-- Server-only function - clients cannot trigger round resets.
-- ========================================

CREATE OR REPLACE FUNCTION public.start_next_round_stage3(p_match_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_update_count INTEGER;
BEGIN
  UPDATE public.matches
  SET
    player1_answer = NULL,
    player2_answer = NULL,
    player1_answered_at = NULL,
    player2_answered_at = NULL,
    both_answered_at = NULL,
    correct_answer = NULL,
    player1_correct = NULL,
    player2_correct = NULL,
    round_winner = NULL,
    results_computed_at = NULL,
    results_payload = NULL,
    results_round_id = NULL,
    results_version = COALESCE(results_version, 0) + 1,
    question_id = NULL,
    question_sent_at = NULL
  WHERE id = p_match_id
    AND status = 'in_progress'
    AND winner_id IS NULL
    AND results_computed_at IS NOT NULL
    AND question_id IS NOT NULL;
  
  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  
  IF v_update_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not ready for transition');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Explicit search_path (defense in depth)
ALTER FUNCTION public.start_next_round_stage3(UUID) SET search_path = public;

-- ⚠️ CRITICAL LANDMINE #1: Server-only - DO NOT grant to authenticated
-- A salty user could spam-reset rounds mid-fight if this is granted

