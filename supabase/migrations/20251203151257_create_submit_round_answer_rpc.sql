-- ========================================
-- Submit Round Answer RPC
-- 
-- Stores a player's answer payload for a round.
-- Called by the WebSocket edge function with explicit p_player_id.
-- 
-- TODO: Full scoring logic (correctness + speed bonus) will be implemented later.
-- Structure is ready - currently sets playerX_round_score = 0 as placeholder.
-- ========================================

CREATE OR REPLACE FUNCTION public.submit_round_answer(
  p_match_id UUID,
  p_round_id UUID,
  p_player_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_round RECORD;
  v_is_player1 BOOLEAN;
  v_round_score INT := 0; -- TODO: implement scoring logic here
BEGIN
  -- Verify match exists and is 'in_progress'
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;
  
  IF v_match.status != 'in_progress' THEN
    RAISE EXCEPTION 'Match is not in progress. Current status: %', v_match.status;
  END IF;
  
  -- Verify round exists and is 'active'
  SELECT * INTO v_round
  FROM public.match_rounds
  WHERE id = p_round_id AND match_id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found: % for match %', p_round_id, p_match_id;
  END IF;
  
  IF v_round.status != 'active' THEN
    RAISE EXCEPTION 'Round is not active. Current status: %', v_round.status;
  END IF;
  
  -- Verify p_player_id is player1_id or player2_id for that match
  IF p_player_id != v_match.player1_id AND p_player_id != v_match.player2_id THEN
    RAISE EXCEPTION 'Player % is not a participant in match %', p_player_id, p_match_id;
  END IF;
  
  -- Check if round deadline has passed
  IF v_round.round_deadline IS NOT NULL AND now() > v_round.round_deadline THEN
    RAISE EXCEPTION 'Round deadline has passed';
  END IF;
  
  -- Determine if player is player1
  v_is_player1 := (p_player_id = v_match.player1_id);
  
  -- Verify player has not already answered this round
  IF v_is_player1 THEN
    IF v_round.player1_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Player1 has already answered this round';
    END IF;
  ELSE
    IF v_round.player2_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Player2 has already answered this round';
    END IF;
  END IF;
  
  -- TODO: Implement scoring logic here
  -- For now, set placeholder score of 0
  -- Future: Parse p_payload, evaluate correctness per step, calculate speed bonus, sum total
  
  -- Update match_rounds with answer
  IF v_is_player1 THEN
    UPDATE public.match_rounds
    SET 
      player1_answered_at = now(),
      player1_answer_payload = p_payload,
      player1_round_score = v_round_score
    WHERE id = p_round_id;
  ELSE
    UPDATE public.match_rounds
    SET 
      player2_answered_at = now(),
      player2_answer_payload = p_payload,
      player2_round_score = v_round_score
    WHERE id = p_round_id;
  END IF;
  
  -- Return response with round_score and placeholder step_results
  RETURN jsonb_build_object(
    'round_score', v_round_score,
    'step_results', '[]'::jsonb -- TODO: populate with actual step evaluation results
  );
END;
$$;

-- Grant execute permission to authenticated users (called via service role in practice)
GRANT EXECUTE ON FUNCTION public.submit_round_answer(UUID, UUID, UUID, JSONB) TO authenticated;

