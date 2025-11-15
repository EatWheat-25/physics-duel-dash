# MVP Deployment Checklist - Questions Integration

## Status: ✅ Code Complete - Ready for Testing

---

## What You'll See in Console Logs

### Server Logs (Supabase Edge Functions → game-ws)

**When both players ready:**
```
[match-uuid] Fetching next question from database...
[match-uuid] Got question: question-uuid ordinal: 1
```

**If database is empty:**
```
[match-uuid] No questions available for match. Database may be empty!
```

### Client Logs (Browser Console)

**Both players should see:**
```javascript
WS: Connecting to game-ws for match [id]
WS: Connected successfully
WS: Connection confirmed as player p1 (or p2)
WS: Sent ready signal
WS: Player ready: p1
WS: Player ready: p2
WS: Game started
WS: Game starting with question!
WS question payload: {
  "type": "game_start",
  "question": {
    "id": "a2-bronze-1",
    "title": "Find the inverse function...",
    "steps": [...]
  },
  "ordinal": 1,
  "total_questions": 5
}
WS: Question set to state: a2-bronze-1
```

**If question is null:**
```javascript
WS: event.question is null/undefined! 
{ type: 'game_start', question: null, ordinal: 1 }
```

---

## Pre-Flight Checklist

### 1. Verify Database Has Questions

```bash
# In Supabase SQL Editor
SELECT count(*) FROM questions;
```

**Expected:** 100+ questions

**If 0, run seed script:**
```bash
npm run seed:questions
```

### 2. Verify Migration Applied

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%question%' OR routine_name = 'submit_answer';
```

**Expected:** Should see:
- `pick_next_question_v2`
- `submit_answer`  
- `upsert_questions`

### 3. Deploy Edge Function

The game-ws function needs the latest code with debug logs.

**Check deployment status:**
- Supabase Dashboard → Edge Functions → game-ws
- Should show "Deployed" 
- Check recent invocations (should be healthy)

**If not deployed or needs update:**
```bash
supabase functions deploy game-ws
```

### 4. Build Client

```bash
npm run build
# Should complete: ✓ built in ~10s
```

---

## Testing Protocol

### Setup

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open two browser windows:**
   - Window 1: Normal browser
   - Window 2: Incognito/private mode

3. **Open console in both (F12 or Cmd+Opt+J)**

### Test Flow

**Player 1 (Window 1):**
1. Login/signup
2. Click "Battle" or join queue
3. Wait for match creation
4. Copy match ID from URL: `/battle/[match-id]`

**Player 2 (Window 2):**
1. Login/signup with **different account**
2. Navigate directly to: `/battle/[match-id]` (paste Player 1's URL)
3. Both players should auto-ready

**Expected Behavior:**

1. ✅ Both consoles show "WS: Connected successfully"
2. ✅ Both consoles show "WS: Player ready: p1" and "p2"
3. ✅ Both consoles show "WS: Game starting with question!"
4. ✅ Both consoles show full question payload with steps
5. ✅ UI shows countdown: 3... 2... 1... START!
6. ✅ Question renders with title and 4 options
7. ✅ Clicking option shows toast: "Correct!" or "Incorrect"
8. ✅ Scores update in real-time
9. ✅ Next step/question appears automatically

---

## Troubleshooting Decision Tree

### Issue: "No questions available for match"

**Server log shows:**
```
[match-id] No questions available for match. Database may be empty!
```

**Fix:**
```bash
npm run seed:questions
```

**Verify:**
```sql
SELECT count(*) FROM questions WHERE subject = 'math' AND chapter = 'A2';
```

---

### Issue: Client never logs "WS: Game starting with question!"

**Possible causes:**

1. **Only one player connected**
   - Check both browser consoles
   - Both must show "WS: Sent ready signal"

2. **Server crashed**
   - Check Supabase Edge Functions logs
   - Look for errors in game-ws function

3. **RPC permission error**
   - Check server logs for: "permission denied"
   - Verify GRANT statements in migration

---

### Issue: "WS: event.question is null/undefined!"

**Client logs show:**
```javascript
WS: event.question is null/undefined! 
{ type: 'game_start', question: null }
```

**This means:**
- WebSocket connected ✅
- Both players ready ✅
- Server sent game_start ✅
- But question fetch failed ❌

**Check server logs for:**
```
Error fetching question: [error details]
```

**Common causes:**
- Database empty (no questions seeded)
- RPC permission denied
- Invalid match preferences (subject/chapter mismatch)

**Debug query:**
```sql
-- Check if match has valid preferences
SELECT id, subject, chapter, rank_tier FROM matches_new WHERE id = 'match-uuid';

-- Check if ANY questions match
SELECT count(*) FROM questions 
WHERE subject = 'math' AND chapter = 'A2';
```

---

### Issue: Questions render but answers don't submit

**Check console for:**
```
WS: Submitted answer for question [id], step [step-id]
```

**If missing:**
- Step might not have an `id` field
- Check question structure in console log

**Add temp debug:**
```typescript
console.log('Current step:', currentStep);
console.log('Step ID:', currentStep.id);
```

---

## Success Metrics

Full match completes when:

✅ Both players connect
✅ Question appears after countdown
✅ 5 questions delivered one-by-one
✅ Each answer graded server-side
✅ Scores update in real-time
✅ Match ends with winner/draw
✅ No console errors

---

## Emergency Stop

If completely broken:

```bash
# Stop dev server
Ctrl+C

# Check if seed script ran
psql $DATABASE_URL -c "SELECT count(*) FROM questions;"

# Re-seed if needed
npm run seed:questions

# Rebuild client
npm run build

# Check edge function status
# Supabase Dashboard → Edge Functions → game-ws

# Restart
npm run dev
```

---

## Next Actions After Success

Once MVP works:

1. ✅ Remove debug logs (or reduce verbosity)
2. Add question variety (A1, All-Maths modes)
3. Implement subject/chapter selection UI
4. Add question difficulty progression
5. Track player statistics
6. Build admin content dashboard

---

## Quick Reference Commands

```bash
# Check database
SELECT count(*) FROM questions;
SELECT subject, chapter, count(*) FROM questions GROUP BY subject, chapter;

# Seed questions
npm run seed:questions

# Build client
npm run build

# Deploy function
supabase functions deploy game-ws

# View function logs
# Supabase Dashboard → Edge Functions → game-ws → Logs
```

---

**Version:** 1.1  
**Date:** 2024-11-15  
**Status:** Debug logging added, ready for testing  
**Key Change:** Added detailed console logs on both client and server
