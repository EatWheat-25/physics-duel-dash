# Testing Guide: 1v1 Matchmaking Fix

## Quick Test (2 Browser Windows)

### Test 1: Instant Match
1. Open two browser windows side by side
2. Log in as different users in each (or use incognito for second)
3. In Window 1: Navigate to `/battle/queue?subject=math`
4. Select mode "A1-Only Mode"
5. Click "Start Battle"
6. In Window 2: Do the same immediately
7. **Expected**: Both windows navigate to battle page and game starts within 1-2 seconds

### Test 2: Delayed Match
1. Window 1: Join queue and wait
2. Wait 10 seconds
3. Window 2: Join queue with same subject/mode
4. **Expected**: Within 5-10 seconds, matchmaker_tick runs and both get matched

### Test 3: Self-Play (Testing/Dev)
1. Use the dev database test page to create a self-play match
2. Navigate to the match
3. **Expected**: Game starts with both players as yourself

## What to Check

### ✅ Success Indicators
- Both players see "Match found! Starting battle..." toast
- Both navigate to `/online-battle/{matchId}`
- Battle page transitions from "Connecting..." to showing question
- Question text is visible
- Timer counts down from 60 seconds
- Four answer options (A, B, C, D) are clickable
- Tug-of-war bar is visible at top

### ❌ Failure Indicators
- Stuck on "Waiting for match to start..." forever
- No question appears
- Timer doesn't start
- Console shows WebSocket errors

## Debug Checklist

If the game doesn't start, check in this order:

### 1. Match Creation
**Check**: Supabase logs for enqueue function
**Look for**:
```
✅ Instant match created: {matchId} (state: pending)
   P1: {userId}
   P2: {opponentId}
```

**If not found**: Issue with queue joining

### 2. Notifications
**Check**: Supabase table `match_notifications`
**Query**:
```sql
SELECT * FROM match_notifications
WHERE created_at > now() - interval '5 minutes'
ORDER BY created_at DESC;
```

**Expected**: 2 rows (one for each player) with the same match_id

**If not found**: Trigger not firing or RPC not creating notifications

### 3. Frontend Navigation
**Check**: Browser console in both windows
**Look for**:
```
QUEUE: matched
MN INSERT: notification received
```

**If not found**: Frontend not receiving notifications

### 4. WebSocket Connection
**Check**: Supabase logs for game-ws function
**Look for**:
```
[matchId] ========================================
[matchId] WebSocket connection request from user {userId}
[matchId] Match state: {state: 'pending', ...}
[matchId] User is P1
[matchId] ✅ P1 socket assigned (was null: true)
[matchId] Connection status: P1=true, P2=false
```

Then for second player:
```
[matchId] User is P2
[matchId] ✅ P2 socket assigned (was null: true)
[matchId] Connection status: P1=true, P2=true
```

**If not found**: WebSocket connection failing

### 5. Auto-Start
**Check**: game-ws logs (continue from above)
**Look for**:
```
[matchId] [AUTO-START] Checking start conditions:
  p1Connected: true
  p2Connected: true
  gameActive: false
  bothConnected: true
  notStarted: true
[matchId] ✅ Both players connected, auto-starting match
[matchId] 🎮 Starting first round
```

**If not found**: Auto-start logic not triggering

### 6. ROUND_START Sent
**Check**: game-ws logs (continue from above)
**Look for**:
```
[matchId] ✅ Question loaded from questions_v2:
  id: {questionId}
  title: {title}
  stepsCount: 3
[matchId] ✅ ROUND_START message sent:
  sentToP1: true
  sentToP2: true
  messageSize: 1234
```

**If not found**: Question loading failed or message not sent

### 7. Frontend Receives ROUND_START
**Check**: Browser console
**Look for**:
```
[Battle] Processing WS message: ROUND_START
[CONTRACT] ROUND_START - Raw payload: {question}
[CONTRACT] ✅ Mapped to StepBasedQuestion: {id, title, stepsCount}
```

**If not found**: Frontend not receiving or processing message

## Common Issues & Solutions

### Issue: "No questions available"
**Solution**: Run `npm run seed:test-v2` to seed questions

### Issue: WebSocket connects but auto-start doesn't trigger
**Cause**: Match state is 'active' instead of 'pending'
**Solution**: Migration already applied, but old matches in DB might be 'active'
**Fix**: Clear old matches or manually update:
```sql
UPDATE matches_new SET state = 'pending' WHERE state = 'active' AND ended_at IS NULL;
```

### Issue: Only one player gets notification
**Cause**: Trigger or RPC not creating both notifications
**Check**:
```sql
SELECT * FROM match_notifications WHERE match_id = '{matchId}';
```
**Expected**: 2 rows

### Issue: Players navigate to different routes
**Cause**: Routing inconsistency
**Fix**: Already applied, ensure using `/online-battle/{matchId}`

## Success Metrics

After fix, you should see:
- ✅ 100% of matches with both notifications created
- ✅ 100% of matches auto-start within 2 seconds of both connections
- ✅ 0% of matches stuck on "waiting" screen
- ✅ Average time from match creation to ROUND_START: < 3 seconds

## Performance Monitoring

Watch these metrics:
1. **Queue to Match**: Should be < 10 seconds
2. **Match to Navigation**: Should be < 1 second
3. **Navigation to WS Connect**: Should be < 2 seconds
4. **Both WS to ROUND_START**: Should be < 1 second
5. **Total (Queue to Playing)**: Should be < 15 seconds

## Edge Cases to Test

### Edge Case 1: One player disconnects before game starts
**What happens**: Other player sees "Connection Lost" after timeout

### Edge Case 2: Same user in two tabs
**What happens**: Self-play match, should work normally

### Edge Case 3: Player joins queue twice
**What happens**: Second join should be ignored (already in queue)

### Edge Case 4: Match created but no questions in DB
**What happens**: Error message sent to both players

## Rollback Plan

If major issues occur:
1. Revert migration:
   ```sql
   -- Revert to old state (not recommended, better to fix forward)
   ```
2. Revert code changes in Git
3. Redeploy previous version

However, this fix is safer than rollback because:
- ✅ No data loss
- ✅ Backward compatible
- ✅ Only improves existing flow
- ✅ Adds better logging

## Contact for Issues

If you encounter issues after this fix:
1. Capture Supabase function logs
2. Capture browser console logs
3. Note the match_id where it failed
4. Check all 7 debug points above
5. Document which step failed
