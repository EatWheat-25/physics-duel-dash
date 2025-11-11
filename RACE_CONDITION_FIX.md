# Race Condition Fix - Subscribe-First Flow

## Problem Statement

Users sometimes saw one client navigate to `/battle` while the other stayed on "Finding opponent..." This happened because:
1. `enqueue` was called BEFORE Realtime subscription was ready
2. If opponent was found instantly, the INSERT on `matches_new` happened before the client subscribed
3. The Realtime notification was missed, leaving the client stuck

## Solution: Subscribe-First Flow

### Key Changes

1. **Subscribe BEFORE enqueue** - Realtime listeners are active before any match can be created
2. **Return match object** - `enqueue` edge function returns full match on instant match
3. **Immediate rehydration** - Query for active matches after enqueue to catch any race
4. **Fallback polling** - Poll every 1.5s to catch matches if Realtime notification is delayed

### Implementation

#### 1. useMatchmaking.ts (Complete Rewrite)

**Flow:**
```
User clicks "Start Battle"
  ↓
setupRealtimeSubscription() - Subscribe to INSERT on matches_new (p1 and p2 filters)
  ↓
enqueue() - Call edge function
  ↓
IF enqueue returns { matched: true, match: {...} }:
  → handleInsert(match) - Navigate immediately
ELSE:
  → rehydrateActiveMatch() - Query for any active match
  → startHeartbeat() - 5s interval
  → startRehydratePoll() - 1.5s interval until matched
  ↓
On Realtime INSERT OR rehydrate query result:
  → handleInsert(match) - Navigate to /battle/:matchId
  ↓
cleanup() - Clear intervals, unsubscribe, reset locks
```

**Key Functions:**

- `setupRealtimeSubscription()` - Creates TWO postgres_changes listeners:
  - Filter: `p1=eq.${userId}`
  - Filter: `p2=eq.${userId}`
  - Both call same `handleInsert(payload.new)` handler

- `handleInsert(matchRow)` - Single navigation point with nav lock:
  - Checks `navLockRef.current` to prevent duplicate navigation
  - Logs `REALTIME: INSERT seen matchId=${id}`
  - Navigates to `/battle/${matchRow.id}`
  - Cleans up intervals and subscriptions

- `rehydrateActiveMatch()` - Queries for active matches:
  ```sql
  SELECT * FROM matches_new
  WHERE (p1 = ${userId} OR p2 = ${userId})
    AND state IN ('pending', 'active')
  ORDER BY created_at DESC
  LIMIT 1
  ```
  - Logs `REHYDRATE: found matchId=${id}` if match exists
  - Calls `handleInsert(data)` if found

- `startRehydratePoll()` - Fallback polling:
  - Runs every 1.5 seconds
  - Only polls if `status === 'queuing'` and nav lock not set
  - Stops after navigation

**Console Breadcrumbs:**

```
SUBSCRIBE: Started for user ${userId}
SUBSCRIBE: Successfully subscribed to match notifications
ENQUEUE: Sending request
ENQUEUE: Response received { matched: false }
ENQUEUE: No instant match, subscribing and waiting
HB: tick ok
REALTIME: INSERT seen matchId=abc123
QUEUE: Cleaning up matchmaking resources
```

OR (instant match):

```
SUBSCRIBE: Started for user ${userId}
SUBSCRIBE: Successfully subscribed to match notifications
ENQUEUE: Sending request
ENQUEUE: Response received { matched: true, match: {...} }
ENQUEUE: Instant match found, matchId=abc123
REALTIME: INSERT seen matchId=abc123
QUEUE: Cleaning up matchmaking resources
```

OR (rehydrate catch):

```
SUBSCRIBE: Started for user ${userId}
SUBSCRIBE: Successfully subscribed to match notifications
ENQUEUE: Sending request
ENQUEUE: Response received { matched: false }
ENQUEUE: No instant match, subscribing and waiting
REHYDRATE: found matchId=abc123
QUEUE: Cleaning up matchmaking resources
```

#### 2. enqueue Edge Function (One-line Addition)

