-- Fix Foreign Key constraints to point to questions_v2
-- This is critical because the game uses questions_v2 but these tables were referencing the old questions table.

-- 1. match_questions
ALTER TABLE public.match_questions
  DROP CONSTRAINT IF EXISTS match_questions_question_id_fkey;

ALTER TABLE public.match_questions
  ADD CONSTRAINT match_questions_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES public.questions_v2(id)
  ON DELETE CASCADE;

-- 2. match_rounds
ALTER TABLE public.match_rounds
  DROP CONSTRAINT IF EXISTS match_rounds_question_id_fkey;

ALTER TABLE public.match_rounds
  ADD CONSTRAINT match_rounds_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES public.questions_v2(id)
  ON DELETE CASCADE;

-- 3. match_answers
ALTER TABLE public.match_answers
  DROP CONSTRAINT IF EXISTS match_answers_question_id_fkey;

ALTER TABLE public.match_answers
  ADD CONSTRAINT match_answers_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES public.questions_v2(id)
  ON DELETE CASCADE;
