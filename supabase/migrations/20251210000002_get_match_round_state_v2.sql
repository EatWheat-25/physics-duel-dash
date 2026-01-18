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
BEGIN
  -- Get match and verify it exists and is in progress
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
    AND (player1_id = auth.uid() OR player2_id = auth.uid());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found or not accessible';
  END IF;
  
  -- Return authoritative snapshot (single row)
  RETURN jsonb_build_object(
    'match_id', v_match.id,
    'match_status', v_match.status,
    'current_round_id', v_match.current_round_id,
    'current_round_number', v_match.current_round_number,
    'results_round_id', v_match.results_round_id,
    'results_version', v_match.results_version,
    'results_payload', v_match.results_payload,
    'results_updated_at', v_match.results_computed_at,
    'match_over', (v_match.winner_id IS NOT NULL OR v_match.status = 'completed'),
    'match_winner_id', v_match.winner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Set search_path explicitly (defense in depth)
ALTER FUNCTION public.get_match_round_state_v2(UUID) SET search_path = public;

-- Grant to authenticated users (players can poll their own matches)
GRANT EXECUTE ON FUNCTION public.get_match_round_state_v2(UUID) TO authenticated;















