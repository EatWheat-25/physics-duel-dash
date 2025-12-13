/**
 * Fix match_rounds table - ensures it exists before applying dependent migrations
 * 
 * Usage: npx tsx scripts/fix-match-rounds-table.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixMatchRoundsTable() {
  console.log('🔧 Fixing match_rounds table...\n')

  // Check if table exists
  const { data: checkTable, error: checkError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'match_rounds'
        ) as exists;
      `
    })

  // Try direct query instead
  const { data: testQuery, error: testError } = await supabase
    .from('match_rounds')
    .select('id')
    .limit(1)

  if (testError && testError.code === '42P01') {
    console.log('❌ match_rounds table does not exist')
    console.log('📝 Creating match_rounds table...\n')
    
    // Read the migration file
    const migrationPath = resolve(__dirname, '../supabase/migrations/20251212000001_v2_round_identity_and_results_versioning.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    // Extract just the table creation part
    const createTableSQL = `
-- Create match_rounds table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.match_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  round_number INT,
  status TEXT NOT NULL DEFAULT 'active',
  player1_round_score INT NOT NULL DEFAULT 0,
  player2_round_score INT NOT NULL DEFAULT 0,
  player1_answered_at TIMESTAMPTZ,
  player2_answered_at TIMESTAMPTZ,
  player1_answer_payload JSONB,
  player2_answer_payload JSONB,
  round_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add question_id FK if questions table exists and FK doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'questions_v2') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'match_rounds_question_id_fkey' 
      AND table_name = 'match_rounds'
    ) THEN
      ALTER TABLE public.match_rounds
        ADD CONSTRAINT match_rounds_question_id_fkey 
        FOREIGN KEY (question_id) REFERENCES public.questions_v2(id);
    END IF;
  END IF;
END $$;

-- Add columns to matches table
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS current_round_id uuid null,
  ADD COLUMN IF NOT EXISTS current_round_number int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results_round_id uuid null,
  ADD COLUMN IF NOT EXISTS results_version int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results_payload jsonb null;

-- Add foreign key constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_rounds') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'matches_current_round_id_fkey' 
      AND table_name = 'matches'
    ) THEN
      ALTER TABLE public.matches
        ADD CONSTRAINT matches_current_round_id_fkey 
        FOREIGN KEY (current_round_id) REFERENCES public.match_rounds(id);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'matches_results_round_id_fkey' 
      AND table_name = 'matches'
    ) THEN
      ALTER TABLE public.matches
        ADD CONSTRAINT matches_results_round_id_fkey 
        FOREIGN KEY (results_round_id) REFERENCES public.match_rounds(id);
    END IF;
  END IF;
END $$;

-- Add additional columns to match_rounds
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_rounds') THEN
    ALTER TABLE public.match_rounds
      ADD COLUMN IF NOT EXISTS question_payload jsonb null,
      ADD COLUMN IF NOT EXISTS step_deadlines jsonb null,
      ADD COLUMN IF NOT EXISTS p1_eliminated_at timestamptz null,
      ADD COLUMN IF NOT EXISTS p2_eliminated_at timestamptz null;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'match_rounds' AND column_name = 'player1_answer_payload') THEN
      ALTER TABLE public.match_rounds
        ALTER COLUMN player1_answer_payload SET DEFAULT '{"version":2,"steps":[]}'::jsonb;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'match_rounds' AND column_name = 'player2_answer_payload') THEN
      ALTER TABLE public.match_rounds
        ALTER COLUMN player2_answer_payload SET DEFAULT '{"version":2,"steps":[]}'::jsonb;
    END IF;

    -- Update status values
    UPDATE public.match_rounds
    SET status = CASE status
      WHEN 'active' THEN 'main'
      WHEN 'evaluating' THEN 'steps'
      WHEN 'finished' THEN 'done'
      WHEN 'results' THEN 'results'
      WHEN 'done' THEN 'done'
      WHEN 'main' THEN 'main'
      WHEN 'steps' THEN 'steps'
      ELSE 'main'
    END
    WHERE status IS NOT NULL;

    -- Drop existing status constraints
    DO $inner$
    DECLARE
      r record;
    BEGIN
      FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.match_rounds'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE public.match_rounds DROP CONSTRAINT %I', r.conname);
      END LOOP;
    END $inner$;

    -- Add new status constraint
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'match_rounds_status_check' 
      AND conrelid = 'public.match_rounds'::regclass
    ) THEN
      ALTER TABLE public.match_rounds DROP CONSTRAINT match_rounds_status_check;
    END IF;
    
    ALTER TABLE public.match_rounds
      ADD CONSTRAINT match_rounds_status_check
      CHECK (status IN ('main','steps','results','done'));
  END IF;
END $$;
    `.trim()

    console.log('⚠️  This script cannot directly execute SQL via Supabase client.')
    console.log('📋 Please run this SQL in Supabase Dashboard → SQL Editor:\n')
    console.log('='.repeat(80))
    console.log(createTableSQL)
    console.log('='.repeat(80))
    console.log('\n✅ After running the SQL above, you can then run: supabase db push')
    
  } else if (testError) {
    console.log(`❌ Error checking table: ${testError.message}`)
  } else {
    console.log('✅ match_rounds table exists!')
    console.log('✅ You can now run: supabase db push')
  }
}

fixMatchRoundsTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

