-- Fix Foreign Keys for Questions V2
-- The match_rounds and match_answers tables were referencing the old 'questions' table
-- but the game is now using 'questions_v2'. This caused inserts to fail.

-- 0. Clean up existing data that would violate the new constraints
-- Since we are changing the FK target, old data pointing to 'questions' is invalid.
TRUNCATE TABLE public.match_answers CASCADE;
TRUNCATE TABLE public.match_rounds CASCADE;
TRUNCATE TABLE public.match_questions CASCADE;
-- Optional: Truncate matches too if you want a clean slate, but strictly not required if we cascade delete rounds/answers
-- TRUNCATE TABLE public.matches_new CASCADE;

-- 1. Fix match_rounds
ALTER TABLE public.match_rounds 
  DROP CONSTRAINT IF EXISTS match_rounds_question_id_fkey;

ALTER TABLE public.match_rounds 
  ADD CONSTRAINT match_rounds_question_id_fkey 
  FOREIGN KEY (question_id) 
  REFERENCES public.questions_v2(id) 
  ON DELETE CASCADE;

-- 2. Fix match_answers
ALTER TABLE public.match_answers 
  DROP CONSTRAINT IF EXISTS match_answers_question_id_fkey;

ALTER TABLE public.match_answers 
  ADD CONSTRAINT match_answers_question_id_fkey 
  FOREIGN KEY (question_id) 
  REFERENCES public.questions_v2(id) 
  ON DELETE CASCADE;

-- 3. Fix match_questions (if it exists and has the constraint)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'match_questions') THEN
    ALTER TABLE public.match_questions DROP CONSTRAINT IF EXISTS match_questions_question_id_fkey;
    ALTER TABLE public.match_questions ADD CONSTRAINT match_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions_v2(id) ON DELETE CASCADE;
  END IF;
END $$;
