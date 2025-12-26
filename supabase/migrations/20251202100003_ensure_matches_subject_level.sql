-- Ensure matches table has subject and mode columns
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'maths',
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'a2';

-- Remove any 'general' dummy values
UPDATE public.matches
  SET subject = 'maths'
  WHERE subject IS NULL OR subject = 'general';

UPDATE public.matches
  SET mode = 'a2'
  WHERE mode IS NULL OR mode = 'general';



































