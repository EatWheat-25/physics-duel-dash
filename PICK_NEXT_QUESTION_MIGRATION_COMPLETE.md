# pick_next_question_v2 Migration - COMPLETE ✅

## What Was Done

Successfully applied the questions MVP integration migration to the Supabase database (pwsgotzkeflizgfgqfbd) and fixed the Edge Function to properly call the RPC.

## Changes Applied

### 1. Database Schema ✅

**New Tables:**
- `match_questions` - Junction table tracking which questions are used in each match
  - Prevents duplicate questions in the same match
  - Tracks ordinal (question order) per match

**New Columns on `matches_new`:**
- `subject` TEXT - Filter questions by subject (math, physics, etc.)
- `chapter` TEXT - Filter questions by chapter/level (A1, A2, etc.)
- `rank_tier` TEXT - Filter questions by rank tier

**New Indexes on `questions`:**
- `q_subject_chapter_idx` - Speed up filtering by subject and chapter
- `q_rank_idx` - Speed up filtering by rank tier
- `q_level_difficulty_idx` - Speed up filtering by level and difficulty

### 2. Database Functions ✅

Created three RPC functions:

#### `pick_next_question_v2(p_match_id uuid)`
- **Purpose**: Select next unused question for a match
- **Returns**: Table with `question_id`, `ordinal`, and full `question` JSONB
- **Logic**: 3-tier fallback system
  1. **Tier 1**: Strict match (subject + chapter + rank)
  2. **Tier 2**: Relax chapter (subject + rank only)
  3. **Tier 3**: Any unused question
- **Security**: `SECURITY DEFINER`, granted to `authenticated` role
- **Atomic**: Inserts into `match_questions` to track usage

#### `submit_answer(p_match_id, p_question_id, p_step_id, p_answer)`
- **Purpose**: Server-side answer grading
- **Returns**: JSONB with `is_correct`, `marks_earned`, `explanation`
- **Security**: 
  - Verifies user is authenticated
  - Verifies user is in the match
  - Doesn't leak correct answer to client
- **Logging**: Records submission in `match_events` table

#### `upsert_questions(q jsonb)`
- **Purpose**: Idempotent question seeding
- **Security**: Only `service_role` can execute
- **Usage**: Used by seed script

### 3. Row Level Security (RLS) ✅

**`match_questions` table:**
- SELECT: Users can only see questions from their own matches
- INSERT: Blocked for direct inserts (only functions can insert)

**`questions` table:**
- SELECT: All authenticated users can read
- INSERT/UPDATE: Only `service_role`

### 4. Edge Function Fix ✅

**File**: `supabase/functions/game-ws/index.ts`

**Changed**: Line 127-129
```typescript
// BEFORE (incorrect parameter name)
const { data, error } = await supabase.rpc('pick_next_question_v2', {
  match_uuid: matchId  // ❌ Wrong parameter name
})

// AFTER (correct parameter name)
const { data, error } = await supabase.rpc('pick_next_question_v2', {
  p_match_id: matchId  // ✅ Matches function parameter
})
```

**Result**: Edge Function redeployed successfully

## Verification

### Functions Exist ✅
```sql
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc 
WHERE proname IN ('pick_next_question_v2', 'submit_answer', 'upsert_questions');
```

**Result:**
- ✅ `pick_next_question_v2(p_match_id uuid)`
- ✅ `submit_answer(p_match_id uuid, p_question_id uuid, p_step_id text, p_answer integer)`
- ✅ `upsert_questions(q jsonb)`

### Tables Exist ✅
- ✅ `match_questions` table with proper foreign keys
- ✅ `matches_new` has `subject`, `chapter`, `rank_tier` columns
- ✅ `questions` table has proper indexes

### Edge Function Deployed ✅
- ✅ `game-ws` function updated and redeployed
- ✅ Correct RPC parameter name (`p_match_id`)
- ✅ No deployment errors

## How It Works Now

### Match Start Flow

1. **Player 1 connects** → WebSocket established
2. **Player 2 connects** → WebSocket established  
3. **Both click "Ready"** → Server receives ready signals
4. **Server calls RPC**:
   ```typescript
   supabase.rpc('pick_next_question_v2', { p_match_id: matchId })
   ```
5. **RPC executes**:
   - Reads match filters from `matches_new` (subject, chapter, rank_tier)
   - Queries `questions` table with 3-tier fallback
   - Inserts selected question into `match_questions`
   - Returns question as JSONB
6. **Server sends `game_start` event** with question to both players
7. **Frontend receives question** and displays in UI

### Answer Submission Flow

1. **Player selects answer** → Sends `answer_submit` message
2. **Server calls RPC**:
   ```typescript
   supabase.rpc('submit_answer', {
     p_match_id: matchId,
     p_question_id: questionId,
     p_step_id: stepId,
     p_answer: answerIndex
   })
   ```
3. **RPC executes**:
   - Verifies user is in match
   - Looks up correct answer from `questions.steps`
   - Compares with submitted answer
   - Returns result (doesn't leak correct answer)
4. **Server updates score** and broadcasts to both players
5. **Frontend shows feedback** (correct/incorrect, marks earned)

### Next Question Flow

1. **Player completes all steps** → Sends `question_complete` message
2. **Server increments question counter**
3. **If more questions needed** → Calls `pick_next_question_v2` again
4. **Server sends `next_question` event** to both players
5. **If match is over** → Calculates winner, updates MMR, ends match

## What's Still Needed

### To Test End-to-End:

1. **Seed questions into database**:
   ```bash
   # Add to .env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Run seed script
   npm run seed:questions
   ```

2. **Start a match**:
   - Two users join matchmaking
   - Get matched into a game
   - Both click "Ready"

3. **Expected Behavior**:
   - ✅ Countdown: 3, 2, 1, START!
   - ✅ Question appears from database
   - ✅ Both players see the same question
   - ✅ Can submit answers and see feedback
   - ✅ Score updates in real-time
   - ✅ Next question loads after completion
   - ✅ Match ends after 5 questions

### To Debug:

Check Edge Function logs in Supabase Dashboard → Edge Functions → game-ws → Logs

Look for:
```
[matchId] Fetching next question from database...
[matchId] Match filters - subject: math, chapter: A2
[matchId] ✓ Got question: <uuid> ordinal: 1
[matchId] Question has steps: true
[matchId] Steps count: 3
[matchId] Sending game_start with question to both players
```

If you see:
```
[matchId] No questions available for match. Database may be empty!
```
→ Run the seed script!

## Summary

✅ **Migration applied** - All tables, functions, and RLS policies created  
✅ **Edge Function fixed** - Correct RPC parameter name  
✅ **Edge Function deployed** - Live and ready to use  
✅ **Frontend ready** - OnlineBattle component has fallback question fetch  
✅ **Build succeeds** - No compilation errors  

🎯 **Next Step**: Seed questions into the database and test a real match!
