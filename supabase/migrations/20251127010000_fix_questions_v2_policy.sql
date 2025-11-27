-- Fix RLS policy to allow public (anon) read access
-- Previous policy was restricted to 'authenticated' role

DROP POLICY IF EXISTS "questions_v2_select_all" ON public.questions_v2;

CREATE POLICY "questions_v2_select_all"
  ON public.questions_v2
  FOR SELECT
  TO public
  USING (true);
