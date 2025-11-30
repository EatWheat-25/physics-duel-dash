/*
  # Fix 1v1 Matchmaking - Match State and Notifications

  1. Problems Fixed
    - Matches created as 'active' instead of 'pending'
    - RPC function try_match_player_enhanced doesn't create notifications
    - Game never starts because state is wrong

  2. Changes
    - Update try_match_player_enhanced to create matches as 'pending'
    - Add notification creation to the RPC function
    - Ensure both instant matches and delayed matches send notifications

  3. Flow After Fix
    - Match created with state='pending'
    - Notifications created for both players
    - Frontend receives notification and navigates to battle page
    - WebSocket connects for both players
    - game-ws detects both connected, sets state='active', starts round
*/

-- Update the try_match_player_enhanced function to:
-- 1. Create matches with state='pending' instead of 'active'
-- 2. Create match notifications for both players

CREATE OR REPLACE FUNCTION public.try_match_player_enhanced(
  p_player_id UUID,
  p_subject TEXT,
  p_chapter TEXT,
  p_mmr INTEGER,
  p_wait_seconds INTEGER DEFAULT 0
)
RETURNS TABLE(
  matched BOOLEAN,
  match_id UUID,
  opponent_id UUID,
  opponent_name TEXT,
  match_quality DECIMAL
) AS $$
DECLARE
  v_opponent RECORD;
  v_match_id UUID;
  v_p1 UUID;
  v_p2 UUID;
  v_mmr_range INTEGER;
  v_quality DECIMAL;
  v_wait_time_opponent INTEGER;
BEGIN
  v_mmr_range := public.get_mmr_range_for_wait_time(p_wait_seconds);

  SELECT
    q.player_id,
    q.mmr,
    p.display_name,
    EXTRACT(EPOCH FROM (NOW() - q.enqueued_at))::INTEGER as wait_time
  INTO v_opponent
  FROM public.queue q
  JOIN public.players p ON p.id = q.player_id
  WHERE q.subject = p_subject
    AND q.chapter = p_chapter
    AND q.player_id != p_player_id
    AND ABS(q.mmr - p_mmr) <= v_mmr_range
    AND q.last_heartbeat > NOW() - INTERVAL '30 seconds'
  ORDER BY
    ABS(q.mmr - p_mmr) ASC,
    q.enqueued_at ASC
  LIMIT 1;

  IF v_opponent IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::DECIMAL;
    RETURN;
  END IF;

  v_quality := public.calculate_match_quality(
    ABS(p_mmr - v_opponent.mmr),
    p_wait_seconds,
    v_opponent.wait_time
  );

  v_match_id := gen_random_uuid();
  v_p1 := LEAST(p_player_id, v_opponent.player_id);
  v_p2 := GREATEST(p_player_id, v_opponent.player_id);

  -- CRITICAL FIX: Create match with state='pending' instead of 'active'
  -- This allows game-ws to properly detect when both players connect and start the game
  INSERT INTO public.matches_new (id, p1, p2, subject, chapter, state)
  VALUES (v_match_id, v_p1, v_p2, p_subject, p_chapter, 'pending');

  -- CRITICAL FIX: Create notifications for both players
  -- The trigger only fires for INSERT on matches_new from regular clients
  -- When called from RPC, we need to manually create notifications
  INSERT INTO public.match_notifications (user_id, match_id)
  VALUES (v_p1, v_match_id), (v_p2, v_match_id);

  INSERT INTO public.match_quality_metrics (
    match_id,
    mmr_difference,
    wait_time_p1_seconds,
    wait_time_p2_seconds,
    quality_score
  ) VALUES (
    v_match_id,
    ABS(p_mmr - v_opponent.mmr),
    CASE WHEN v_p1 = p_player_id THEN p_wait_seconds ELSE v_opponent.wait_time END,
    CASE WHEN v_p2 = p_player_id THEN p_wait_seconds ELSE v_opponent.wait_time END,
    v_quality
  );

  DELETE FROM public.queue
  WHERE player_id IN (p_player_id, v_opponent.player_id);

  RETURN QUERY SELECT
    TRUE,
    v_match_id,
    v_opponent.player_id,
    v_opponent.display_name,
    v_quality;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;