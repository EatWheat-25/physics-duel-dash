-- QUICK FIX: Run this directly in Supabase SQL Editor to fix the matches constraint immediately
-- This will allow questions to be deleted even when referenced in matches table

-- First, check if matches table has question_id column
DO $$
BEGIN
  -- Drop the constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_question_id_fkey' 
    AND table_name = 'matches'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.matches 
      DROP CONSTRAINT matches_question_id_fkey;
    RAISE NOTICE 'Dropped existing matches_question_id_fkey constraint';
  END IF;

  -- Check if question_id column exists and recreate constraint with CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'question_id'
  ) THEN
    -- Recreate with ON DELETE CASCADE
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_question_id_fkey
      FOREIGN KEY (question_id)
      REFERENCES public.questions_v2(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Created matches_question_id_fkey constraint with ON DELETE CASCADE';
  ELSE
    RAISE NOTICE 'matches table does not have question_id column, skipping constraint creation';
  END IF;
END $$;

-- Verify it was created correctly
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_name = 'matches_question_id_fkey'
  AND tc.table_schema = 'public';

-- Should show delete_rule = 'CASCADE'


