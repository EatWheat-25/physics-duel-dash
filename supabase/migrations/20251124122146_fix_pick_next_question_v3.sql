/*
  # Fix pick_next_question_v3 RPC - Variable Name Conflict

  ## Problem
  The variable `ordinal` conflicts with the column name `ordinal` in match_questions table.

  ## Solution
  Rename the variable to avoid ambiguity.
*/

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
  SELECT COALESCE(MAX(mq.ordinal), 0) + 1 
  INTO next_ord
  FROM public.match_questions mq
  WHERE mq.match_id = p_match_id;

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
              'id', qs.id::text,
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
