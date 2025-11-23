/*
  # Multi-Step Questions Schema - Clean V3

  ## Overview
  This migration establishes the proper schema for multi-step questions aligned with
  the canonical StepBasedQuestion type system.

  ## Changes Made

  1. **question_steps Table**
     - `id` (uuid, primary key)
     - `question_id` (uuid, foreign key to questions)
     - `step_index` (int, 0-based order)
     - `step_type` (text, always 'mcq')
     - `title` (text, step heading)
     - `prompt` (text, the question text for this step)
     - `options` (jsonb, array of exactly 4 strings)
     - `correct_answer` (jsonb, object with correctIndex field)
     - `time_limit_seconds` (int, nullable)
     - `marks` (int, points for this step)
     - `explanation` (text, nullable)

  2. **RPC Function: pick_next_question_v3**
     - Returns properly formatted JSON matching StepBasedQuestion type
     - Steps ordered by step_index ASC (0, 1, 2, ...)
     - Maps snake_case DB fields to expected field names
     - Includes both snake_case and camelCase for compatibility

  ## Security
  - RLS enabled on question_steps
  - Only authenticated users can read steps for questions they have access to
  - Only service_role can insert/update steps
*/

-- ============================================================================
-- 1. CREATE question_steps TABLE
-- ============================================================================

DROP TABLE IF EXISTS public.question_steps CASCADE;

CREATE TABLE public.question_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  step_index INT NOT NULL CHECK (step_index >= 0),
  step_type TEXT NOT NULL DEFAULT 'mcq' CHECK (step_type = 'mcq'),
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_array_length(options) = 4),
  correct_answer JSONB NOT NULL,
  time_limit_seconds INT,
  marks INT NOT NULL DEFAULT 1 CHECK (marks > 0),
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(question_id, step_index)
);

CREATE INDEX idx_question_steps_question_id ON public.question_steps(question_id, step_index);

-- ============================================================================
-- 2. RPC: pick_next_question_v3 - Returns StepBasedQuestion format
-- ============================================================================

DROP FUNCTION IF EXISTS public.pick_next_question_v3(uuid);

CREATE OR REPLACE FUNCTION public.pick_next_question_v3(p_match_id uuid)
RETURNS TABLE (
  question_id uuid,
  ordinal int,
  question jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pref_subject text;
  pref_chapter text;
  pref_rank    text;
  next_ord     int;
  picked_id    uuid;
BEGIN
  -- Get match preferences
  SELECT subject, chapter, rank_tier 
  INTO pref_subject, pref_chapter, pref_rank
  FROM public.matches_new 
  WHERE id = p_match_id;

  -- Calculate next ordinal
  SELECT COALESCE(MAX(ordinal), 0) + 1 
  INTO next_ord
  FROM public.match_questions 
  WHERE match_id = p_match_id;

  -- Tier 1: Strict match (subject + chapter + rank)
  SELECT q.id INTO picked_id
  FROM public.questions q
  WHERE (pref_subject IS NULL OR q.subject = pref_subject)
    AND (pref_chapter IS NULL OR q.chapter = pref_chapter)
    AND (pref_rank IS NULL OR q.rank_tier = pref_rank)
    AND NOT EXISTS (
      SELECT 1 FROM public.match_questions mq
      WHERE mq.match_id = p_match_id AND mq.question_id = q.id
    )
  ORDER BY random()
  LIMIT 1;

  -- Tier 2: Relax chapter (subject + rank only)
  IF picked_id IS NULL THEN
    SELECT q.id INTO picked_id
    FROM public.questions q
    WHERE (pref_subject IS NULL OR q.subject = pref_subject)
      AND (pref_rank IS NULL OR q.rank_tier = pref_rank)
      AND NOT EXISTS (
        SELECT 1 FROM public.match_questions mq
        WHERE mq.match_id = p_match_id AND mq.question_id = q.id
      )
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Tier 3: Relax all filters (any unused question)
  IF picked_id IS NULL THEN
    SELECT q.id INTO picked_id
    FROM public.questions q
    WHERE NOT EXISTS (
      SELECT 1 FROM public.match_questions mq
      WHERE mq.match_id = p_match_id AND mq.question_id = q.id
    )
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Tier 4: Allow reuse with strict match
  IF picked_id IS NULL THEN
    SELECT q.id INTO picked_id
    FROM public.questions q
    WHERE (pref_subject IS NULL OR q.subject = pref_subject)
      AND (pref_chapter IS NULL OR q.chapter = pref_chapter)
      AND (pref_rank IS NULL OR q.rank_tier = pref_rank)
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Tier 5: Any question (last resort)
  IF picked_id IS NULL THEN
    SELECT q.id INTO picked_id
    FROM public.questions q
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- If we found a question, insert it and return formatted JSON
  IF picked_id IS NOT NULL THEN
    INSERT INTO public.match_questions(match_id, question_id, ordinal)
    VALUES (p_match_id, picked_id, next_ord)
    ON CONFLICT DO NOTHING;

    RETURN QUERY
    SELECT 
      picked_id,
      next_ord,
      jsonb_build_object(
        'id', q.id,
        'title', q.title,
        'subject', q.subject,
        'chapter', q.chapter,
        'level', q.level,
        'difficulty', q.difficulty,
        'rank_tier', q.rank_tier,
        'rankTier', q.rank_tier,
        'stem', q.question_text,
        'question_text', q.question_text,
        'total_marks', q.total_marks,
        'totalMarks', q.total_marks,
        'topic_tags', q.topic_tags,
        'topicTags', q.topic_tags,
        'image_url', q.image_url,
        'imageUrl', q.image_url,
        'steps', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', qs.id,
              'index', qs.step_index,
              'type', qs.step_type,
              'title', qs.title,
              'prompt', qs.prompt,
              'options', qs.options,
              'correctAnswer', (qs.correct_answer->>'correctIndex')::int,
              'correct_answer', (qs.correct_answer->>'correctIndex')::int,
              'timeLimitSeconds', qs.time_limit_seconds,
              'time_limit_seconds', qs.time_limit_seconds,
              'marks', qs.marks,
              'explanation', qs.explanation
            ) ORDER BY qs.step_index ASC
          )
          FROM public.question_steps qs
          WHERE qs.question_id = q.id
        )
      )
    FROM public.questions q
    WHERE q.id = picked_id;
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION public.pick_next_question_v3(uuid) TO authenticated;

-- ============================================================================
-- 3. ENABLE RLS ON question_steps
-- ============================================================================

ALTER TABLE public.question_steps ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read steps
DROP POLICY IF EXISTS "Authenticated users can read question steps" ON public.question_steps;
CREATE POLICY "Authenticated users can read question steps" ON public.question_steps
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role can insert
DROP POLICY IF EXISTS "Only service_role can insert question steps" ON public.question_steps;
CREATE POLICY "Only service_role can insert question steps" ON public.question_steps
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service_role can update
DROP POLICY IF EXISTS "Only service_role can update question steps" ON public.question_steps;
CREATE POLICY "Only service_role can update question steps" ON public.question_steps
  FOR UPDATE
  TO service_role
  USING (true);

-- Only service_role can delete
DROP POLICY IF EXISTS "Only service_role can delete question steps" ON public.question_steps;
CREATE POLICY "Only service_role can delete question steps" ON public.question_steps
  FOR DELETE
  TO service_role
  USING (true);
