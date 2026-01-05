-- Immediate fix for match_rounds_question_id_fkey to ensure it has ON DELETE CASCADE
-- This migration forcefully drops and recreates the constraint with CASCADE

DO $$
BEGIN
  -- Drop the constraint if it exists (regardless of whether it has CASCADE or not)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'match_rounds_question_id_fkey' 
    AND table_name = 'match_rounds'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.match_rounds 
      DROP CONSTRAINT match_rounds_question_id_fkey;
    RAISE NOTICE 'Dropped existing match_rounds_question_id_fkey constraint';
  END IF;

  -- Recreate with ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'match_rounds'
  ) THEN
    ALTER TABLE public.match_rounds
      ADD CONSTRAINT match_rounds_question_id_fkey
      FOREIGN KEY (question_id)
      REFERENCES public.questions_v2(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Created match_rounds_question_id_fkey constraint with ON DELETE CASCADE';
  ELSE
    RAISE WARNING 'match_rounds table does not exist, skipping constraint creation';
  END IF;
END $$;







