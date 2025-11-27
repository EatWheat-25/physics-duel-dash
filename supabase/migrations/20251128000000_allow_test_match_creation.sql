-- Allow users to create test matches (for development/testing)
-- In production, matches should be created server-side by matchmaking

CREATE POLICY "users_can_create_matches"
  ON public.matches_new
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = p1 OR auth.uid() = p2);
