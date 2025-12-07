-- Fix Foreign Key constraints to point to questions_v2
-- This is critical because the game uses questions_v2 but these tables were referencing the old questions table.

-- Clean up orphaned data first (rows with question_id that don't exist in questions_v2)
-- This prevents foreign key constraint violations

DO $$
BEGIN
  -- Clean up match_rounds (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_rounds') THEN
    DELETE FROM public.match_rounds
    WHERE question_id IS NOT NULL
      AND question_id NOT IN (SELECT id FROM public.questions_v2);
    
    RAISE NOTICE 'Cleaned up orphaned data from match_rounds';
  END IF;

  -- Clean up match_answers (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_answers') THEN
    DELETE FROM public.match_answers
    WHERE question_id IS NOT NULL
      AND question_id NOT IN (SELECT id FROM public.questions_v2);
    
    RAISE NOTICE 'Cleaned up orphaned data from match_answers';
  END IF;

  -- Clean up match_questions (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_questions') THEN
    DELETE FROM public.match_questions
    WHERE question_id IS NOT NULL
      AND question_id NOT IN (SELECT id FROM public.questions_v2);
    
    RAISE NOTICE 'Cleaned up orphaned data from match_questions';
  END IF;
END $$;

-- Fix foreign key constraints (only if tables exist)

DO $$
BEGIN
  -- 1. match_questions
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_questions') THEN
    ALTER TABLE public.match_questions
      DROP CONSTRAINT IF EXISTS match_questions_question_id_fkey;

    ALTER TABLE public.match_questions
      ADD CONSTRAINT match_questions_question_id_fkey
      FOREIGN KEY (question_id)
      REFERENCES public.questions_v2(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed foreign key constraint on match_questions';
  END IF;

  -- 2. match_rounds
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_rounds') THEN
    ALTER TABLE public.match_rounds
      DROP CONSTRAINT IF EXISTS match_rounds_question_id_fkey;

    ALTER TABLE public.match_rounds
      ADD CONSTRAINT match_rounds_question_id_fkey
      FOREIGN KEY (question_id)
      REFERENCES public.questions_v2(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed foreign key constraint on match_rounds';
  END IF;

  -- 3. match_answers
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_answers') THEN
    ALTER TABLE public.match_answers
      DROP CONSTRAINT IF EXISTS match_answers_question_id_fkey;

    ALTER TABLE public.match_answers
      ADD CONSTRAINT match_answers_question_id_fkey
      FOREIGN KEY (question_id)
      REFERENCES public.questions_v2(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed foreign key constraint on match_answers';
  END IF;
END $$;
