-- Migration: Add question_steps table and update pick_next_question_v2
-- Date: 2025-11-23

-- 1. Create question_steps table
CREATE TABLE IF NOT EXISTS public.question_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  step_type TEXT NOT NULL DEFAULT 'mcq',
  title TEXT,
  prompt TEXT NOT NULL,
  options JSONB, -- Array of strings
  correct_answer JSONB, -- e.g. { "correctIndex": 2 }
  time_limit_seconds INT NOT NULL DEFAULT 15,
  marks INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_steps_question_id ON public.question_steps(question_id, step_index);

-- 2. Update pick_next_question_v2 to support multi-step questions
-- CRITICAL: This RPC puts the FINAL STEP (highest step_index) at index 0 of the steps array.
-- This is a hack to allow the existing game-ws (which scores steps[0]) to work with multi-step questions.
-- The Frontend MUST re-sort steps by step_index for display.

CREATE OR REPLACE FUNCTION public.pick_next_question_v2(p_match_id uuid)
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

  -- If we found a question, insert it atomically and return
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
        'rank_tier', q.rank_tier,
        'level', q.level,
        'difficulty', q.difficulty,
        'question_text', q.question_text, -- Keep for backward compat if needed, but UI should use stem/steps
        'stem', q.question_text, -- Alias question_text as stem for clarity
        'total_marks', q.total_marks,
        'topic_tags', q.topic_tags,
        'steps', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', qs.id,
              'index', qs.step_index,
              'type', qs.step_type,
              'title', qs.title,
              'question', qs.prompt, -- Map prompt to 'question' for legacy compat if needed
              'prompt', qs.prompt,
              'options', qs.options,
              'correctAnswer', (qs.correct_answer->>'correctIndex')::int,
              'timeLimitSeconds', qs.time_limit_seconds,
              'marks', qs.marks
            ) ORDER BY 
              -- CRITICAL: Order by step_index DESC so the LAST step (highest index) comes FIRST (index 0).
              -- This ensures game-ws scores the final step.
              qs.step_index DESC
          )
          FROM public.question_steps qs
          WHERE qs.question_id = q.id
        )
      )
    FROM public.questions q
    WHERE q.id = picked_id;
  END IF;
END$$;

-- 3. Seed Data: Integration by Parts Question
DO $$
DECLARE
  q_id uuid;
BEGIN
  -- Insert or Update the main question
  INSERT INTO public.questions (
    subject, level, chapter, difficulty, title, question_text, base_marks, working_time_seconds, rank_tier
  ) VALUES (
    'math', 'A2', 'Integration P3', 'silver', 'Integration by Parts: ln x / x^3', 
    'Find the integral of ln(x) / x^3 with respect to x.', 
    8, 120, 'Silver'
  )
  RETURNING id INTO q_id;

  -- Insert Steps
  -- Step 0: Choose u and dv/dx
  INSERT INTO public.question_steps (question_id, step_index, title, prompt, options, correct_answer, marks)
  VALUES (
    q_id, 0, 'Choose u and dv/dx', 
    'Which choice of u and dv/dx is most suitable for integration by parts?',
    '["u = 1/x^3, dv/dx = ln x", "u = ln x, dv/dx = x^-3", "u = x^-3, dv/dx = ln x", "u = ln x, dv/dx = 1/x^2"]'::jsonb,
    '{"correctIndex": 1}'::jsonb,
    2
  );

  -- Step 1: Differentiate u and Integrate dv/dx
  INSERT INTO public.question_steps (question_id, step_index, title, prompt, options, correct_answer, marks)
  VALUES (
    q_id, 1, 'Find du/dx and v', 
    'Calculate du/dx and v based on your choice.',
    '["du/dx = 1/x, v = -1/(2x^2)", "du/dx = 1/x, v = -2/x^2", "du/dx = x, v = -1/(2x^2)", "du/dx = 1/x, v = 1/(2x^2)"]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    2
  );

  -- Step 2: Apply the Formula
  INSERT INTO public.question_steps (question_id, step_index, title, prompt, options, correct_answer, marks)
  VALUES (
    q_id, 2, 'Apply the Formula', 
    'Substitute into the formula: uv - ∫ v (du/dx) dx',
    '["-ln x / (2x^2) - ∫ -1/(2x^3) dx", "-ln x / (2x^2) - ∫ 1/(2x^3) dx", "-ln x / x^2 - ∫ -1/(2x^3) dx", "ln x / (2x^2) - ∫ -1/(2x^3) dx"]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    2
  );

  -- Step 3: Final Answer
  INSERT INTO public.question_steps (question_id, step_index, title, prompt, options, correct_answer, marks)
  VALUES (
    q_id, 3, 'Final Answer', 
    'Evaluate the remaining integral and simplify.',
    '["-ln x / (2x^2) - 1/(4x^2) + C", "-ln x / (2x^2) + 1/(4x^2) + C", "-ln x / (2x^2) - 1/(2x^2) + C", "-ln x / (2x^2) + 1/(2x^2) + C"]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    2
  );

END $$;
