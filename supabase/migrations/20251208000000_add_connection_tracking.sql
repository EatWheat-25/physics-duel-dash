-- ═══════════════════════════════════════════════════════════════════════
-- ADD CONNECTION TRACKING TO MATCHES TABLE
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- This migration adds database-backed connection tracking for WebSocket
-- connections. This allows connection status to be shared across multiple
-- Edge Function instances.
--
-- ═══════════════════════════════════════════════════════════════════════

-- Add connection tracking columns to matches table
DO $$ 
BEGIN
  -- Add player1_connected_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'player1_connected_at'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN player1_connected_at TIMESTAMPTZ;
  END IF;

  -- Add player2_connected_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'player2_connected_at'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN player2_connected_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add index for faster queries on connection status (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'matches') THEN
    CREATE INDEX IF NOT EXISTS idx_matches_connection_status 
      ON public.matches(id) 
      WHERE player1_connected_at IS NOT NULL OR player2_connected_at IS NOT NULL;
  END IF;
END $$;

-- Add comments explaining the columns (only if columns exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'player1_connected_at'
  ) THEN
    COMMENT ON COLUMN public.matches.player1_connected_at IS 'Timestamp when player1 connected via WebSocket. NULL if not connected.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'player2_connected_at'
  ) THEN
    COMMENT ON COLUMN public.matches.player2_connected_at IS 'Timestamp when player2 connected via WebSocket. NULL if not connected.';
  END IF;
END $$;

