-- ========================================
-- Stage 2: Submit Answer RPC
-- 
-- Atomically submits a player's answer, detects when both players answered,
-- and computes results in a single transaction.
-- 
-- Security: Granted to authenticated users (players submit their own answers)
-- ========================================

CREATE OR REPLACE FUNCTION public.submit_answer_stage2(
  p_match_id UUID,
  p_player_id UUID,
  p_answer INTEGER  -- 0 or 1 for True/False
) RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_is_player1 BOOLEAN;
  v_both_answered BOOLEAN := false;
  v_correct_answer INTEGER;
  v_update_count INTEGER;
BEGIN
  -- 1. Validate: Get match and verify player is in it
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
    AND (player1_id = p_player_id OR player2_id = p_player_id)
    AND question_id IS NOT NULL
    AND results_computed_at IS NULL
    AND status = 'in_progress'  -- Match must be in progress
    AND winner_id IS NULL;  -- No winner yet
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Match not found, player not in match, or results already computed'
    );
  END IF;
  
  -- 2. Validate: Answer must be 0 or 1 (True/False)
  IF p_answer NOT IN (0, 1) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid answer: must be 0 or 1'
    );
  END IF;
  
  -- 3. Determine which player
  v_is_player1 := (v_match.player1_id = p_player_id);
  
  -- 4. Check if already answered (idempotency)
  IF (v_is_player1 AND v_match.player1_answer IS NOT NULL) OR
     (NOT v_is_player1 AND v_match.player2_answer IS NOT NULL) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Answer already submitted',
      'already_answered', true
    );
  END IF;
  
  -- 5. Atomic update: Set answer + timestamp
  IF v_is_player1 THEN
    UPDATE public.matches
    SET player1_answer = p_answer,
        player1_answered_at = NOW()
    WHERE id = p_match_id
      AND player1_answer IS NULL;
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
  ELSE
    UPDATE public.matches
    SET player2_answer = p_answer,
        player2_answered_at = NOW()
    WHERE id = p_match_id
      AND player2_answer IS NULL;
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
  END IF;
  
  -- 6. Check FOUND: If update didn't affect any rows, race condition occurred
  IF v_update_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Answer already submitted (race condition)',
      'already_answered', true
    );
  END IF;
  
  -- 7. Check if both answered (in same transaction)
  SELECT 
    player1_answer IS NOT NULL AND player2_answer IS NOT NULL
  INTO v_both_answered
  FROM public.matches
  WHERE id = p_match_id;
  
  -- 8. If both answered, compute results atomically
  IF v_both_answered THEN
    -- Fetch correct answer from question
    SELECT (steps->0->>'correctAnswer')::int
    INTO v_correct_answer
    FROM public.questions_v2
    WHERE id = (SELECT question_id FROM public.matches WHERE id = p_match_id);
    
    -- Compute results and store authoritatively
    UPDATE public.matches
    SET 
      both_answered_at = NOW(),
      correct_answer = v_correct_answer,
      player1_correct = (player1_answer = v_correct_answer),
      player2_correct = (player2_answer = v_correct_answer),
      round_winner = CASE
        WHEN player1_answer = v_correct_answer AND player2_answer != v_correct_answer THEN player1_id
        WHEN player2_answer = v_correct_answer AND player1_answer != v_correct_answer THEN player2_id
        ELSE NULL
      END,
      results_computed_at = NOW()
    WHERE id = p_match_id
      AND results_computed_at IS NULL;
  END IF;
  
  -- 9. Return result
  RETURN jsonb_build_object(
    'success', true,
    'both_answered', v_both_answered,
    'player1_answer', (SELECT player1_answer FROM public.matches WHERE id = p_match_id),
    'player2_answer', (SELECT player2_answer FROM public.matches WHERE id = p_match_id),
    'results_ready', v_both_answered
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Set search_path explicitly (defense in depth)
ALTER FUNCTION public.submit_answer_stage2(UUID, UUID, INTEGER) SET search_path = public;

-- Grant to authenticated users (players submit their own answers)
GRANT EXECUTE ON FUNCTION public.submit_answer_stage2(UUID, UUID, INTEGER) TO authenticated;


