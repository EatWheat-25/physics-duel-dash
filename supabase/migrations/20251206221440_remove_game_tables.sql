-- ========================================
-- Remove Game Tables and RPCs
-- ========================================
-- This migration removes all game logic tables and functions
-- Keeps only matchmaking infrastructure (matches, matchmaking_queue)

-- Drop game-related RPC functions
DROP FUNCTION IF EXISTS public.submit_round_answer(UUID, UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.evaluate_round(UUID, UUID);
DROP FUNCTION IF EXISTS public.finish_match(UUID, UUID);

-- Drop game-related tables
DROP TABLE IF EXISTS public.match_rounds CASCADE;

-- Note: We keep the following tables for matchmaking:
-- - matches (needed for match creation)
-- - matchmaking_queue (needed for queue system)