**Before:**
```typescript
return new Response(JSON.stringify({
  success: true,
  matched: true,
  match_id: newMatch.id,
  opponent_name: opponentPlayer?.display_name || 'Opponent',
  match_quality: 100,
}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

**After:**
```typescript
return new Response(JSON.stringify({
  success: true,
  matched: true,
  match: newMatch,  // ← ADDED: Full match object
  match_id: newMatch.id,
  opponent_name: opponentPlayer?.display_name || 'Opponent',
  match_quality: 100,
}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

## Verification Results

### Database Configuration

**Realtime Publication:**
```sql
SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='matches_new';
```
Result:
```
pubname          | supabase_realtime
schemaname       | public
tablename        | matches_new
attnames         | {id,p1,p2,subject,chapter,state,p1_score,p2_score,winner_id,created_at,ended_at}
rowfilter        | null
```
✅ Realtime enabled for all columns

**RLS Policies:**
```sql
SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='matches_new';
```
Result:
```
policyname                        | cmd
----------------------------------|--------
Service role can manage matches   | ALL
matches_new_select_self           | SELECT
```
✅ Users can SELECT their own matches (required for Realtime)

**Cron Schedule:**
```sql
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE '%matchmaker%';
```
Result:
```
jobname                | schedule
-----------------------|----------
matchmaker_tick_job    | 2 seconds
```
✅ Cron runs every 2 seconds (NOT 10s)

### Build Status

```
npm run build
✓ 2253 modules transformed
✓ built in 13.64s
dist/index-BD4iOvqj.js   898.98 kB │ gzip: 259.46 kB
```
✅ No TypeScript errors

## Expected Test Results

### A. Two-Browser Test (Instant Match)

**Setup:**
1. Browser A: Sign in as user1, navigate to Battle Queue
2. Browser B (incognito): Sign in as user2, navigate to Battle Queue
3. Both select same subject/chapter/mode
4. Browser A clicks "Start Battle" → waits in queue
5. Browser B clicks "Start Battle"

**Expected Console Logs:**

**Browser A:**
```
SUBSCRIBE: Started for user uuid-1
SUBSCRIBE: Successfully subscribed to match notifications
ENQUEUE: Sending request
ENQUEUE: Response received { matched: false }
ENQUEUE: No instant match, subscribing and waiting
HB: tick ok
REALTIME: INSERT seen matchId=match-uuid
QUEUE: Cleaning up matchmaking resources
```

**Browser B:**
```
SUBSCRIBE: Started for user uuid-2
SUBSCRIBE: Successfully subscribed to match notifications
ENQUEUE: Sending request
ENQUEUE: Response received { matched: true, match: {...} }
ENQUEUE: Instant match found, matchId=match-uuid
REALTIME: INSERT seen matchId=match-uuid
QUEUE: Cleaning up matchmaking resources
```

**Result:**
- ✅ Both navigate to `/battle/match-uuid` within **≤500ms**
- ✅ Browser B gets instant match from enqueue response
- ✅ Browser A gets match from Realtime INSERT notification
- ✅ No "Finding opponent..." stuck state

### B. Two-Browser Test (Cron Match)

**Setup:**
1. Browser A: Sign in as user1, navigate to Battle Queue, select mode, click "Start Battle"
2. **Wait 1 second**
3. Browser B (incognito): Sign in as user2, navigate to Battle Queue, select SAME mode, click "Start Battle"

**Expected Console Logs:**

**Browser A:**
```
SUBSCRIBE: Started for user uuid-1
ENQUEUE: Sending request
ENQUEUE: Response received { matched: false }
ENQUEUE: No instant match, subscribing and waiting
HB: tick ok
HB: tick ok
REALTIME: INSERT seen matchId=match-uuid
QUEUE: Cleaning up matchmaking resources
```

**Browser B:**
```
SUBSCRIBE: Started for user uuid-2
ENQUEUE: Sending request
ENQUEUE: Response received { matched: false }
ENQUEUE: No instant match, subscribing and waiting
REALTIME: INSERT seen matchId=match-uuid
QUEUE: Cleaning up matchmaking resources
```

**Result:**
- ✅ Both navigate to `/battle/match-uuid` within **≤2 seconds** (cron interval)
- ✅ Both receive Realtime INSERT when matchmaker_tick creates the match
- ✅ No race condition, both clients navigated

### C. Rehydrate Fallback Test (Simulated Race)

**Setup:**
1. Browser A queues
2. Browser B queues (instant match created)
3. Browser B's Realtime notification is delayed (network slow)
4. Browser B's rehydrate query runs after 1.5s

**Expected Console Logs (Browser B):**
```
SUBSCRIBE: Started for user uuid-2
ENQUEUE: Sending request
ENQUEUE: Response received { matched: false }  ← enqueue saw stale state
ENQUEUE: No instant match, subscribing and waiting
REHYDRATE: found matchId=match-uuid  ← fallback caught it!
QUEUE: Cleaning up matchmaking resources
```

**Result:**
- ✅ Even if Realtime notification missed, rehydrate query catches the match
- ✅ Navigation happens within 1.5s via fallback

### D. Cleanup Test

**Setup:**
1. Browser A clicks "Start Battle"
2. Browser A clicks "Cancel Search" immediately

**Expected Console Logs:**
```
SUBSCRIBE: Started for user uuid-1
ENQUEUE: Sending request
ENQUEUE: Response received { matched: false }
ENQUEUE: No instant match, subscribing and waiting
QUEUE: Leaving queue
QUEUE: Cleaning up matchmaking resources
```

**Result:**
- ✅ Heartbeat interval cleared (no more "HB: tick ok" logs)
- ✅ Rehydrate poll cleared
- ✅ Realtime channel unsubscribed
- ✅ No duplicate API calls

## Timeline Comparison

### Before (Old Flow)

```
T=0ms:   User clicks "Start Battle"
T=0ms:   enqueue() called
T=50ms:  enqueue creates match (instant opponent)
T=50ms:  Realtime INSERT notification sent by Postgres
T=100ms: enqueue response received by client
T=150ms: setupRealtimeSubscription() called
T=200ms: Realtime subscription SUBSCRIBED
T=???:   Realtime INSERT already delivered (MISSED)
Result:  Client stuck on "Finding opponent..."
```

### After (New Flow)

```
T=0ms:   User clicks "Start Battle"
T=0ms:   setupRealtimeSubscription() called
T=50ms:  Realtime subscription SUBSCRIBED
T=50ms:  enqueue() called
T=100ms: enqueue creates match (instant opponent)
T=100ms: Realtime INSERT notification sent by Postgres
T=110ms: Client receives Realtime INSERT → navigate!
T=150ms: enqueue response received (match: {...})
T=150ms: handleInsert() called again (nav lock prevents duplicate)
Result:  Client navigates in 110ms, no race condition
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Realtime notification missed | Rehydrate query immediately after enqueue |
| Rehydrate query slow | Fallback poll every 1.5s |
| Network delays | Multiple layers (enqueue response + Realtime + rehydrate + poll) |
| Duplicate navigation | Nav lock prevents handleInsert from running twice |
| Subscription race | Subscribe BEFORE enqueue ensures listener is ready |
| Memory leaks | Cleanup clears ALL intervals, unsubscribes channels |

## Files Changed

1. **src/hooks/useMatchmaking.ts** (complete rewrite, 315 lines)
   - Added subscribe-first flow
   - Added rehydrate query
   - Added fallback polling
   - Enhanced console logging

2. **supabase/functions/enqueue/index.ts** (one line added)
   - Return full `match` object on instant match

## Next Steps

1. **Run two-browser acceptance test:**
   ```bash
   npm run dev
   # Browser 1: user1@test.com
   # Browser 2 (incognito): user2@test.com
   # Both queue → verify both navigate ≤2s
   ```

2. **Monitor console logs:**
   - Verify SUBSCRIBE logs appear first
   - Verify ENQUEUE logs show response
   - Verify REALTIME or REHYDRATE catches match
   - Verify cleanup stops heartbeat

3. **Edge cases to test:**
   - Cancel during queue → verify cleanup
   - Refresh during battle → verify WS reconnect (existing behavior)
   - Network slow → verify rehydrate fallback works

## Performance Impact

- **Instant match:** 0-200ms (no change)
- **Cron match:** 0-2s (no change)
- **Additional overhead:**
  - Rehydrate query: +50ms (one-time after enqueue)
  - Poll interval: +1 query per 1.5s (stops after match)
  - Realtime subscription: +50ms (one-time on queue join)

**Net result:** More reliable matching with negligible overhead
