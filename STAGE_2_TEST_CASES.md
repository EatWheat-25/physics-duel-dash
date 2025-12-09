# Stage 2 Test Cases - Regression Checklist

This document contains the critical test cases for Stage 2 (Answer Submission System). Use this as a regression checklist when testing Stage 3 or any future changes.

## Quick Test Checklist

Run these tests after any changes to ensure Stage 2 functionality remains intact:

### ✅ Test 1: One Answers → Waiting
**Steps:**
1. Start a match with two players
2. Player 1 clicks an answer (True or False)
3. **Expected:** Player 1 sees "Answer submitted! Waiting for opponent..."
4. **Expected:** Player 2 still sees the question (no answer submitted yet)

**Pass Criteria:**
- First player gets immediate feedback
- Opponent status shows as connected
- No errors in console

---

### ✅ Test 2: Both Answer → Both See Same Results
**Steps:**
1. Start a match with two players
2. Player 1 answers
3. Player 2 answers
4. **Expected:** Both players see identical results:
   - Same correct answer
   - Same player1_answer value
   - Same player2_answer value
   - Same round_winner
   - Same player1_correct boolean
   - Same player2_correct boolean

**Pass Criteria:**
- Results appear on both screens simultaneously
- All result values match between players
- Status changes to "results" on both clients
- Opponent shows as connected (green checkmark)

---

### ✅ Test 3: Double-Submit Blocked
**Steps:**
1. Start a match
2. Player clicks an answer (e.g., "True")
3. Player tries to click another answer (e.g., "False")
4. **Expected:** Second click is ignored
5. **Expected:** Console shows "Answer already submitted" warning
6. **Expected:** UI still shows first answer as submitted

**Pass Criteria:**
- Buttons are disabled after first submission
- No duplicate submissions sent to server
- Server RPC returns "already_answered: true" if somehow called twice

---

### ✅ Test 4: Reconnect Mid-Question
**Steps:**
1. Start a match, question appears
2. Player 1 answers
3. Player 1 refreshes browser (simulates reconnect)
4. **Expected:** Player 1 reconnects and sees:
   - Same question displayed
   - Their answer already submitted
   - "Waiting for opponent..." message
5. **Expected:** Player 2 still sees normal flow

**Pass Criteria:**
- Question persists after reconnect
- Answer state is preserved
- No duplicate question sent
- Match state recovered from database

---

### ✅ Test 5: Reconnect on Results
**Steps:**
1. Start a match
2. Both players answer (results displayed)
3. Player 1 refreshes browser
4. **Expected:** Player 1 reconnects and sees:
   - Results screen (not question)
   - Same results as before disconnect
   - Status: "results"
   - Opponent shows as connected

**Pass Criteria:**
- Results persist after reconnect
- No question re-sent
- Match state correctly recovered
- UI shows results immediately

---

### ✅ Test 6: Timeout Triggers Winner Correctly
**Steps:**
1. Start a match
2. Player 1 answers
3. Wait 30+ seconds (Player 2 doesn't answer)
4. **Expected:** After 30 seconds:
   - Player 2 marked as wrong (opposite of correct answer)
   - Results computed automatically
   - Player 1 wins the round (if they answered correctly)
   - Both players see results

**Pass Criteria:**
- Timeout fires after exactly 30 seconds
- Unanswered player marked as incorrect
- Results computed and broadcast
- Round winner determined correctly
- No infinite "waiting" state

---

### ✅ Test 7: Polling Recovers Results if WS Drops
**Steps:**
1. Start a match
2. Both players answer
3. Simulate WebSocket disconnect (close tab network tab, or kill WS connection)
4. Wait 2-4 seconds
5. **Expected:** Polling detects `results_computed_at` in database
6. **Expected:** Results display automatically via polling fallback
7. **Expected:** Console shows "Polling detected results - manually triggering display"

**Pass Criteria:**
- Polling runs every 2 seconds
- Detects results_computed_at when WS message missed
- Custom event triggers results display
- No manual refresh needed
- Results appear within 2-4 seconds

---

## Database Verification Queries

Run these SQL queries to verify database state during testing:

### Check Match State
```sql
SELECT 
  id,
  status,
  question_id,
  player1_answer,
  player2_answer,
  results_computed_at,
  correct_answer,
  player1_correct,
  player2_correct,
  round_winner
FROM public.matches
WHERE id = 'YOUR_MATCH_ID';
```

### Verify RPC Functions Exist
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('submit_answer_stage2', 'force_timeout_stage2');
```

### Check Answer Timestamps
```sql
SELECT 
  player1_answered_at,
  player2_answered_at,
  both_answered_at,
  results_computed_at,
  EXTRACT(EPOCH FROM (both_answered_at - player1_answered_at)) as time_between_answers
FROM public.matches
WHERE id = 'YOUR_MATCH_ID';
```

---

## Known Good Baseline

**Git Tag:** `stage-2-stable`  
**Commit:** Check `git log --oneline` for latest Stage 2 commit  
**Date:** December 8, 2025

### Key Files (Don't Break These)
- `supabase/migrations/20251208073027_stage2_add_answer_columns.sql`
- `supabase/migrations/20251208073028_stage2_submit_answer_rpc.sql`
- `supabase/migrations/20251208073029_stage2_force_timeout_rpc.sql`
- `supabase/functions/game-ws/index.ts` (SUBMIT_ANSWER handler)
- `src/hooks/useGame.ts` (answer submission, message handlers)
- `src/pages/BattleConnected.tsx` (UI, polling fallback)

---

## Rollback Instructions

If Stage 3 breaks Stage 2 functionality:

```bash
# Option 1: Reset to stable tag
git checkout stage-2-stable

# Option 2: Create branch from stable tag
git checkout -b stage-2-rollback stage-2-stable

# Option 3: View what changed
git diff stage-2-stable..HEAD
```

---

## Notes

- All tests assume migrations are applied
- All tests assume True/False questions exist in database
- Timeout test requires waiting 30 seconds (can be reduced for testing)
- Polling test requires WebSocket to actually fail (use browser DevTools Network tab)


