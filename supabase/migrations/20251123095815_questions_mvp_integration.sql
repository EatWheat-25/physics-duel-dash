/*
  # Questions MVP Integration

  1. Changes
    - Update questions table to support multi-step questions
    - Add indexes for better query performance
    - Update RLS policies for question access

  2. New Columns
    - steps (jsonb) - Array of question steps for multi-step problems
    - step_count (integer) - Number of steps in the question
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'steps'
  ) THEN
    ALTER TABLE public.questions ADD COLUMN steps jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'step_count'
  ) THEN
    ALTER TABLE public.questions ADD COLUMN step_count integer DEFAULT 1;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON public.questions(chapter);
CREATE INDEX IF NOT EXISTS idx_questions_step_count ON public.questions(step_count);

-- Update RLS policies
DROP POLICY IF EXISTS "Questions are viewable by authenticated users" ON public.questions;

CREATE POLICY "Questions are viewable by authenticated users"
ON public.questions
FOR SELECT
TO authenticated
USING (true);
