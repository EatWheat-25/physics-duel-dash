-- Ensure all foreign keys referencing questions_v2 have ON DELETE CASCADE
-- This allows questions to be deleted even when they're used in matches

BEGIN;

-- 1. Fix match_rounds.question_id foreign key
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'match_rounds_question_id_fkey' 
    AND table_name = 'match_rounds'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.match_rounds 
      DROP CONSTRAINT match_rounds_question_id_fkey;
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
    
    RAISE NOTICE 'Fixed match_rounds.question_id foreign key with CASCADE';
  END IF;
END $$;

-- 2. Fix match_answers.question_id foreign key
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'match_answers_question_id_fkey' 
    AND table_name = 'match_answers'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.match_answers 
      DROP CONSTRAINT match_answers_question_id_fkey;
  END IF;

  -- Recreate with ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'match_answers'
  ) THEN
    ALTER TABLE public.match_answers
      ADD CONSTRAINT match_answers_question_id_fkey
      FOREIGN KEY (question_id)
      REFERENCES public.questions_v2(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed match_answers.question_id foreign key with CASCADE';
  END IF;
END $$;

-- 3. Fix match_questions.question_id foreign key (if table exists)
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'match_questions_question_id_fkey' 
    AND table_name = 'match_questions'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.match_questions 
      DROP CONSTRAINT match_questions_question_id_fkey;
  END IF;

  -- Recreate with ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'match_questions'
  ) THEN
    ALTER TABLE public.match_questions
      ADD CONSTRAINT match_questions_question_id_fkey
      FOREIGN KEY (question_id)
      REFERENCES public.questions_v2(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Fixed match_questions.question_id foreign key with CASCADE';
  END IF;
END $$;

-- 4. Check for any other foreign keys referencing questions_v2
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT 
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'questions_v2'
      AND ccu.column_name = 'id'
      AND tc.constraint_name NOT IN (
        'match_rounds_question_id_fkey',
        'match_answers_question_id_fkey',
        'match_questions_question_id_fkey'
      )
  LOOP
    -- Log any other foreign keys found
    RAISE NOTICE 'Found additional foreign key: %.% referencing questions_v2 (constraint: %)', 
      constraint_record.table_name, 
      constraint_record.column_name,
      constraint_record.constraint_name;
    
    -- Try to drop and recreate with CASCADE
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', 
        constraint_record.table_name, 
        constraint_record.constraint_name);
      
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.questions_v2(id) ON DELETE CASCADE',
        constraint_record.table_name,
        constraint_record.constraint_name,
        constraint_record.column_name);
      
      RAISE NOTICE 'Fixed % foreign key with CASCADE', constraint_record.constraint_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not fix constraint %: %', constraint_record.constraint_name, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;

