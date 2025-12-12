-- ========================================
-- V2: Submit Round Answer RPC (Single Source of Truth)
-- 
-- Atomically handles:
-- - Answer submission
-- - Result computation (correctness, round winner)
-- - Round wins tracking
-- - Match completion check
-- - Answer clearing for next round
-- 
-- This RPC is the single source of truth for all answer/results/round logic.
-- Server just calls it and uses the return value.
-- 
-- Security: Granted to authenticated users (players submit their own answers)
-- ========================================

CREATE OR REPLACE FUNCTION public.submit_round_answer_v2(
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
  v_player1_round_wins INT;
  v_player2_round_wins INT;
  v_target_rounds_to_win INT;
  v_match_over BOOLEAN := false;
  v_match_winner_id UUID;
  v_next_round_ready BOOLEAN := false;
  v_round_number INT;
  v_p1_answer INTEGER;
  v_p2_answer INTEGER;
BEGIN
  -- 1. Validate: Get match and verify player is in it
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
    AND (player1_id = p_player_id OR player2_id = p_player_id)
    AND question_id IS NOT NULL
    AND results_computed_at IS NULL
    AND status = 'in_progress'
    AND winner_id IS NULL;
  
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
  
  -- 7. Check if both answered (in same transaction) and get current match state
  SELECT 
    (player1_answer IS NOT NULL AND player2_answer IS NOT NULL) as both_answered,
    player1_answer,
    player2_answer,
    COALESCE(player1_round_wins, 0),
    COALESCE(player2_round_wins, 0),
    COALESCE(target_rounds_to_win, 4),
    COALESCE(round_number, 0)
  INTO v_both_answered, v_p1_answer, v_p2_answer,
       v_player1_round_wins, v_player2_round_wins, v_target_rounds_to_win, v_round_number
  FROM public.matches
  WHERE id = p_match_id;
  
  -- 8. If both answered, compute results and update round wins atomically
  IF v_both_answered THEN
    -- Fetch correct answer from question (do this once)
    SELECT (steps->0->>'correctAnswer')::int
    INTO v_correct_answer
    FROM public.questions_v2
    WHERE id = v_match.question_id;
    
    -- Determine round winner based on correctness
    IF v_p1_answer = v_correct_answer AND v_p2_answer != v_correct_answer THEN
      v_round_winner := v_match.player1_id;
    ELSIF v_p2_answer = v_correct_answer AND v_p1_answer != v_correct_answer THEN
      v_round_winner := v_match.player2_id;
    ELSE
      v_round_winner := NULL; -- Draw
    END IF;
    
    -- Update round wins based on round winner
    IF v_round_winner = v_match.player1_id THEN
      v_player1_round_wins := v_player1_round_wins + 1;
    ELSIF v_round_winner = v_match.player2_id THEN
      v_player2_round_wins := v_player2_round_wins + 1;
    END IF;
    
    -- Check if match is over
    IF v_player1_round_wins >= v_target_rounds_to_win THEN
      v_match_over := true;
      v_match_winner_id := v_match.player1_id;
    ELSIF v_player2_round_wins >= v_target_rounds_to_win THEN
      v_match_over := true;
      v_match_winner_id := v_match.player2_id;
    END IF;
    
    -- Increment round number
    v_round_number := v_round_number + 1;
    
    -- Update match with all results, round wins, and match status
    UPDATE public.matches
    SET 
      both_answered_at = NOW(),
      correct_answer = v_correct_answer,
      player1_correct = (v_p1_answer = v_correct_answer),
      player2_correct = (v_p2_answer = v_correct_answer),
      round_winner = v_round_winner,
      results_computed_at = NOW(),
      player1_round_wins = v_player1_round_wins,
      player2_round_wins = v_player2_round_wins,
      round_number = v_round_number,
      winner_id = CASE WHEN v_match_over THEN v_match_winner_id ELSE NULL END,
      status = CASE WHEN v_match_over THEN 'completed' ELSE 'in_progress' END
    WHERE id = p_match_id
      AND results_computed_at IS NULL;
    
    -- If match continues, clear answer fields for next round
    IF NOT v_match_over THEN
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
        results_computed_at = NULL
      WHERE id = p_match_id;
      v_next_round_ready := true;
    END IF;
    
    -- Return full result payload (use values we computed, not DB selects)
    RETURN jsonb_build_object(
      'success', true,
      'both_answered', true,
      'result', jsonb_build_object(
        'player1_answer', v_p1_answer,
        'player2_answer', v_p2_answer,
        'correct_answer', v_correct_answer,
        'player1_correct', (v_p1_answer = v_correct_answer),
        'player2_correct', (v_p2_answer = v_correct_answer),
        'round_winner', v_round_winner,
        'round_number', v_round_number,
        'target_rounds_to_win', v_target_rounds_to_win,
        'player1_round_wins', v_player1_round_wins,
        'player2_round_wins', v_player2_round_wins,
        'player_round_wins', jsonb_build_object(
          v_match.player1_id::text, v_player1_round_wins,
          v_match.player2_id::text, v_player2_round_wins
        ),
        'match_over', v_match_over,
        'match_winner_id', v_match_winner_id,
        'next_round_ready', v_next_round_ready
      )
    );
  ELSE
    -- Only one answered - return simple response
    RETURN jsonb_build_object(
      'success', true,
      'both_answered', false
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Set search_path explicitly (defense in depth)
ALTER FUNCTION public.submit_round_answer_v2(UUID, UUID, INTEGER) SET search_path = public;

-- Grant to authenticated users (players submit their own answers)
GRANT EXECUTE ON FUNCTION public.submit_round_answer_v2(UUID, UUID, INTEGER) TO authenticated;

