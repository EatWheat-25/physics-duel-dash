/*
  # Fix Connection Schema - Ensure Tables Match Code Expectations
  
  This migration ensures all tables have the correct structure for the 1v1 battle system.
  It handles both new installations and existing databases.
*/

-- ========================================
-- ENSURE MATCHES TABLE HAS CORRECT STRUCTURE
-- ========================================

-- If matches table exists with old schema (p1/p2), we need to handle it
DO $$ 
BEGIN
  -- Check if old columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'p1'
  ) THEN
    -- Rename old columns to new ones if they exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'player1_id') THEN
      ALTER TABLE public.matches RENAME COLUMN p1 TO player1_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'player2_id') THEN
      ALTER TABLE public.matches RENAME COLUMN p2 TO player2_id;
    END IF;
    
    -- Rename state to status if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'state') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'status') THEN
        ALTER TABLE public.matches RENAME COLUMN state TO status;
      END IF;
    END IF;
  END IF;
END $$;

-- Create matches table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'player1_id') THEN
    ALTER TABLE public.matches ADD COLUMN player1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'player2_id') THEN
    ALTER TABLE public.matches ADD COLUMN player2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'status') THEN
    ALTER TABLE public.matches ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE public.matches ADD CONSTRAINT matches_status_check CHECK (status IN ('pending', 'active', 'finished'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'created_at') THEN
    ALTER TABLE public.matches ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Ensure player1_id and player2_id are NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'player1_id' AND is_nullable = 'YES') THEN
    -- Set default for any null values first
    UPDATE public.matches SET player1_id = (SELECT id FROM auth.users LIMIT 1) WHERE player1_id IS NULL;
    ALTER TABLE public.matches ALTER COLUMN player1_id SET NOT NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'player2_id' AND is_nullable = 'YES') THEN
    -- Set default for any null values first
    UPDATE public.matches SET player2_id = (SELECT id FROM auth.users LIMIT 1) WHERE player2_id IS NULL;
    ALTER TABLE public.matches ALTER COLUMN player2_id SET NOT NULL;
  END IF;
END $$;

-- ========================================
-- ENSURE QUESTIONS TABLE EXISTS
-- ========================================

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  steps JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- ENSURE MATCHMAKING_QUEUE TABLE EXISTS
-- ========================================

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'matchmaking_queue_player_id_key'
  ) THEN
    ALTER TABLE public.matchmaking_queue ADD CONSTRAINT matchmaking_queue_player_id_key UNIQUE (player_id);
  END IF;
END $$;

-- ========================================
-- RLS POLICIES FOR MATCHES
-- ========================================

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view their own matches" ON public.matches;
CREATE POLICY "Players can view their own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

DROP POLICY IF EXISTS "Players can update their own matches" ON public.matches;
CREATE POLICY "Players can update their own matches"
  ON public.matches FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- ========================================
-- RLS POLICIES FOR QUESTIONS
-- ========================================

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "Anyone can view questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (true);

-- ========================================
-- RLS POLICIES FOR MATCHMAKING_QUEUE
-- ========================================

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert themselves into queue" ON public.matchmaking_queue;
CREATE POLICY "Users can insert themselves into queue"
  ON public.matchmaking_queue FOR INSERT
  WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can view queue" ON public.matchmaking_queue;
CREATE POLICY "Users can view queue"
  ON public.matchmaking_queue FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can delete themselves from queue" ON public.matchmaking_queue;
CREATE POLICY "Users can delete themselves from queue"
  ON public.matchmaking_queue FOR DELETE
  USING (auth.uid() = player_id);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_matches_players 
  ON public.matches(player1_id, player2_id);

CREATE INDEX IF NOT EXISTS idx_matches_status 
  ON public.matches(status);

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status 
  ON public.matchmaking_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_player 
  ON public.matchmaking_queue(player_id);

-- ========================================
-- SEED QUESTIONS (if empty)
-- ========================================

INSERT INTO public.questions (text, steps)
SELECT * FROM (VALUES
  (
    'What is the formula for kinetic energy?',
    '{"type": "mcq", "options": ["E = mc²", "E = ½mv²", "E = mgh", "E = Fd"], "answer": 1}'::jsonb
  ),
  (
    'What is the acceleration due to gravity on Earth?',
    '{"type": "mcq", "options": ["9.8 m/s²", "10 m/s²", "8.9 m/s²", "11 m/s²"], "answer": 0}'::jsonb
  ),
  (
    'What is Newton''s first law of motion?',
    '{"type": "mcq", "options": ["F = ma", "An object at rest stays at rest", "For every action there is an equal reaction", "Energy cannot be created or destroyed"], "answer": 1}'::jsonb
  ),
  (
    'What is the unit of force?',
    '{"type": "mcq", "options": ["Joule", "Watt", "Newton", "Pascal"], "answer": 2}'::jsonb
  ),
  (
    'What is the speed of light in vacuum?',
    '{"type": "mcq", "options": ["3 × 10⁸ m/s", "3 × 10⁶ m/s", "3 × 10¹⁰ m/s", "3 × 10⁵ m/s"], "answer": 0}'::jsonb
  )
) AS v(text, steps)
WHERE NOT EXISTS (SELECT 1 FROM public.questions LIMIT 1);

