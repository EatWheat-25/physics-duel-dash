-- ========================================
-- Finish Match RPC
-- 
-- Finalizes a match, determines winner, and sets completion timestamp.
-- Idempotent: calling multiple times is safe.
-- Called by the service role WebSocket function or internally by evaluate_round (no p_player_id).
-- 
-- TODO: MMR / stats update will go here (clear spot reserved).
-- ========================================

CREATE OR REPLACE FUNCTION public.finish_match(
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_winner_id UUID;
  v_summary JSONB;
BEGIN
  -- Get current match state
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;
  
  -- Idempotent: if already finished, just return current summary
  IF v_match.status = 'finished' THEN
    RETURN jsonb_build_object(
      'winner_id', v_match.winner_id,
      'player1_final_score', v_match.player1_score,
      'player2_final_score', v_match.player2_score,
      'total_rounds', v_match.current_round_number,
      'accuracy_stats', '{}'::jsonb -- placeholder
    );
  END IF;
  
  -- Compute winner
  IF v_match.player1_score > v_match.player2_score THEN
    v_winner_id := v_match.player1_id;
  ELSIF v_match.player2_score > v_match.player1_score THEN
    v_winner_id := v_match.player2_id;
  ELSE
    v_winner_id := NULL; -- Draw
  END IF;
  
  -- Set match to finished
  UPDATE public.matches
  SET 
    status = 'finished',
    completed_at = now(),
    winner_id = v_winner_id
  WHERE id = p_match_id;
  
  -- Get updated match for return
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;
  
  -- TODO: MMR / stats update will go here
  -- Example placeholder:
  -- PERFORM update_player_mmr(v_match.player1_id, v_match.player2_id, v_winner_id);
  -- PERFORM update_player_stats(v_match.player1_id, v_match.player2_id, v_winner_id);
  
  -- Return match summary
  RETURN jsonb_build_object(
    'winner_id', v_match.winner_id,
    'player1_final_score', v_match.player1_score,
    'player2_final_score', v_match.player2_score,
    'total_rounds', v_match.current_round_number,
    'accuracy_stats', '{}'::jsonb -- placeholder for future implementation
  );
END;
$$;

-- Grant execute permission to authenticated users (called via service role in practice)
GRANT EXECUTE ON FUNCTION public.finish_match(UUID) TO authenticated;

