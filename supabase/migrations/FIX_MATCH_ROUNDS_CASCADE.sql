-- QUICK FIX: Run this directly in Supabase SQL Editor to fix the constraint immediately
-- This will allow questions to be deleted even when referenced in match_rounds

-- Drop the constraint if it exists
ALTER TABLE public.match_rounds 
  DROP CONSTRAINT IF EXISTS match_rounds_question_id_fkey;

-- Recreate with ON DELETE CASCADE
ALTER TABLE public.match_rounds
  ADD CONSTRAINT match_rounds_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES public.questions_v2(id)
  ON DELETE CASCADE;

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
WHERE tc.constraint_name = 'match_rounds_question_id_fkey'
  AND tc.table_schema = 'public';

-- Should show delete_rule = 'CASCADE'

