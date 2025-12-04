# Scoring Fix - Instructions

## Problem
Scores are always showing 0-0 draws even when players answer correctly.

## Solution
The `submit_round_answer` RPC function needs to be updated to actually calculate scores based on correctness.

## Step 1: Apply the Migration

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the entire contents of `supabase/migrations/20251204000000_fix_scoring_logic.sql`
4. Click **Run** to execute the SQL

This will update both `submit_round_answer` and `evaluate_round` functions with the scoring logic.

## Step 2: Verify the Fix

After applying the migration, test a match:

1. Start a new match
2. Answer a question correctly
3. Check if scores update properly

## Step 3: Debug (if still not working)

If scores are still 0-0, run this query in Supabase SQL Editor to check a question's structure:

```sql
-- Check question structure
SELECT 
  id,
  title,
  steps,
  (SELECT jsonb_agg(
    jsonb_build_object(
      'step_index', step_index,
      'correct_answer', correct_answer,
      'marks', marks
    ) ORDER BY step_index
  ) FROM question_steps WHERE question_id = q.id) as question_steps_data
FROM questions q
WHERE subject = 'math' AND level = 'A2'
LIMIT 1;
```

This will show you:
- If steps are in `questions.steps` JSONB or `question_steps` table
- What format the `correct_answer` field uses

## Expected Behavior After Fix

- Correct answer → Player earns points (usually 1 point per step)
- Wrong answer → Player earns 0 points
- Scores accumulate across rounds
- Match ends when a player reaches `target_points` or `max_rounds` is reached


