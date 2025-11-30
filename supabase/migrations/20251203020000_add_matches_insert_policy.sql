-- ========================================
-- Add INSERT policy for matches table
-- ========================================

-- Ensure RLS is enabled
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Add INSERT policy for service role (edge functions)
-- Service role should bypass RLS, but this ensures it works
DROP POLICY IF EXISTS "Service role can insert matches" ON public.matches;
CREATE POLICY "Service role can insert matches"
  ON public.matches FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also add a policy for authenticated users (though edge functions use service role)
-- This allows direct client inserts if needed in the future
DROP POLICY IF EXISTS "Authenticated users can insert matches" ON public.matches;
CREATE POLICY "Authenticated users can insert matches"
  ON public.matches FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );

