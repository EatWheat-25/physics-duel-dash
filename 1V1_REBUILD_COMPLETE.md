# 1v1 Battle System - Clean Rebuild Complete

## Summary

The 1v1 battle system has been rebuilt from scratch with a clean, idempotent architecture. The working matchmaking pipeline has been preserved, and everything after match creation has been simplified.

## What Was Changed

### Phase 1: Database - `match_rounds` Table ✅
**File:** `supabase/migrations/20251203000000_add_match_rounds.sql`

- Created `public.match_rounds` table to track question assignment per match
- Ensures only one active question per match (unique constraint)
- RLS policy allows players to view rounds for their matches

### Phase 2: Types Update ✅
**File:** `src/types/schema.ts`

- Added `MatchRoundRow` interface matching the database schema

### Phase 3: Rewrite `game-ws` ✅
**File:** `supabase/functions/game-ws/index.ts`

**Before:** Complex state machine with phases, timers, in-memory state
**After:** Simple, stateless function that:
- Accepts `JOIN_MATCH` message
- Checks `match_rounds` table for existing question
- If exists: sends `ROUND_START` with that question (idempotent!)
- If not: picks random question, inserts into `match_rounds`, sends `ROUND_START`
- No complex state management
- No phase transitions
- No timers

### Phase 4: New `useGame` Hook ✅
**File:** `src/hooks/useGame.ts` (NEW)

Simple hook that:
- Takes `match: MatchRow | null`
- Opens WebSocket connection to `game-ws`
- Sends `JOIN_MATCH` message on connect
- Listens for `ROUND_START` and `GAME_ERROR` events
- Returns: `{ question, gameStatus, errorMessage }`

### Phase 5: Simplify `OnlineBattle` ✅
**File:** `src/components/OnlineBattle.tsx`

**Before:** Complex reducer, multiple phases, transformation layers
**After:** Simple component that:
- Fetches match from URL param
- Uses `useGame(match)` hook
- Renders question or loading/error state
- No complex state management

## What Was Preserved

✅ **Matchmaking Pipeline** - Completely untouched:
- `supabase/functions/matchmake-simple/index.ts`
- `src/hooks/useMatchmaking.ts`
- `public.matchmaking_queue` table
- `public.matches` table creation logic

## How It Works Now

### Flow Diagram

```
1. User clicks "Start"
   ↓
2. useMatchmaking.startMatchmaking()
   ↓
3. matchmake-simple edge function
   ↓
4. Creates row in public.matches
   ↓
5. Navigates to /online-battle/:matchId
   ↓
6. OnlineBattle component
   ↓
7. useGame(match) hook
   ↓
8. WebSocket → game-ws
   ↓
9. Sends JOIN_MATCH message
   ↓
10. game-ws checks match_rounds table
    ↓
11a. If round exists → fetch question → send ROUND_START
11b. If not → pick random → insert into match_rounds → send ROUND_START
    ↓
12. Frontend receives ROUND_START → displays question
```

### Key Design Decisions

1. **`match_rounds` table = Single Source of Truth**
   - Each match gets exactly one question
   - Stored in database, not memory
   - Survives function restarts

2. **`JOIN_MATCH` message = Idempotent Entry Point**
   - Can be called multiple times safely
   - Always returns the same question for the same match
   - Reconnects don't create new questions

3. **Stateless Function**
   - No in-memory state
   - Works across function restarts
   - Simple and predictable

4. **Simple Question Format**
   - Uses `Question` type directly from schema
   - No complex transformation layers
   - `{ id, text, steps: { type, options, answer }, created_at }`

## Testing Checklist

### 1. Apply Migration
```sql
-- Run in Supabase SQL Editor:
-- Copy contents of supabase/migrations/20251203000000_add_match_rounds.sql
```

### 2. Test Matchmaking (Should Still Work)
- [ ] Two players click "Start"
- [ ] Both get matched
- [ ] Row appears in `public.matches`
- [ ] Navigate to `/online-battle/:matchId`

### 3. Test Question Assignment
- [ ] Both players see the SAME question
- [ ] Question comes from `public.questions` table
- [ ] Check `public.match_rounds` - should have one row with `status='active'`

### 4. Test Idempotency
- [ ] Refresh page on one player
- [ ] Should see the SAME question (not a new one)
- [ ] Check `public.match_rounds` - should still have only one row

### 5. Test Reconnection
- [ ] Disconnect one player
- [ ] Reconnect
- [ ] Should receive the same question
- [ ] No duplicate rows in `match_rounds`

## Database Schema

### `public.match_rounds`
```sql
- id: uuid (primary key)
- match_id: uuid (references matches.id)
- question_id: uuid (references questions.id)
- status: 'active' | 'finished'
- created_at: timestamptz
- UNIQUE(match_id) WHERE status = 'active'
```

## WebSocket Protocol

### Client → Server: `JOIN_MATCH`
```json
{
  "type": "JOIN_MATCH",
  "match_id": "uuid",
  "player_id": "uuid"
}
```

### Server → Client: `ROUND_START`
```json
{
  "type": "ROUND_START",
  "match_id": "uuid",
  "question": {
    "id": "uuid",
    "text": "What is...?",
    "steps": {
      "type": "mcq",
      "options": ["A", "B", "C", "D"],
      "answer": 1
    },
    "created_at": "2024-..."
  }
}
```

### Server → Client: `GAME_ERROR`
```json
{
  "type": "GAME_ERROR",
  "message": "Error description"
}
```

## Next Steps (Future Enhancements)

1. **Answer Submission**
   - Add answer handling in `game-ws`
   - Store answers in database
   - Calculate results

2. **Scoring**
   - Track player scores
   - Determine winner
   - Update match status

3. **UI Improvements**
   - Better question display
   - Answer selection UI
   - Results screen

## Files Modified

- ✅ `supabase/migrations/20251203000000_add_match_rounds.sql` (NEW)
- ✅ `src/types/schema.ts` (added MatchRoundRow)
- ✅ `supabase/functions/game-ws/index.ts` (complete rewrite)
- ✅ `src/hooks/useGame.ts` (NEW)
- ✅ `src/components/OnlineBattle.tsx` (simplified)

## Files Preserved (Untouched)

- ✅ `supabase/functions/matchmake-simple/index.ts`
- ✅ `src/hooks/useMatchmaking.ts`
- ✅ `supabase/migrations/20251201000000_rebuild_1v1_clean.sql`

---

**Status:** ✅ Complete - Ready for testing

