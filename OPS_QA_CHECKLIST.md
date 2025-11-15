# Operations & QA Checklist

## Status: Ready for Testing

All code changes are complete. Follow this checklist to deploy and test.

---

## Step 1: Verify Environment Variables

```bash
# Check these are set (in your .env file)
cat .env | grep -E "VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"
```

**Expected output:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your-service-role-key
```

If missing, add them to `.env` file.

---

## Step 2: Run Migration

The migration should auto-apply when you push to Supabase. To verify:

```bash
# Check in Supabase Dashboard:
# 1. Go to Database → Migrations
# 2. Find: 20251115044021_questions_mvp_integration
# 3. Status should show "Applied"
```

Or manually check functions exist:

```sql
-- In Supabase SQL Editor
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('pick_next_question_v2', 'submit_answer', 'upsert_questions');
```

**Expected:** 3 rows returned

---

## Step 3: Seed Questions into Database

**This is critical - matches won't work without questions!**

```bash
# Ensure you're in project root
cd /path/to/project

# Load environment
source .env  # or export variables manually

# Run seeder
npm run seed:questions
```

**Expected output:**
```
Starting question seeding...
Loaded 100+ A2 questions
Complete! Success: 100+, Errors: 0
```

**Verify in database:**
```sql
SELECT count(*) FROM questions;
-- Should return 100+

SELECT rank_tier, count(*) 
FROM questions 
GROUP BY rank_tier 
ORDER BY rank_tier;
-- Should show Bronze, Silver, Gold, etc.
```

---

## Step 4: Deploy Edge Function

```bash
# Check if game-ws is deployed
# In Supabase Dashboard:
# Edge Functions → game-ws → Should show "Deployed"

# If not deployed or needs update:
supabase functions deploy game-ws
```

**Verify deployment:**
- Check logs for startup errors
- Status should be "healthy"

---

## Step 5: Build Client

```bash
npm run build
```

**Expected:**
```
✓ built in 10-15s
```

If errors, fix TypeScript issues before proceeding.

---

## Step 6: Start Dev Server

```bash
npm run dev
```

**Expected:**
```
VITE ready in 500ms
Local: http://localhost:5173
```

---

## Step 7: Test Match Flow

### Setup: Two Browser Windows

**Window 1 (Player 1):**
1. Navigate to `http://localhost:5173`
2. Login or create account
3. Join queue (click "Battle" or similar)
4. **Copy the match ID from URL** when match is created
5. Open browser console (F12)

**Window 2 (Player 2):**
1. Open incognito/private window
2. Navigate to `http://localhost:5173`
3. Login with different account
4. Manually navigate to `/battle/[MATCH_ID]` (paste match ID from Player 1)
5. Open browser console (F12)

### Expected Console Logs

**Both players should see:**
```
WS: Connecting to game-ws for match [id]
WS: Connected successfully
WS: Connection confirmed as player p1 (or p2)
WS: Sent ready signal
WS: Player ready: p1
WS: Player ready: p2
WS: Game started
WS: Game starting with question!
```

### Expected UI Behavior

1. **Countdown Screen**: Shows "3... 2... 1... START!"
2. **Battle Screen**: Shows:
   - Question title
   - Current question step text
   - 4 answer options (A, B, C, D)
   - Score display (both players)
   - Tug of war bar
3. **Answer Submission**:
   - Click an option
   - Toast appears: "Correct! +1 marks" or "Incorrect answer"
   - Score updates
   - Next step appears (or next question if all steps done)
4. **Match End** (after 5 questions):
   - Victory/Defeat screen
   - Final scores shown
   - ELO changes displayed

---

## Troubleshooting

### Issue: "Failed to load questions"

**Check:**
```sql
SELECT count(*) FROM questions;
```

**If 0:**
```bash
npm run seed:questions
```

---

### Issue: Both players stuck at "Battle System Active"

**Possible causes:**
1. Only one player connected (need both)
2. Database has no questions
3. RPC error on server

**Debug:**
1. Check Supabase Edge Functions logs (game-ws)
2. Look for error: "No questions available" or "Error fetching question"
3. Check both players sent ready (console should show "WS: Sent ready signal")

---

### Issue: Questions don't appear after countdown

**Check console for:**
```
WS: Game starting with question!
```

If you see this but no question renders, check the event payload:

Add this temporarily to `OnlineBattle.tsx` line 135:
```typescript
console.log('FULL EVENT:', JSON.stringify(event, null, 2));
```

Event should contain:
```json
{
  "type": "game_start",
  "question": { 
    "id": "...",
    "steps": [...]
  },
  "ordinal": 1,
  "total_questions": 5
}
```

If `question` is null, check server logs for RPC errors.

---

### Issue: Answers don't submit

**Check console when clicking option:**
```
WS: Submitted answer for question [id], step [step-id]
```

If missing:
- Verify step has an `id` field
- Check `currentStep.id` is not undefined

---

### Issue: WebSocket connection fails

**Check:**
1. Edge function deployed: Supabase Dashboard → Edge Functions
2. Function logs: Look for crashes or errors
3. VITE_SUPABASE_URL is correct
4. Network tab: WebSocket connection shows as "101 Switching Protocols"

---

## Success Criteria

✅ Two players can connect to same match
✅ Both see countdown
✅ Question appears with title and options
✅ Clicking answer shows correct/incorrect
✅ Scores update in real-time
✅ Next question appears automatically
✅ Match ends after 5 questions
✅ Winner declared with ELO changes

---

## Next Steps After MVP Works

Once basic flow is confirmed:

1. **Add more questions**: Run template generator for A1, All-Maths
2. **Queue filters**: Capture subject/chapter/rank on enqueue
3. **Chapter selection**: Add UI for choosing specific chapters
4. **Analytics**: Track question usage and player performance
5. **Admin tools**: Content management dashboard

---

## Emergency Rollback

If completely broken:

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Revert client changes (if needed)
git checkout HEAD~1 src/lib/ws.ts src/components/OnlineBattle.tsx

# 3. Rebuild
npm run build

# 4. Check older migration (only if DB is corrupted)
# Supabase Dashboard → Database → Migrations → Revert

# 5. Restart
npm run dev
```

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-15  
**Status:** Ready for QA Testing
