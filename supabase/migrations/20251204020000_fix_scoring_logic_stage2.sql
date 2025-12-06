-- ========================================
-- Stage 2: Fix Scoring Logic - Update evaluate_round
-- ========================================
-- This migration updates evaluate_round to include total match scores in the response
-- Stage 2: Adds player1_total_score and player2_total_score to the return value
-- Run this SQL directly in Supabase SQL Editor or apply as migration

-- ========================================
-- Update evaluate_round to include total scores
-- ========================================

CREATE OR REPLACE FUNCTION public.evaluate_round(
  p_match_id UUID,
  p_round_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_match RECORD;
  v_round_winner_id UUID;
  v_match_continues BOOLEAN := true;
  v_match_winner_id UUID;
  v_result JSONB;
BEGIN
  -- 1) Concurrency guard: Try to transition from 'active' to 'evaluating'
  UPDATE public.match_rounds
  SET status = 'evaluating'
  WHERE id = p_round_id
    AND status = 'active'
  RETURNING * INTO v_round;
  
  -- If no row returned, someone already grabbed it - return existing state
  IF NOT FOUND THEN
    -- Get existing round and match state
    SELECT * INTO v_round
    FROM public.match_rounds
    WHERE id = p_round_id;
    
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id;
    
    -- Return existing state without doing anything
    RETURN jsonb_build_object(
      'round_winner_id', NULL,
      'player1_round_score', COALESCE(v_round.player1_round_score, 0),
      'player2_round_score', COALESCE(v_round.player2_round_score, 0),
      'player1_total_score', COALESCE(v_match.player1_score, 0),
      'player2_total_score', COALESCE(v_match.player2_score, 0),
      'match_continues', (v_match.status = 'in_progress'),
      'match_winner_id', v_match.winner_id
    );
  END IF;
  
  -- 2) Proceed with evaluation
  -- Get match state
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;
  
  -- Read player1_round_score, player2_round_score (should be calculated by submit_round_answer)
  -- Determine round winner (nullable, because draw possible)
  IF COALESCE(v_round.player1_round_score, 0) > COALESCE(v_round.player2_round_score, 0) THEN
    v_round_winner_id := v_match.player1_id;
  ELSIF COALESCE(v_round.player2_round_score, 0) > COALESCE(v_round.player1_round_score, 0) THEN
    v_round_winner_id := v_match.player2_id;
  ELSE
    v_round_winner_id := NULL; -- Draw
  END IF;
  
  -- Update matches.player1_score and player2_score
  UPDATE public.matches
  SET 
    player1_score = player1_score + COALESCE(v_round.player1_round_score, 0),
    player2_score = player2_score + COALESCE(v_round.player2_round_score, 0),
    current_round_number = current_round_number + 1
  WHERE id = p_match_id
  RETURNING * INTO v_match;
  
  -- Check win condition
  IF v_match.player1_score >= v_match.target_points OR 
     v_match.player2_score >= v_match.target_points OR
     v_match.current_round_number >= v_match.max_rounds THEN
    -- Match must end
    v_match_continues := false;
    -- Call finish_match internally
    PERFORM public.finish_match(p_match_id);
    -- Get updated match to get winner_id
    SELECT winner_id INTO v_match_winner_id
    FROM public.matches
    WHERE id = p_match_id;
  END IF;
  
  -- 3) Finalize round: explicit second UPDATE to set status = 'finished'
  UPDATE public.match_rounds
  SET status = 'finished'
  WHERE id = p_round_id;
  
  -- Return result with round scores and updated total match scores
  RETURN jsonb_build_object(
    'round_winner_id', v_round_winner_id,
    'player1_round_score', COALESCE(v_round.player1_round_score, 0),
    'player2_round_score', COALESCE(v_round.player2_round_score, 0),
    'player1_total_score', v_match.player1_score,
    'player2_total_score', v_match.player2_score,
    'match_continues', v_match_continues,
    'match_winner_id', v_match_winner_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.evaluate_round(UUID, UUID) TO authenticated;

