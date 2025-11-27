-- ═══════════════════════════════════════════════════════════════════════
-- QUESTIONS V2 - CLEAN SCHEMA
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- This migration creates a CLEAN questions table that matches
-- the canonical contract in src/types/question-contract.ts
--
-- Key decisions:
-- 1. Steps stored as JSONB array (not separate table)
-- 2. Field names match DB conventions (snake_case)
-- 3. Strong typing with CHECK constraints
-- 4. Clear RLS policies
--
-- Created: 2025-11-27
-- ═══════════════════════════════════════════════════════════════════════

-- Create questions_v2 table
CREATE TABLE IF NOT EXISTS public.questions_v2 (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata
  title TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'physics', 'chemistry')),
  chapter TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  rank_tier TEXT,
  
  -- Content
  stem TEXT NOT NULL,  -- Main question context/setup
  total_marks INTEGER NOT NULL CHECK (total_marks > 0),
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  
  -- Steps (JSONB array matching QuestionStep[])
  -- Each step: { id, index, type, title, prompt, options, correctAnswer, timeLimitSeconds, marks, explanation }
  steps JSONB NOT NULL CHECK (
    jsonb_typeof(steps) = 'array' AND
    jsonb_array_length(steps) > 0
  ),
  
  -- Optional
  image_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_v2_subject_chapter 
  ON public.questions_v2(subject, chapter);

CREATE INDEX IF NOT EXISTS idx_questions_v2_level_difficulty 
  ON public.questions_v2(level, difficulty);

CREATE INDEX IF NOT EXISTS idx_questions_v2_rank_tier 
  ON public.questions_v2(rank_tier) WHERE rank_tier IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_questions_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_v2_updated_at
  BEFORE UPDATE ON public.questions_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_questions_v2_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.questions_v2 ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read questions
CREATE POLICY "questions_v2_select_all"
  ON public.questions_v2
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Service role can insert/update/delete
CREATE POLICY "questions_v2_service_all"
  ON public.questions_v2
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════

COMMENT ON TABLE public.questions_v2 IS 'Clean question table matching question-contract.ts';
COMMENT ON COLUMN public.questions_v2.stem IS 'Main question context/setup text';
COMMENT ON COLUMN public.questions_v2.steps IS 'JSONB array of QuestionStep objects';
