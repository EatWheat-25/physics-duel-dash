-- ========================================
-- V2: Compute Multi-Step Results RPC (Database-Driven)
-- 
-- Atomically handles:
-- - Step results computation from step answers
-- - Round winner determination
-- - Round wins tracking
-- - Match completion check
-- - Writing results_payload to matches table
-- 
-- This RPC is the single source of truth for multi-step results.
-- Server calls it when both players complete all steps.
-- Realtime delivers results to both players simultaneously.
-- 
-- Security: Granted to service_role (called by Edge Function)
-- ========================================

CREATE OR REPLACE FUNCTION public.compute_multi_step_results_v2(
  p_match_id UUID,
  p_round_id UUID,
  p_step_results JSONB  -- Array of {stepIndex, p1AnswerIndex, p2AnswerIndex, correctAnswer, p1Marks, p2Marks}
) RETURNS JSONB AS $$
DECLARE
  v_match public.matches%rowtype;
  v_round public.match_rounds%rowtype;
  v_p1_total_score INT := 0;
  v_p2_total_score INT := 0;
  v_round_winner UUID;
  v_p1_wins INT;
  v_p2_wins INT;
  v_finished BOOLEAN := false;
  v_results_version INT;
  v_payload JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_step_result JSONB;
  v_p1_round_wins INT;
  v_p2_round_wins INT;
  v_target_rounds_to_win INT;
BEGIN
  -- ===== NON-NEGOTIABLE: lock match row =====
  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_match.status NOT IN ('pending', 'in_progress') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_active');
  END IF;

  IF v_match.current_round_id IS NULL OR v_match.current_round_id != p_round_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_id_mismatch');
  END IF;

  -- Get round info
  SELECT *
  INTO v_round
  FROM public.match_rounds
  WHERE id = p_round_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'round_not_found');
  END IF;

  -- Idempotency: if results already computed for this round, return existing
  IF v_match.results_computed_at IS NOT NULL 
     AND v_match.results_round_id = p_round_id 
     AND v_match.results_payload IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_computed', true,
      'results_version', v_match.results_version,
      'results_round_id', v_match.results_round_id,
      'results_payload', v_match.results_payload
    );
  END IF;

  -- ===== Compute scores from step results =====
  -- p_step_results is an array of: {stepIndex, p1AnswerIndex, p2AnswerIndex, correctAnswer, p1Marks, p2Marks}
  FOR v_step_result IN SELECT * FROM jsonb_array_elements(p_step_results)
  LOOP
    v_p1_total_score := v_p1_total_score + COALESCE((v_step_result->>'p1Marks')::INT, 0);
    v_p2_total_score := v_p2_total_score + COALESCE((v_step_result->>'p2Marks')::INT, 0);
  END LOOP;

  -- Determine round winner
  IF v_p1_total_score > v_p2_total_score THEN
    v_round_winner := v_match.player1_id;
  ELSIF v_p2_total_score > v_p1_total_score THEN
    v_round_winner := v_match.player2_id;
  ELSE
    v_round_winner := NULL; -- Draw
  END IF;

  -- Get current round wins
  v_p1_wins := COALESCE(v_match.player1_round_wins, 0);
  v_p2_wins := COALESCE(v_match.player2_round_wins, 0);
  v_target_rounds_to_win := COALESCE(v_match.target_rounds_to_win, 4);

  -- Update round wins
  IF v_round_winner = v_match.player1_id THEN
    v_p1_wins := v_p1_wins + 1;
  ELSIF v_round_winner = v_match.player2_id THEN
    v_p2_wins := v_p2_wins + 1;
  END IF;

  -- Check if match is over
  IF v_p1_wins >= v_target_rounds_to_win THEN
    v_finished := true;
  ELSIF v_p2_wins >= v_target_rounds_to_win THEN
    v_finished := true;
  END IF;

  -- Increment results version
  v_results_version := v_match.results_version + 1;

  -- Build results payload (same format as single-step for consistency)
  v_payload := jsonb_build_object(
    'mode', 'steps',
    'round_id', p_round_id,
    'round_number', COALESCE(v_match.current_round_number, 1),
    'question_id', v_round.question_id,
    'correct_answer', 0, -- Not used for multi-step, but keep for consistency
    'p1', jsonb_build_object(
      'answer', NULL, -- Not used for multi-step
      'correct', v_p1_total_score > v_p2_total_score,
      'score_delta', CASE WHEN v_round_winner = v_match.player1_id THEN 1 ELSE 0 END,
      'total', v_p1_wins,
      'steps', p_step_results -- Include step results in p1.steps
    ),
    'p2', jsonb_build_object(
      'answer', NULL, -- Not used for multi-step
      'correct', v_p2_total_score > v_p1_total_score,
      'score_delta', CASE WHEN v_round_winner = v_match.player2_id THEN 1 ELSE 0 END,
      'total', v_p2_wins
    ),
    'round_winner', v_round_winner,
    'match_over', v_finished,
    'match_winner_id', CASE
      WHEN v_finished AND v_p1_wins >= v_target_rounds_to_win THEN v_match.player1_id
      WHEN v_finished AND v_p2_wins >= v_target_rounds_to_win THEN v_match.player2_id
      ELSE NULL
    END,
    'player_round_wins', jsonb_build_object(
      v_match.player1_id::text, v_p1_wins,
      v_match.player2_id::text, v_p2_wins
    ),
    'computed_at', v_now
  );

  -- Update matches table with results
  UPDATE public.matches
  SET 
    round_winner = v_round_winner,
    results_computed_at = v_now,
    results_round_id = p_round_id,
    results_version = v_results_version,
    results_payload = v_payload,
    player1_round_wins = v_p1_wins,
    player2_round_wins = v_p2_wins,
    status = CASE WHEN v_finished THEN 'finished' ELSE v_match.status END,
    winner_id = CASE
      WHEN v_finished AND v_p1_wins >= v_target_rounds_to_win THEN v_match.player1_id
      WHEN v_finished AND v_p2_wins >= v_target_rounds_to_win THEN v_match.player2_id
      ELSE v_match.winner_id
    END
  WHERE id = p_match_id;

  -- Mark round status as 'results'
  UPDATE public.match_rounds
  SET status = 'results'
  WHERE id = p_round_id;

  RETURN jsonb_build_object(
    'success', true,
    'results_version', v_results_version,
    'results_round_id', p_round_id,
    'results_payload', v_payload
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Set search_path explicitly (defense in depth)
ALTER FUNCTION public.compute_multi_step_results_v2(UUID, UUID, JSONB) SET search_path = public;

-- Grant to service_role (Edge Function calls this)
GRANT EXECUTE ON FUNCTION public.compute_multi_step_results_v2(UUID, UUID, JSONB) TO service_role;
