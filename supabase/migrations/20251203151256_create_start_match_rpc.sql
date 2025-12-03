-- ========================================
-- Start Match RPC
-- 
-- Transitions a match from 'pending' to 'in_progress' state.
-- Called by the WebSocket edge function with explicit p_player_id.
-- ========================================

CREATE OR REPLACE FUNCTION public.start_match(
  p_match_id UUID,
  p_player_id UUID
)
RETURNS TABLE (
  id UUID,
  player1_id UUID,
  player2_id UUID,
  status TEXT,
  subject TEXT,
  mode TEXT,
  target_points INT,
  max_rounds INT,
  player1_score INT,
  player2_score INT,
  winner_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  current_round_number INT,
  rules_version INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
BEGIN
  -- Verify match exists and is 'pending'
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;
  
  IF v_match.status != 'pending' THEN
    RAISE EXCEPTION 'Match is not in pending state. Current status: %', v_match.status;
  END IF;
  
  -- Verify p_player_id is player1_id or player2_id
  IF p_player_id != v_match.player1_id AND p_player_id != v_match.player2_id THEN
    RAISE EXCEPTION 'Player % is not a participant in match %', p_player_id, p_match_id;
  END IF;
  
  -- Update match status to 'in_progress' and set started_at
  UPDATE public.matches
  SET 
    status = 'in_progress',
    started_at = now()
  WHERE id = p_match_id;
  
  -- Return updated match row
  RETURN QUERY
  SELECT 
    m.id,
    m.player1_id,
    m.player2_id,
    m.status,
    m.subject,
    m.mode,
    m.target_points,
    m.max_rounds,
    m.player1_score,
    m.player2_score,
    m.winner_id,
    m.started_at,
    m.completed_at,
    m.current_round_number,
    m.rules_version,
    m.created_at
  FROM public.matches m
  WHERE m.id = p_match_id;
END;
$$;

-- Grant execute permission to authenticated users (called via service role in practice)
GRANT EXECUTE ON FUNCTION public.start_match(UUID, UUID) TO authenticated;

