-- Fix foreign key constraint for match_step_answers_v2.match_id
-- It was pointing to matches_new but should point to matches

DO $$
BEGIN
  -- Drop existing foreign key if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'match_step_answers_v2_match_id_fkey'
    AND table_name = 'match_step_answers_v2'
  ) THEN
    ALTER TABLE public.match_step_answers_v2
      DROP CONSTRAINT match_step_answers_v2_match_id_fkey;
    
    RAISE NOTICE 'Dropped existing foreign key constraint';
  END IF;

  -- Add new foreign key pointing to matches table
  ALTER TABLE public.match_step_answers_v2
    ADD CONSTRAINT match_step_answers_v2_match_id_fkey
    FOREIGN KEY (match_id)
    REFERENCES public.matches(id)
    ON DELETE CASCADE;
  
  RAISE NOTICE 'Added foreign key constraint to matches table';
END $$;
