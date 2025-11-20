-- Questions MVP Integration
-- Add schema hardening, match_questions tracking, and question selection RPC

-- 1. Schema: Add match_questions junction table
CREATE TABLE IF NOT EXISTS public.match_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches_new(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  ordinal INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, question_id),
  UNIQUE(match_id, ordinal)
);

CREATE INDEX IF NOT EXISTS match_questions_match_idx ON public.match_questions(match_id);
CREATE INDEX IF NOT EXISTS match_questions_question_idx ON public.match_questions(question_id);

-- 2. Schema: Add filter columns to matches_new
ALTER TABLE public.matches_new
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS chapter TEXT,
  ADD COLUMN IF NOT EXISTS rank_tier TEXT;

-- 3. Schema: Add guards and indexes on questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_steps_is_array'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_steps_is_array
      CHECK (steps IS NULL OR jsonb_typeof(steps) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS q_subject_chapter_idx ON public.questions(subject, chapter);
CREATE INDEX IF NOT EXISTS q_rank_idx ON public.questions(rank_tier);
CREATE INDEX IF NOT EXISTS q_level_difficulty_idx ON public.questions(level, difficulty);

-- 4. Upsert RPC for seeding (idempotent, service_role only)
DROP FUNCTION IF EXISTS public.upsert_questions(jsonb);
CREATE OR REPLACE FUNCTION public.upsert_questions(q jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.questions(
    id,
    title,
    subject,
    chapter,
    level,
    difficulty,
    rank_tier,
    question_text,
    total_marks,
    steps,
    topic_tags,
    created_at
  )
  SELECT
    COALESCE((q->>'id')::uuid, gen_random_uuid()),
    COALESCE(q->>'title', 'Untitled'),
    q->>'subject',
    q->>'chapter',
    q->>'level',
    q->>'difficulty',
    q->>'rank_tier',
    q->>'question_text',
    COALESCE((q->>'total_marks')::int, 1),
    q->'steps',
    CASE 
      WHEN jsonb_typeof(q->'topic_tags') = 'array' 
      THEN ARRAY(SELECT jsonb_array_elements_text(q->'topic_tags'))
      ELSE '{}'::text[]
    END,
    now()
  ON CONFLICT (id) DO UPDATE
    SET title         = EXCLUDED.title,
        subject       = EXCLUDED.subject,
        chapter       = EXCLUDED.chapter,
        level         = EXCLUDED.level,
        difficulty    = EXCLUDED.difficulty,
        rank_tier     = EXCLUDED.rank_tier,
        question_text = EXCLUDED.question_text,
        total_marks   = EXCLUDED.total_marks,
        steps         = EXCLUDED.steps,
        topic_tags    = EXCLUDED.topic_tags,
        updated_at    = now();
END$$;

GRANT EXECUTE ON FUNCTION public.upsert_questions(jsonb) TO service_role;

-- 5. Question picker RPC with 3-tier fallback
DROP FUNCTION IF EXISTS public.pick_next_question_v2(uuid);
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
        'question_text', q.question_text,
        'total_marks', q.total_marks,
        'steps', q.steps,
        'topic_tags', q.topic_tags
      )
    FROM public.questions q
    WHERE q.id = picked_id;
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION public.pick_next_question_v2(uuid) TO authenticated;

-- 6. Answer submission RPC (server-side grading)
CREATE OR REPLACE FUNCTION public.submit_answer(
  p_match_id uuid,
  p_question_id uuid,
  p_step_id text,
  p_answer int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_steps jsonb;
  v_step jsonb;
  v_correct_answer int;
  v_is_correct boolean;
  v_marks int;
  v_explanation text;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is in this match
  IF NOT EXISTS (
    SELECT 1 FROM public.matches_new
    WHERE id = p_match_id 
    AND (p1 = v_user_id OR p2 = v_user_id)
  ) THEN
    RAISE EXCEPTION 'User not in this match';
  END IF;

  -- Get question steps
  SELECT steps INTO v_steps
  FROM public.questions
  WHERE id = p_question_id;

  IF v_steps IS NULL THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  -- Find the specific step
  SELECT step INTO v_step
  FROM jsonb_array_elements(v_steps) AS step
  WHERE step->>'id' = p_step_id;

  IF v_step IS NULL THEN
    RAISE EXCEPTION 'Step not found';
  END IF;

  -- Check answer
  v_correct_answer := (v_step->>'correctAnswer')::int;
  v_is_correct := (p_answer = v_correct_answer);
  v_marks := CASE WHEN v_is_correct THEN (v_step->>'marks')::int ELSE 0 END;
  v_explanation := v_step->>'explanation';

  -- Log the submission
  INSERT INTO public.match_events(match_id, sender, type, payload)
  VALUES (
    p_match_id,
    v_user_id,
    'answer_submit',
    jsonb_build_object(
      'question_id', p_question_id,
      'step_id', p_step_id,
      'answer', p_answer,
      'is_correct', v_is_correct,
      'marks_earned', v_marks
    )
  );

  -- Return result (without leaking correct answer to client)
  RETURN jsonb_build_object(
    'is_correct', v_is_correct,
    'marks_earned', v_marks,
    'explanation', v_explanation
  );
END$$;

GRANT EXECUTE ON FUNCTION public.submit_answer(uuid, uuid, text, int) TO authenticated;

-- 7. Enable RLS on match_questions
ALTER TABLE public.match_questions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own match questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'match_questions' AND policyname = 'match_questions_select_own'
  ) THEN
    CREATE POLICY match_questions_select_own ON public.match_questions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.matches_new m
          WHERE m.id = match_questions.match_id
          AND (m.p1 = auth.uid() OR m.p2 = auth.uid())
        )
      );
  END IF;
END $$;

-- Only functions can insert match_questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'match_questions' AND policyname = 'match_questions_insert_function'
  ) THEN
    CREATE POLICY match_questions_insert_function ON public.match_questions
      FOR INSERT
      TO authenticated
      WITH CHECK (false);
  END IF;
END $$;

-- 8. Ensure questions table has appropriate RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read questions (but only through RPCs in practice)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'questions_read_all'
  ) THEN
    CREATE POLICY questions_read_all ON public.questions
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Only service_role can insert/update questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'questions_insert_service'
  ) THEN
    CREATE POLICY questions_insert_service ON public.questions
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'questions_update_service'
  ) THEN
    CREATE POLICY questions_update_service ON public.questions
      FOR UPDATE
      TO service_role
      USING (true);
  END IF;
END $$;
