-- ========================================
-- V2: Get Match Round State RPC (Polling Fallback)
-- 
-- Returns current match state for client polling fallback.
-- Used when WebSocket RESULTS_RECEIVED message doesn't arrive
-- (e.g., when players are on different Edge Function instances).
-- 
-- Security: Granted to authenticated users (players can poll their own matches)
-- ========================================

CREATE OR REPLACE FUNCTION public.get_match_round_state_v2(
  p_match_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_correct_answer INTEGER;
  v_both_answered BOOLEAN;
BEGIN
  -- Get match and verify it exists and is in progress
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
    AND (player1_id = auth.uid() OR player2_id = auth.uid())
    AND status = 'in_progress';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'both_answered', false,
      'error', 'Match not found or not accessible'
    );
  END IF;
  
  -- Check if both answered and results are computed
  v_both_answered := (v_match.player1_answer IS NOT NULL 
                      AND v_match.player2_answer IS NOT NULL 
                      AND v_match.results_computed_at IS NOT NULL);
  
  IF NOT v_both_answered THEN
    RETURN jsonb_build_object(
      'both_answered', false
    );
  END IF;
  
  -- Both answered and results computed - return full result payload
  -- (same format as submit_round_answer_v2)
  RETURN jsonb_build_object(
    'both_answered', true,
    'result', jsonb_build_object(
      'player1_answer', v_match.player1_answer,
      'player2_answer', v_match.player2_answer,
      'correct_answer', v_match.correct_answer,
      'player1_correct', v_match.player1_correct,
      'player2_correct', v_match.player2_correct,
      'round_winner', v_match.round_winner,
      'round_number', COALESCE(v_match.round_number, 0),
      'target_rounds_to_win', COALESCE(v_match.target_rounds_to_win, 4),
      'player1_round_wins', COALESCE(v_match.player1_round_wins, 0),
      'player2_round_wins', COALESCE(v_match.player2_round_wins, 0),
      'player_round_wins', jsonb_build_object(
        v_match.player1_id::text, COALESCE(v_match.player1_round_wins, 0),
        v_match.player2_id::text, COALESCE(v_match.player2_round_wins, 0)
      ),
      'match_over', (v_match.winner_id IS NOT NULL OR v_match.status = 'completed'),
      'match_winner_id', v_match.winner_id,
      'next_round_ready', (v_match.winner_id IS NULL AND v_match.status = 'in_progress' 
                           AND v_match.player1_answer IS NULL AND v_match.player2_answer IS NULL)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Set search_path explicitly (defense in depth)
ALTER FUNCTION public.get_match_round_state_v2(UUID) SET search_path = public;

-- Grant to authenticated users (players can poll their own matches)
GRANT EXECUTE ON FUNCTION public.get_match_round_state_v2(UUID) TO authenticated;

