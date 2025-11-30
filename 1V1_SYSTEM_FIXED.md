# 1v1 Battle System - Fixed & Complete

## What Was Fixed

### 1. Database Schema Migration
**File:** `supabase/migrations/20251202000000_fix_connection_schema.sql`

- Ensures `matches` table has correct columns: `player1_id`, `player2_id`, `status`
- Handles migration from old schema (`p1`, `p2`, `state`) if exists
- Creates `questions` and `matchmaking_queue` tables with correct structure
- Sets up RLS policies
- Seeds 5 physics questions

### 2. Game-WS Edge Function
**File:** `supabase/functions/game-ws/index.ts`

**Fixed:**
- Transforms simple question format to `StepBasedQuestion` format client expects
- Sends `ROUND_START` with all required fields: `roundId`, `roundIndex`, `phase`, `thinkingEndsAt`
- Removed references to non-existent tables (`match_questions`)
- Uses `public.matches` with `player1_id`/`player2_id`

**Question Transformation:**
- Simple DB format: `{ id, text, steps: { type, options, answer } }`
- Transforms to: `{ id, title, subject, chapter, level, difficulty, stem, totalMarks, steps: [...] }`

### 3. Matchmaking Hook
**File:** `src/hooks/useMatchmaking.ts`

**Fixed:**
- Navigates to correct route: `/online-battle/:matchId` (was `/battle/:matchId`)
- Uses `matchmake-simple` edge function
- Simple state: `idle` → `searching` → `matched`

### 4. OnlineBattle Component
**File:** `src/components/OnlineBattle.tsx`

**Fixed:**
- Fetches from `public.matches` (not `matches_new`)
- Uses `player1_id`/`player2_id` (not `p1`/`p2`)
- Updated `Match` interface to match schema
- Added error logging

### 5. Matchmake-Simple Edge Function
**File:** `supabase/functions/matchmake-simple/index.ts`

**Fixed:**
- Uses `public.matchmaking_queue` and `public.matches`
- Creates matches with `status: 'pending'` (not `'active'`)
- Updates queue status to `'matched'` (not deleting)

## Complete Flow

```
1. User clicks "Start Battle"
   ↓
2. useMatchmaking.startMatchmaking()
   ↓
3. Calls matchmake-simple edge function
   ↓
4. matchmake-simple:
   - Inserts player into matchmaking_queue
   - Looks for waiting opponent
   - If found: Creates match in public.matches
   - Returns match or queued status
   ↓
5. Client navigates to /online-battle/:matchId
   ↓
6. OnlineBattle component:
   - Fetches match from public.matches
   - Connects WebSocket to game-ws
   ↓
7. game-ws edge function:
   - Verifies user is in match
   - Waits for both players
   - Fetches random question from public.questions
   - Transforms to StepBasedQuestion format
   - Sends ROUND_START event
   ↓
8. Client receives question and displays it
```

## How to Apply

### Step 1: Apply Migration
```bash
supabase db push
```

This will:
- Fix `matches` table structure
- Ensure `questions` and `matchmaking_queue` exist
- Seed 5 physics questions
- Set up RLS policies

### Step 2: Deploy Edge Functions
```bash
supabase functions deploy matchmake-simple
supabase functions deploy game-ws
```

### Step 3: Test
1. Start matchmaking from UI
2. Should navigate to `/online-battle/:matchId`
3. Should connect and receive question

## Database Tables

### `public.matches`
```sql
- id: UUID
- player1_id: UUID (references auth.users)
- player2_id: UUID (references auth.users)
- status: 'pending' | 'active' | 'finished'
- created_at: TIMESTAMPTZ
```

### `public.matchmaking_queue`
```sql
- id: UUID
- player_id: UUID (unique, references auth.users)
- status: 'waiting' | 'matched'
- created_at: TIMESTAMPTZ
```

### `public.questions`
```sql
- id: UUID
- text: TEXT
- steps: JSONB { type: 'mcq', options: string[], answer: number }
- created_at: TIMESTAMPTZ
```

## Troubleshooting

**"Connecting to Battle..." stuck:**
1. Check browser console for errors
2. Run `npm run db:matches` to verify match exists
3. Check WebSocket connection in Network tab
4. Verify user is `player1_id` or `player2_id` in match

**"Match not found" error:**
- Migration might not be applied: `supabase db push`
- Check match exists: `npm run db:match <match-id>`

**"No questions available":**
- Migration seeds 5 questions automatically
- Check: `npm run db:questions`

