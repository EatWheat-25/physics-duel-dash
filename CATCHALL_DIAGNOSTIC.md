# Catch-All Diagnostic Listener - Both Clients Enter Match

## Problem

Rare cases where one client navigates to battle while the other stays on "Searching for opponent...". Need to diagnose whether:
1. Filtered Realtime subscriptions are missing INSERTs
2. Column name mismatches in filters
3. RLS policies blocking notifications
4. Timing issues in subscribe-await flow

## Solution: Temporary Catch-All Listener

Added a **5-second unfiltered subscription** that logs every INSERT on `matches_new` table, regardless of player. This diagnoses:
- Whether INSERTs are reaching the client at all
- Whether the filtered subscriptions are working correctly
- Whether column names in filters match the schema

### Implementation

#### src/hooks/useMatchmaking.ts

**Added after subscribe-await, before enqueue:**

```typescript
console.log('CATCHALL: Starting 5s catch-all listener');
const catchAll = supabase
  .channel(`match-catchall-${user.id}-${Date.now()}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'matches_new',
      // NO FILTER - catches ALL inserts
    },
    (payload: any) => {
      const row = payload.new || payload.record || {};
      const uid = user.id;
      // Try all possible column name variants
      const p1 = row.player1_id ?? row.p1_id ?? row.p1;
      const p2 = row.player2_id ?? row.p2_id ?? row.p2;
      console.log('CATCHALL INSERT:', row.id, { p1, p2, uid, fullRow: row });

      if (uid && (uid === p1 || uid === p2)) {
        console.log('CATCHALL: Match found for this user, navigating');
        handleInsert(row);
      } else {
        console.log('CATCHALL: Match not for this user, ignoring');
      }
    }
  )
  .subscribe((status) => {
    console.log('CATCHALL status:', status);
  });

catchAllChannelRef.current = catchAll;

// Auto-remove after 5s or when match found
setTimeout(() => {
  console.log('CATCHALL: 5s timeout, removing catch-all listener');
  if (catchAllChannelRef.current) {
    supabase.removeChannel(catchAllChannelRef.current);
    catchAllChannelRef.current = null;
  }
}, 5000);
```

**Also added detailed filter logging:**

```typescript
console.log('SUBSCRIBE: Starting for user', userId);
console.log('SUBSCRIBE filters:', `${P1_COL}=eq.${userId}`, `${P2_COL}=eq.${userId}`);
```

**And enhanced payload logging:**

```typescript
.on('postgres_changes', { filter: `${P1_COL}=eq.${userId}` }, (payload) => {
  console.log('SUBSCRIBE: INSERT event (p1 filter)', payload.new);
  handleInsert(payload.new);
})
```

### Schema Verification (SQL)

**Ran these queries:**

```sql
-- Column names
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='matches_new'
ORDER BY ordinal_position;
```

**Result:**
```
id, p1, p2, subject, chapter, state, p1_score, p2_score, winner_id, created_at, ended_at
```

✅ **Confirmed: Columns are `p1` and `p2` (not `player1_id` or `p1_id`)**

```sql
-- Realtime publication
SELECT * FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename='matches_new';
```

**Result:**
```
pubname: supabase_realtime
schemaname: public
tablename: matches_new
attnames: {id,p1,p2,subject,chapter,state,p1_score,p2_score,winner_id,created_at,ended_at}
rowfilter: null
```

✅ **Realtime enabled for all columns, no row filter**

```sql
-- RLS policies
SELECT policyname, cmd, qual FROM pg_policies
WHERE schemaname='public' AND tablename='matches_new';
```

**Result:**
```
policyname: Service role can manage matches
cmd: ALL
qual: true

