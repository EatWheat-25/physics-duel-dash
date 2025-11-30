-- ========================================
-- Fix Matches RLS - Root Cause Fix
-- 
-- Root cause identified:
-- 1. RLS policy doesn't explicitly target 'authenticated' role
-- 2. Missing service role policy (though service role bypasses RLS)
-- 3. Policy might not be applying correctly to all queries
-- 
-- Fix: Recreate policies with explicit role targeting
-- ========================================

-- Ensure RLS is enabled
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to recreate cleanly
DROP POLICY IF EXISTS "Players can view their own matches" ON public.matches;
DROP POLICY IF EXISTS "Players can update their own matches" ON public.matches;
DROP POLICY IF EXISTS "Service role can manage matches" ON public.matches;
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;
DROP POLICY IF EXISTS "users_can_create_matches" ON public.matches;

-- Recreate SELECT policy with explicit 'authenticated' role
-- This ensures authenticated users can view matches where they are a player
CREATE POLICY "Players can view their own matches"
  ON public.matches FOR SELECT
  TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Recreate UPDATE policy with explicit 'authenticated' role
CREATE POLICY "Players can update their own matches"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Add service role policy (explicit, though service role bypasses RLS by default)
-- This is for clarity and ensures service role operations work
CREATE POLICY "Service role can manage matches"
  ON public.matches FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

