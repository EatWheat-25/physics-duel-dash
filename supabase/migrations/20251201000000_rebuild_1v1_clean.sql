/*
  # Rebuild 1v1 Battle System - Clean Minimal Schema
  
  Creates exactly 3 tables:
  - public.questions
  - public.matchmaking_queue  
  - public.matches
  
  All with minimal RLS policies and seed data.
*/

-- ========================================
-- DROP OLD TABLES (if they exist with wrong schema)
-- ========================================

-- We'll keep existing tables but ensure our target tables exist with correct schema
-- If tables already exist, we'll alter them to match our schema

-- ========================================
-- QUESTIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  steps JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;

-- Enable RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Simple RLS: Anyone authenticated can read, only service role can write
CREATE POLICY "Anyone can view questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (true);

-- ========================================
-- MATCHMAKING QUEUE TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert themselves into queue" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Users can view queue" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Users can delete themselves from queue" ON public.matchmaking_queue;

-- Enable RLS
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert themselves into queue"
  ON public.matchmaking_queue FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can view queue"
  ON public.matchmaking_queue FOR SELECT
  USING (true);

CREATE POLICY "Users can delete themselves from queue"
  ON public.matchmaking_queue FOR DELETE
  USING (auth.uid() = player_id);

-- Index for fast matching
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status 
  ON public.matchmaking_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_player 
  ON public.matchmaking_queue(player_id);

-- ========================================
-- MATCHES TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Players can view their own matches" ON public.matches;
DROP POLICY IF EXISTS "Players can update their own matches" ON public.matches;

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Players can view their own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Players can update their own matches"
  ON public.matches FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_matches_players 
  ON public.matches(player1_id, player2_id);

CREATE INDEX IF NOT EXISTS idx_matches_status 
  ON public.matches(status);

-- ========================================
-- SEED QUESTIONS (5 physics questions)
-- ========================================

-- Insert 5 dummy physics questions if table is empty
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