policyname: matches_new_select_self
cmd: SELECT
qual: ((p1 = auth.uid()) OR (p2 = auth.uid()))
```

✅ **RLS policy allows SELECT for users in match (p1 or p2)**

## Expected Console Logs

### Browser A (First in Queue)

```
QUEUE: Joining queue for math/A1-Only
SUBSCRIBE: Starting for user <uuid-A>
SUBSCRIBE filters: p1=eq.<uuid-A> p2=eq.<uuid-A>
SUBSCRIBE: SUBSCRIBED
SUBSCRIBE: ready
CATCHALL: Starting 5s catch-all listener
CATCHALL status: SUBSCRIBED
ENQUEUE: sending
ENQUEUE: response received { matched: false }
REHYDRATE: burst poll complete
HB: tick ok
[Browser B joins]
CATCHALL INSERT: <match-uuid> { p1: '<uuid-A>', p2: '<uuid-B>', uid: '<uuid-A>', fullRow: {...} }
CATCHALL: Match found for this user, navigating
REALTIME: INSERT seen matchId=<match-uuid>
QUEUE: Cleaning up matchmaking resources
[OR]
SUBSCRIBE: INSERT event (p1 filter) { id: '<match-uuid>', p1: '<uuid-A>', p2: '<uuid-B>', ... }
REALTIME: INSERT seen matchId=<match-uuid>
QUEUE: Cleaning up matchmaking resources
CATCHALL: 5s timeout, removing catch-all listener
```

### Browser B (Second in Queue - Instant Match)

```
QUEUE: Joining queue for math/A1-Only
SUBSCRIBE: Starting for user <uuid-B>
SUBSCRIBE filters: p1=eq.<uuid-B> p2=eq.<uuid-B>
SUBSCRIBE: SUBSCRIBED
SUBSCRIBE: ready
CATCHALL: Starting 5s catch-all listener
CATCHALL status: SUBSCRIBED
ENQUEUE: sending
ENQUEUE: response received { matched: true, match: {...} }
ENQUEUE: matched <match-uuid>
REALTIME: INSERT seen matchId=<match-uuid>
QUEUE: Cleaning up matchmaking resources
CATCHALL: 5s timeout, removing catch-all listener
```

## Diagnostic Scenarios

### Scenario 1: Filtered Subscription Works (Expected)

**Browser A logs:**
```
SUBSCRIBE: INSERT event (p1 filter) { ... }
REALTIME: INSERT seen matchId=...
```

**Diagnosis:** ✅ Filtered subscriptions working correctly, catch-all not needed

**Action:** Remove catch-all listener after confirming test passes

### Scenario 2: Only Catch-All Fires (Column Mismatch)

**Browser A logs:**
```
CATCHALL INSERT: <match-uuid> { p1: '<uuid-A>', p2: '<uuid-B>', ... }
CATCHALL: Match found for this user, navigating
[NO "SUBSCRIBE: INSERT event" log]
```

**Diagnosis:** ❌ Filtered subscriptions not firing due to column name mismatch

**Action:** Update constants in useMatchmaking.ts:
```typescript
const P1_COL = 'player1_id';  // or whatever CATCHALL log shows
const P2_COL = 'player2_id';
```

### Scenario 3: Nothing Fires (Realtime Not Working)

**Browser A logs:**
```
CATCHALL status: SUBSCRIBED
ENQUEUE: response received { matched: false }
REHYDRATE: found matchId=...  ← Only rehydrate catches it
[NO "CATCHALL INSERT" or "SUBSCRIBE: INSERT event"]
```

**Diagnosis:** ❌ Realtime notifications not reaching client at all

**Action:** Check:
1. Supabase Dashboard → Database → Publications (verify matches_new included)
2. Network tab (WebSocket connection to realtime-v2)
3. Supabase project status (outage?)

### Scenario 4: Catch-All Sees Other Matches (Not Yours)

**Browser A logs:**
```
CATCHALL INSERT: <match-uuid-2> { p1: '<other-user-1>', p2: '<other-user-2>', uid: '<uuid-A>', fullRow: {...} }
CATCHALL: Match not for this user, ignoring
[Then later...]
SUBSCRIBE: INSERT event (p1 filter) { id: '<match-uuid>', p1: '<uuid-A>', ... }
REALTIME: INSERT seen matchId=<match-uuid>
```

**Diagnosis:** ✅ Catch-all working correctly, filtered subscription also working

**Action:** Remove catch-all listener (working as intended)

## Two-Browser Acceptance Test

### Test A: Instant Match (Second Joins Waiting First)

**Setup:**
```bash
npm run dev
```

**Steps:**
1. Browser A: Sign in → Queue → Select "A1-Only" → "Start Battle"
2. Browser A: See "Finding opponent..." + console logs
3. Browser B (incognito): Sign in → Queue → Select "A1-Only" → "Start Battle"

**Expected Logs:**

**Browser A:**
```
SUBSCRIBE filters: p1=eq.<uuid-A> p2=eq.<uuid-A>
CATCHALL: Starting 5s catch-all listener
ENQUEUE: sending
ENQUEUE: response received { matched: false }
[Browser B joins]
CATCHALL INSERT: <match-uuid> { p1: '<uuid-A>', p2: '<uuid-B>', ... }
SUBSCRIBE: INSERT event (p1 filter) { id: '<match-uuid>', ... }
REALTIME: INSERT seen matchId=<match-uuid>
```

**Browser B:**
```
SUBSCRIBE filters: p1=eq.<uuid-B> p2=eq.<uuid-B>
CATCHALL: Starting 5s catch-all listener
ENQUEUE: sending
ENQUEUE: response received { matched: true, match: {...} }
ENQUEUE: matched <match-uuid>
REALTIME: INSERT seen matchId=<match-uuid>
```

**Acceptance Criteria:**
- ✅ Both browsers navigate to `/battle/<match-uuid>` within ≤500ms
- ✅ Both consoles show either:
  - `ENQUEUE: matched`, OR
  - `SUBSCRIBE: INSERT event`, OR
  - `CATCHALL INSERT: ... navigating`
- ✅ No "Searching for opponent..." stuck state

### Test B: Cron Match (Both Queue Within 1s)

**Steps:**
1. Browser A: Queue → "Start Battle"
2. Wait 0.5s
3. Browser B: Queue → "Start Battle"
4. Both wait for cron (2s interval)

**Expected Logs:**

**Both browsers:**
```
SUBSCRIBE filters: p1=eq.<uuid> p2=eq.<uuid>
CATCHALL: Starting 5s catch-all listener
ENQUEUE: sending
ENQUEUE: response received { matched: false }
[2s later, cron creates match]
CATCHALL INSERT: <match-uuid> { p1: '<uuid-A>', p2: '<uuid-B>', ... }
SUBSCRIBE: INSERT event (p1/p2 filter) { id: '<match-uuid>', ... }
REALTIME: INSERT seen matchId=<match-uuid>
```

**Acceptance Criteria:**
- ✅ Both navigate within ≤2 seconds after second player queues
- ✅ Both see CATCHALL and/or SUBSCRIBE logs

### Test C: Cancel Cleanup

**Steps:**
1. Browser A: "Start Battle"
2. Wait 2s
3. Browser A: "Cancel Search"

**Expected Logs:**
```
SUBSCRIBE filters: p1=eq.<uuid-A> p2=eq.<uuid-A>
CATCHALL: Starting 5s catch-all listener
ENQUEUE: sending
ENQUEUE: response received { matched: false }
HB: tick ok
QUEUE: Leaving queue
QUEUE: Cleaning up matchmaking resources
CATCHALL: 5s timeout, removing catch-all listener
[No more logs]
```

**Acceptance Criteria:**
- ✅ Catch-all removed after 5s or on cleanup
- ✅ No duplicate subscriptions
- ✅ Can queue again without issues

## Build Verification

```bash
npm run build
✓ 2253 modules transformed
✓ built in 10.33s
dist/index-Dbr6wR51.js   900.34 kB
```

✅ No TypeScript errors

## Cleanup After Testing

**If filtered subscriptions work correctly (Scenario 1):**

Remove the catch-all listener code from `joinQueue()`:

```typescript
// Delete these lines:
console.log('CATCHALL: Starting 5s catch-all listener');
const catchAll = supabase.channel(...).on(...).subscribe(...);
catchAllChannelRef.current = catchAll;
setTimeout(() => { ... }, 5000);
```

**If catch-all is needed (Scenario 2):**

Fix the column constants and keep catch-all temporarily:

```typescript
const P1_COL = 'player1_id';  // Based on CATCHALL log output
const P2_COL = 'player2_id';
```

Then retest and remove catch-all once filtered subscriptions work.

## Summary

**Changes Made:**

1. ✅ Added 5s catch-all listener (no filter) to diagnose missing INSERTs
2. ✅ Added detailed filter logging: `SUBSCRIBE filters: p1=eq.<uuid> p2=eq.<uuid>`
3. ✅ Enhanced payload logging: `SUBSCRIBE: INSERT event (p1 filter) { fullRow }`
4. ✅ Auto-cleanup catch-all after 5s or on match found
5. ✅ Verified schema: `p1` and `p2` columns (not `player1_id`)
6. ✅ Verified Realtime publication and RLS policies

**Diagnostic Flow:**

```
User clicks "Start Battle"
  ↓
Subscribe with filters (p1/p2)
  ↓
Start catch-all (no filter) for 5s
  ↓
Call enqueue
  ↓
Wait for match...
  ↓
EITHER:
  - Filtered subscription fires → ✅ Working correctly
  - Only catch-all fires → ❌ Column mismatch, fix constants
  - Nothing fires → ❌ Realtime broken, check config
  - Rehydrate catches it → ⚠️ Realtime delayed, but fallback works
```

**Expected Outcome:**

Both browsers log one of:
- `ENQUEUE: matched` (instant match from API)
- `SUBSCRIBE: INSERT event` (filtered subscription)
- `CATCHALL INSERT: ... navigating` (catch-all fallback)
- `REHYDRATE: found` (polling fallback)

No client stays on "Searching for opponent..." with proper logging to diagnose any issues.
