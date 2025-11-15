# Quick Diagnostic Checklist

Before testing a match, verify these in order:

## 1. Database Has Questions

```sql
-- Run in Supabase SQL Editor
SELECT count(*) as total_questions FROM questions;

-- Should return at least 5-10 questions
-- If 0, run: npm run seed:questions
```

## 2. Migration Applied

```sql
-- Check if RPCs exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('pick_next_question_v2', 'submit_answer');

-- Should return 2 rows
-- If empty, migration hasn't run
```

## 3. WebSocket Function Deployed

Check Supabase Dashboard → Edge Functions → game-ws
- Should show "deployed" status
- Check logs for any startup errors

## 4. Client Build Success

```bash
npm run build
# Should complete without TypeScript errors
```

## 5. Test Match Flow

### Open Browser Console

**Player 1:**
```
1. Join queue
2. Match created
3. Open /battle/[match-id]
4. Check console for:
   ✓ "WS: Connecting to game-ws"
   ✓ "WS: Connected successfully"
   ✓ "WS: Connection confirmed as player p1"
   ✓ "WS: Sent ready signal"
```

**Player 2:**
```
1. Join queue  
2. Navigate to same match
3. Check console for same messages (as p2)
4. Both players should see:
   ✓ "WS: Player ready: p1"
   ✓ "WS: Player ready: p2"
   ✓ "WS: Game started"
   ✓ "WS: Game starting with question!"
```

## Common Issues

### "Failed to load questions"
- **Cause**: Database has no questions or RPC failed
- **Fix**: Run `npm run seed:questions`
- **Verify**: `SELECT count(*) FROM questions;`

### "WebSocket connection error"
- **Cause**: Edge function not deployed or crashed
- **Fix**: Check Supabase Dashboard → Edge Functions → game-ws logs
- **Verify**: Function shows recent invocations

### "Battle System Active" stuck
- **Cause**: Client not receiving `game_start` event
- **Fix**: Check if both players sent ready (need 2 players)
- **Debug**: Add `console.log` in onGameStart handler

### Questions don't appear
- **Cause**: `event.question` is null or undefined
- **Fix**: Check server logs for RPC errors
- **Debug**: Log the full event object in onGameStart

### "Invalid message format" in console
- **Cause**: Client/server message format mismatch
- **Fix**: Verify AnswerSubmitMessage includes step_id
- **Check**: This should be fixed now

## Quick Server Log Check

In Supabase Dashboard:
1. Go to Edge Functions → game-ws
2. Click "Logs" 
3. Filter for errors
4. Look for:
   - "Error fetching question"
   - "No questions available"
   - "Error grading answer"

## Emergency Fallback

If nothing works:

```bash
# 1. Verify environment
echo $VITE_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# 2. Check migration status
psql $DATABASE_URL -c "\df pick_next_question_v2"

# 3. Force re-seed
npm run seed:questions

# 4. Rebuild
npm run build

# 5. Clear browser cache and retry
```

## Success Indicators

When everything works:
- ✅ Both players see countdown (3, 2, 1, START!)
- ✅ Question appears with options
- ✅ Clicking answer shows correct/incorrect toast
- ✅ Score updates in real-time
- ✅ Next question appears automatically
- ✅ After 5 questions, match ends with winner

## Report Issue Template

If still broken, share:
1. Output of `SELECT count(*) FROM questions;`
2. Browser console logs (both players)
3. Supabase Edge Function logs (game-ws)
4. Screenshot of stuck state
5. Match ID from URL
