-- ========================================
-- Stage 3: Update Force Timeout for Tug-of-War
-- 
-- Updates timeout handler to apply tug-of-war logic when timeout occurs.
-- Server-only function - clients cannot trigger timeouts.
-- ========================================

CREATE OR REPLACE FUNCTION public.force_timeout_stage3(p_match_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_correct_answer INTEGER;
  v_round_winner UUID;
  v_new_last_round_winner UUID;
  v_new_consecutive_wins_count INT;
  v_should_finish_match BOOLEAN := false;
BEGIN
  -- Safety guards
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

  -- Fetch correct answer
  SELECT (steps->0->>'correctAnswer')::int
  INTO v_correct_answer
  FROM public.questions_v2
  WHERE id = v_match.question_id;

  -- Mark unanswered players as wrong and compute round_winner
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
    END
  WHERE id = p_match_id
    AND results_computed_at IS NULL
  RETURNING round_winner INTO v_round_winner;

  -- Fetch updated match to get round_winner
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  -- Tug-of-war logic: Option 1 (loss resets to neutral)
  IF v_round_winner IS NULL THEN
    -- Draw: reset to neutral
    v_new_last_round_winner := NULL;
    v_new_consecutive_wins_count := 0;
  ELSIF v_match.last_round_winner IS NULL THEN
    -- First win: start streak
    v_new_last_round_winner := v_round_winner;
    v_new_consecutive_wins_count := 1;
  ELSIF v_round_winner = v_match.last_round_winner THEN
    -- Same player wins again: increment streak
    v_new_last_round_winner := v_round_winner;
    v_new_consecutive_wins_count := v_match.consecutive_wins_count + 1;
  ELSE
    -- Winner changed: RESET TO NEUTRAL (bar resets)
    v_new_last_round_winner := NULL;
    v_new_consecutive_wins_count := 0;
  END IF;

  -- Check win condition: 2+ consecutive wins
  IF v_new_consecutive_wins_count >= 2 AND v_new_last_round_winner = v_round_winner THEN
    v_should_finish_match := true;
  END IF;

  -- Update tug-of-war state and check win condition
  UPDATE public.matches
  SET
    last_round_winner = v_new_last_round_winner,
    consecutive_wins_count = v_new_consecutive_wins_count,
    round_number = round_number + 1,
    winner_id = CASE WHEN v_should_finish_match THEN v_round_winner ELSE winner_id END,
    status = CASE WHEN v_should_finish_match THEN 'finished' ELSE status END,
    completed_at = CASE WHEN v_should_finish_match THEN NOW() ELSE completed_at END,
    results_computed_at = NOW()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true, 'timeout_applied', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Set search_path explicitly (defense in depth)
ALTER FUNCTION public.force_timeout_stage3(UUID) SET search_path = public;

-- ⚠️ CRITICAL LANDMINE #1: DO NOT grant this to authenticated - server-only timeout handler

