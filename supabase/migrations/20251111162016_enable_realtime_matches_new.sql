/*
  # Enable Realtime and Enforce RLS for matches_new

  1. Configuration
    - Enable Realtime publication for matches_new table
    - Ensure RLS is enabled and users can only see their own matches
    
  2. Security
    - Add SELECT policy for users to view matches where they are p1 or p2
    - This allows Realtime postgres_changes to fire for authenticated users
*/

-- Enable Realtime for matches_new table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'matches_new'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches_new;
  END IF;
END$$;

-- Ensure RLS is enabled
ALTER TABLE public.matches_new ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and recreate with correct name
DROP POLICY IF EXISTS "Users can view their own matches" ON public.matches_new;
DROP POLICY IF EXISTS "matches_new_select_self" ON public.matches_new;

-- Create policy allowing users to view only their own matches (required for Realtime)
CREATE POLICY "matches_new_select_self"
  ON public.matches_new
  FOR SELECT
  TO authenticated
  USING (p1 = auth.uid() OR p2 = auth.uid());
