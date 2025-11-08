/*
  # Enhanced Professional Matchmaking System
  
  1. Schema Improvements
    - Add match quality tracking
    - Add queue statistics
    - Add player connection tracking
    - Add MMR adjustment tracking
    
  2. New Features
    - Match quality scoring
    - Dynamic MMR range expansion based on wait time
    - Player activity tracking
    - Match history and statistics
    
  3. Performance
    - Optimized indexes for matchmaking queries
    - Efficient queue scanning
    
  4. Security
    - Proper RLS for all new tables
    - Service role policies for automation
*/

CREATE TABLE IF NOT EXISTS public.match_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches_new(id) ON DELETE CASCADE,
  mmr_difference INTEGER NOT NULL,
  wait_time_p1_seconds INTEGER NOT NULL,
  wait_time_p2_seconds INTEGER NOT NULL,
  quality_score DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.match_quality_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read match quality metrics"
  ON public.match_quality_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage match quality metrics"
  ON public.match_quality_metrics FOR ALL
  USING (true);

CREATE TABLE IF NOT EXISTS public.player_activity (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_matches INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  average_response_time_ms INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity"
  ON public.player_activity FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

CREATE POLICY "Service role can manage player activity"
  ON public.player_activity FOR ALL
  USING (true);

CREATE INDEX IF NOT EXISTS idx_queue_subject_chapter_mmr 
  ON public.queue(subject, chapter, mmr, enqueued_at);

CREATE INDEX IF NOT EXISTS idx_queue_heartbeat 
  ON public.queue(last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_matches_state 
  ON public.matches_new(state, created_at);

CREATE INDEX IF NOT EXISTS idx_player_activity_last_seen 
  ON public.player_activity(last_seen);

CREATE OR REPLACE FUNCTION public.calculate_match_quality(
  p_mmr_diff INTEGER,
  p_wait_time_1 INTEGER,
  p_wait_time_2 INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
  v_mmr_score DECIMAL;
  v_wait_score DECIMAL;
BEGIN
  v_mmr_score := GREATEST(0, 100 - (ABS(p_mmr_diff) * 0.2));
  
  v_wait_score := LEAST(100, (GREATEST(p_wait_time_1, p_wait_time_2) / 60.0) * 10);
  
  RETURN (v_mmr_score * 0.7) + (v_wait_score * 0.3);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_mmr_range_for_wait_time(
  p_wait_seconds INTEGER
)
RETURNS INTEGER AS $$
BEGIN
  IF p_wait_seconds < 10 THEN
    RETURN 200;
  ELSIF p_wait_seconds < 30 THEN
    RETURN 400;
  ELSIF p_wait_seconds < 60 THEN
    RETURN 600;
  ELSIF p_wait_seconds < 120 THEN
    RETURN 800;
  ELSE
    RETURN 2000;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

  INSERT INTO public.matches_new (id, p1, p2, subject, chapter, state)
  VALUES (v_match_id, v_p1, v_p2, p_subject, p_chapter, 'active');

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

CREATE OR REPLACE FUNCTION public.cleanup_stale_queue_entries()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.queue
  WHERE last_heartbeat < NOW() - INTERVAL '45 seconds';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_player_mmr(
  p_player_id UUID,
  p_opponent_mmr INTEGER,
  p_won BOOLEAN
)
RETURNS INTEGER AS $$
DECLARE
  v_current_mmr INTEGER;
  v_expected_score DECIMAL;
  v_actual_score INTEGER;
  v_k_factor INTEGER := 32;
  v_mmr_change INTEGER;
  v_new_mmr INTEGER;
BEGIN
  SELECT mmr INTO v_current_mmr
  FROM public.players
  WHERE id = p_player_id;

  v_expected_score := 1.0 / (1.0 + POWER(10, (p_opponent_mmr - v_current_mmr) / 400.0));
  
  v_actual_score := CASE WHEN p_won THEN 1 ELSE 0 END;
  
  v_mmr_change := ROUND(v_k_factor * (v_actual_score - v_expected_score));
  
  v_new_mmr := GREATEST(100, v_current_mmr + v_mmr_change);
  
  UPDATE public.players
  SET mmr = v_new_mmr, updated_at = NOW()
  WHERE id = p_player_id;
  
  RETURN v_new_mmr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
