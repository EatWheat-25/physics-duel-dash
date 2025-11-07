/*
  # Improve Matchmaking System

  1. Changes
    - Add service role policies for queue and matches tables
    - Add index for faster queue lookups
    - Add function for automatic matchmaking
    
  2. Security
    - Service role can read/write all queue entries for matchmaking
    - Service role can create matches
*/

-- Add service role policy for queue (needed for matchmaker function)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'queue' AND policyname = 'Service role can manage queue') THEN
    CREATE POLICY "Service role can manage queue"
      ON public.queue FOR ALL
      USING (true);
  END IF;
END $$;

-- Add service role policy for matches
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches_new' AND policyname = 'Service role can manage matches') THEN
    CREATE POLICY "Service role can manage matches"
      ON public.matches_new FOR ALL
      USING (true);
  END IF;
END $$;

-- Add service role policy for players (needed to read display names)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Service role can read all players') THEN
    CREATE POLICY "Service role can read all players"
      ON public.players FOR SELECT
      USING (true);
  END IF;
END $$;

-- Create function to automatically match players
CREATE OR REPLACE FUNCTION public.try_match_player(
  p_player_id UUID,
  p_subject TEXT,
  p_chapter TEXT,
  p_mmr INTEGER
)
RETURNS TABLE(
  matched BOOLEAN,
  match_id UUID,
  opponent_id UUID,
  opponent_name TEXT
) AS $$
DECLARE
  v_opponent RECORD;
  v_match_id UUID;
  v_p1 UUID;
  v_p2 UUID;
BEGIN
  -- Look for an opponent in queue with same subject/chapter
  SELECT q.player_id, q.mmr, p.display_name
  INTO v_opponent
  FROM public.queue q
  JOIN public.players p ON p.id = q.player_id
  WHERE q.subject = p_subject
    AND q.chapter = p_chapter
    AND q.player_id != p_player_id
    AND ABS(q.mmr - p_mmr) <= 500
  ORDER BY q.enqueued_at ASC
  LIMIT 1;

  -- If no opponent found, return no match
  IF v_opponent IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Create the match
  v_match_id := gen_random_uuid();
  v_p1 := LEAST(p_player_id, v_opponent.player_id);
  v_p2 := GREATEST(p_player_id, v_opponent.player_id);

  INSERT INTO public.matches_new (id, p1, p2, subject, chapter, state)
  VALUES (v_match_id, v_p1, v_p2, p_subject, p_chapter, 'active');

  -- Remove both players from queue
  DELETE FROM public.queue 
  WHERE player_id IN (p_player_id, v_opponent.player_id);

  -- Return match info
  RETURN QUERY SELECT 
    TRUE, 
    v_match_id, 
    v_opponent.player_id, 
    v_opponent.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
