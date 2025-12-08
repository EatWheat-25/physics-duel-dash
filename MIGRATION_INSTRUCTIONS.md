# Stage 2 Database Migrations - Application Instructions

## Problem
The Stage 2 answer submission system requires database migrations to be applied. If you see:
- `400` errors when polling match state
- `Failed to submit answer` errors
- `RPC function submit_answer_stage2 not found` errors

The migrations haven't been applied yet.

## Solution: Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:

#### Migration 1: Add Answer Columns
```sql
-- File: supabase/migrations/20251208073027_stage2_add_answer_columns.sql
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS player1_answer INTEGER,
  ADD COLUMN IF NOT EXISTS player2_answer INTEGER,
  ADD COLUMN IF NOT EXISTS player1_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS player2_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS both_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correct_answer INTEGER,
  ADD COLUMN IF NOT EXISTS player1_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS player2_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS round_winner UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS results_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_both_answered 
  ON public.matches(both_answered_at) 
  WHERE both_answered_at IS NOT NULL;
```

#### Migration 2: Submit Answer RPC
Copy and run the entire contents of:
`supabase/migrations/20251208073028_stage2_submit_answer_rpc.sql`

#### Migration 3: Force Timeout RPC
Copy and run the entire contents of:
`supabase/migrations/20251208073029_stage2_force_timeout_rpc.sql`

### Option 2: Supabase CLI (If Installed)

```bash
cd physics-duel-dash
supabase db push
```

### Verification

After applying migrations, verify:

1. **Check columns exist:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'matches' 
  AND column_name IN ('player1_answer', 'player2_answer', 'results_computed_at');
```

2. **Check RPC functions exist:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('submit_answer_stage2', 'force_timeout_stage2');
```

Both queries should return rows.

## After Migration

Once migrations are applied:
- Answer submission will work
- Polling will stop showing 400 errors
- Results will be computed and displayed correctly

