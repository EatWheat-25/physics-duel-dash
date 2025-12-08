-- ========================================
-- Stage 3: Update submit_answer_stage2 for Tug-of-War
-- 
-- Adds tug-of-war logic: tracks consecutive wins and checks win condition.
-- 
-- CRITICAL: Preserves all Stage 2 safety guards and grants.
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
  v_round_winner UUID;
  v_current_last_round_winner UUID;
  v_current_consecutive_wins_count INT;
  v_new_last_round_winner UUID;
  v_new_consecutive_wins_count INT;
  v_should_finish_match BOOLEAN := false;
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
  
  -- 8. If both answered, compute results atomically + tug-of-war logic
  IF v_both_answered THEN
    -- Fetch correct answer from question
    SELECT (steps->0->>'correctAnswer')::int
    INTO v_correct_answer
    FROM public.questions_v2
    WHERE id = (SELECT question_id FROM public.matches WHERE id = p_match_id);
    
    -- Compute round_winner
    v_round_winner := CASE
      WHEN (SELECT player1_answer FROM public.matches WHERE id = p_match_id) = v_correct_answer 
       AND (SELECT player2_answer FROM public.matches WHERE id = p_match_id) != v_correct_answer 
        THEN v_match.player1_id
      WHEN (SELECT player2_answer FROM public.matches WHERE id = p_match_id) = v_correct_answer 
       AND (SELECT player1_answer FROM public.matches WHERE id = p_match_id) != v_correct_answer 
        THEN v_match.player2_id
      ELSE NULL
    END;
    
    -- Fetch current tug-of-war state (before updating)
    SELECT last_round_winner, consecutive_wins_count
    INTO v_current_last_round_winner, v_current_consecutive_wins_count
    FROM public.matches
    WHERE id = p_match_id;
    
    -- Tug-of-war logic: Option 1 (loss resets to neutral)
    IF v_round_winner IS NULL THEN
      -- Draw: reset to neutral
      v_new_last_round_winner := NULL;
      v_new_consecutive_wins_count := 0;
    ELSIF v_current_last_round_winner IS NULL THEN
      -- First win: start streak
      v_new_last_round_winner := v_round_winner;
      v_new_consecutive_wins_count := 1;
    ELSIF v_round_winner = v_current_last_round_winner THEN
      -- Same player wins again: increment streak
      v_new_last_round_winner := v_round_winner;
      v_new_consecutive_wins_count := COALESCE(v_current_consecutive_wins_count, 0) + 1;
    ELSE
      -- Winner changed: RESET TO NEUTRAL (bar resets)
      v_new_last_round_winner := NULL;
      v_new_consecutive_wins_count := 0;
    END IF;
    
    -- Check win condition: 2+ consecutive wins
    IF v_new_consecutive_wins_count >= 2 AND v_new_last_round_winner = v_round_winner THEN
      v_should_finish_match := true;
    END IF;
    
    -- Compute results and tug-of-war state atomically
    UPDATE public.matches
    SET 
      both_answered_at = NOW(),
      correct_answer = v_correct_answer,
      player1_correct = (player1_answer = v_correct_answer),
      player2_correct = (player2_answer = v_correct_answer),
      round_winner = v_round_winner,
      last_round_winner = v_new_last_round_winner,
      consecutive_wins_count = v_new_consecutive_wins_count,
      round_number = round_number + 1,
      winner_id = CASE WHEN v_should_finish_match THEN v_round_winner ELSE winner_id END,
      status = CASE WHEN v_should_finish_match THEN 'finished' ELSE status END,
      completed_at = CASE WHEN v_should_finish_match THEN NOW() ELSE completed_at END,
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

