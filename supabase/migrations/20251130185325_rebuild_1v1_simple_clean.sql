/*
  # Rebuild 1v1 Battle System - Clean Simple Tables

  Creates minimal tables for 1v1 battles, working alongside existing schema.
  Uses simple naming to avoid conflicts.
*/

-- ========================================
-- CREATE SIMPLE QUESTIONS TABLE
-- ========================================

-- Use a new simple table name to avoid conflicts
CREATE TABLE IF NOT EXISTS public.battle_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  steps JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- MATCHMAKING QUEUE
-- ========================================

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  rank_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- MATCHES TABLE  
-- ========================================

CREATE TABLE IF NOT EXISTS public.battle_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL,
  player2_id UUID NOT NULL,
  current_question_id UUID REFERENCES public.battle_questions(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status 
  ON public.matchmaking_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_player 
  ON public.matchmaking_queue(player_id);

CREATE INDEX IF NOT EXISTS idx_battle_matches_players 
  ON public.battle_matches(player1_id, player2_id);

CREATE INDEX IF NOT EXISTS idx_battle_matches_status 
  ON public.battle_matches(status);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE public.battle_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "battle_questions_select" ON public.battle_questions;
CREATE POLICY "battle_questions_select"
  ON public.battle_questions FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "queue_insert_self" ON public.matchmaking_queue;
CREATE POLICY "queue_insert_self"
  ON public.matchmaking_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "queue_select_self" ON public.matchmaking_queue;
CREATE POLICY "queue_select_self"
  ON public.matchmaking_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "queue_update_self" ON public.matchmaking_queue;
CREATE POLICY "queue_update_self"
  ON public.matchmaking_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "queue_delete_self" ON public.matchmaking_queue;
CREATE POLICY "queue_delete_self"
  ON public.matchmaking_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

ALTER TABLE public.battle_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_select_participant" ON public.battle_matches;
CREATE POLICY "matches_select_participant"
  ON public.battle_matches FOR SELECT
  TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- ========================================
-- SEED QUESTIONS
-- ========================================

-- Clear existing seed (idempotent)
DELETE FROM public.battle_questions;

-- Insert 5 physics questions
INSERT INTO public.battle_questions (text, steps) VALUES
(
  'What is Newton''s second law of motion?',
  '{"type": "mcq", "options": ["F = ma", "E = mc²", "v = u + at", "s = ut + ½at²"], "answer": 0}'::jsonb
),
(
  'Which of these is a unit of power?',
  '{"type": "mcq", "options": ["Watt", "Joule", "Newton", "Pascal"], "answer": 0}'::jsonb
),
(
  'What is the speed of light in vacuum?',
  '{"type": "mcq", "options": ["3 × 10⁸ m/s", "3 × 10⁶ m/s", "9.8 m/s", "1.6 × 10⁻¹⁹ C"], "answer": 0}'::jsonb
),
(
  'Which law states that energy cannot be created or destroyed?',
  '{"type": "mcq", "options": ["Conservation of Energy", "Newton''s First Law", "Ohm''s Law", "Archimedes Principle"], "answer": 0}'::jsonb
),
(
  'What is the SI unit of electric charge?',
  '{"type": "mcq", "options": ["Coulomb", "Ampere", "Volt", "Ohm"], "answer": 0}'::jsonb
);
