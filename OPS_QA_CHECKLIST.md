# Operations & QA Checklist — Instant Matchmaking Release

**Run this checklist before declaring "done" in production.**

---

## 1. Functional Smoke Tests ✅

### A. Basic Matchmaking Flow
- [ ] Open two browsers (one incognito)
- [ ] Sign in as different users
- [ ] Both navigate to Battle Queue → select same subject/mode
- [ ] Both click "Start Battle"
- [ ] **VERIFY:** Both navigate to `/battle/:matchId` within ≤2 seconds
- [ ] **VERIFY:** Console shows "QUEUE: Joined successfully" and "REALTIME: Match INSERT detected"

### B. WebSocket Connection
- [ ] After navigation, check both browsers show "Waiting for players to ready up..."
- [ ] **VERIFY:** Both show green checkmarks when ready
- [ ] **VERIFY:** Countdown "3...2...1...START!" appears
- [ ] **VERIFY:** Timer starts at 5:00
- [ ] **VERIFY:** Scores display (both 0 initially)
- [ ] **VERIFY:** Console shows "WS: Connected" and "WS: Received game_start"

### C. Live Updates
- [ ] Simulate answer submission (if implemented) OR wait for score_update events
- [ ] **VERIFY:** Both browsers see score changes in real-time
- [ ] **VERIFY:** Console shows "WS: Score update - p1: X, p2: Y"

### D. Match End
- [ ] Wait for match to end (or manually trigger match_end via SQL)
- [ ] **VERIFY:** Both browsers show victory/defeat/draw screen
- [ ] **VERIFY:** Final scores display correctly
- [ ] **VERIFY:** Console shows "WS: Match ended"

---

## 2. Resilience Tests ✅

### A. Cancel Search
- [ ] User 1 clicks "Start Battle"
- [ ] User 1 sees "Searching for opponent..."
- [ ] User 1 clicks "Cancel Search"
- [ ] **VERIFY:** Heartbeat stops (no more "QUEUE: Heartbeat OK" logs)
- [ ] **VERIFY:** User can click "Start Battle" again without issues
- [ ] **VERIFY:** No ghost matches created for User 1 later

### B. Active Match Recovery (MANUAL TEST)
- [ ] User 1 and User 2 start a match
- [ ] User 1 refreshes browser on `/battle/:matchId`
- [ ] **VERIFY:** User 1 reconnects to match (NOT IMPLEMENTED YET - should see error or redirect)
- [ ] **NOTE:** Add this to "Next Milestones" - needs active match rehydration

### C. Opponent Disconnect
- [ ] User 1 and User 2 start a match
- [ ] User 2 closes browser tab
- [ ] **VERIFY:** User 1 sees "Opponent disconnected" message
- [ ] **VERIFY:** After 5 seconds, User 1 navigates to home
- [ ] **VERIFY:** Console shows "WS: Opponent disconnected"

### D. Network Interruption
- [ ] User 1 and User 2 start a match
- [ ] User 1: Open DevTools → Network tab → Throttle to "Offline" for 10s
- [ ] **VERIFY:** User 1 sees "Connection lost" toast
- [ ] User 1: Re-enable network
- [ ] **VERIFY:** User 1 reconnects OR sees clear error message

---

## 3. Security Verification ✅

### A. Realtime Publication
Run in Supabase SQL Editor:
```sql
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'matches_new';
```
- [ ] **VERIFY:** Returns 1 row showing `public.matches_new` is in publication

### B. RLS Policy Check
Run in Supabase SQL Editor:
```sql
SELECT * FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'matches_new'
AND policyname = 'matches_new_select_self';
```
- [ ] **VERIFY:** Policy exists with USING clause: `(p1 = auth.uid()) OR (p2 = auth.uid())`

### C. RLS Enforcement Test
- [ ] Sign in as User 1
- [ ] Open DevTools Console
- [ ] Run: `supabase.from('matches_new').select('*')`
- [ ] **VERIFY:** Only returns matches where User 1 is p1 or p2
- [ ] **VERIFY:** Does NOT return matches for other users

### D. Secrets Audit
- [ ] Check `.env` file is in `.gitignore`
- [ ] Run: `git log --all --full-history --source -- **/.env`
- [ ] **VERIFY:** No secrets committed to repo history
- [ ] If secrets found, rotate immediately and commit `.env` removal

---

## 4. Leak Detection ✅

### A. Memory Leaks
- [ ] User 1 queues → cancels → queues → cancels (repeat 10x)
- [ ] Open DevTools → Performance → Take heap snapshot
- [ ] **VERIFY:** No growing array of detached WebSockets or Realtime channels
- [ ] **VERIFY:** Console shows "QUEUE: Cleaning up matchmaking resources" on each cancel

### B. Subscription Leaks
- [ ] User 1 navigates: Home → Queue → Battle → Home (repeat 5x)
- [ ] Check DevTools Console for Supabase channel subscriptions
- [ ] **VERIFY:** No duplicate subscriptions (max 1 active channel per user)
- [ ] **VERIFY:** Console shows unsubscribe logs on navigation away from Queue

### C. Interval/Timer Leaks
- [ ] User 1 starts queue → refreshes page before match found
- [ ] Wait 30 seconds
- [ ] **VERIFY:** No "QUEUE: Heartbeat OK" logs continuing after refresh
- [ ] **VERIFY:** No intervals running in background (check DevTools → Sources → Event Listeners)

---

## 5. Monitoring Setup (Fast Wins) ⚠️

### A. Client Breadcrumbs
Current state: Console logs only

**TODO (Phase 2):**
- [ ] Set up Sentry or LogRocket project
- [ ] Add error tracking to matchmaking hook
- [ ] Add error tracking to WebSocket utility
- [ ] Add user session recording for battle replays

### B. Edge Function Logs
Current state: Available in Supabase Dashboard

**Check now:**
- [ ] Navigate to Supabase Dashboard → Edge Functions → `enqueue`
- [ ] **VERIFY:** See recent invocations with timestamps
- [ ] **VERIFY:** No 500 errors in last 24 hours
- [ ] Repeat for `heartbeat`, `leave_queue`, `matchmaker_tick`, `cleanup_queue`, `game-ws`

**TODO (Phase 2):**
- [ ] Set up log aggregation (Datadog, CloudWatch, or Supabase Log Drains)
- [ ] Track metrics: count, avg duration, error rate per function
- [ ] Alert on: >5% error rate, >2s p95 latency, cron job failures

### C. Product KPIs
**TODO (Phase 2):**

Run these queries weekly and track trends:

```sql
-- Queue wait time (p50, p95)
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY wait_seconds) AS p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY wait_seconds) AS p95
FROM match_quality_metrics;

-- Match success rate
SELECT
  COUNT(*) FILTER (WHERE state = 'ended') * 100.0 / COUNT(*) AS success_rate
FROM matches_new
WHERE created_at > NOW() - INTERVAL '7 days';

-- WebSocket disconnect rate
SELECT
  COUNT(*) FILTER (WHERE type = 'opponent_disconnect') * 100.0 /
  COUNT(*) FILTER (WHERE type = 'game_start') AS disconnect_rate
FROM match_events
WHERE created_at > NOW() - INTERVAL '7 days';

-- Rage-quit % (disconnect before 1st question complete)
SELECT
  COUNT(*) FILTER (WHERE time_to_disconnect < 60) * 100.0 /
  COUNT(*) AS ragequit_rate
FROM (
  SELECT
    match_id,
    MIN(created_at) FILTER (WHERE type = 'opponent_disconnect') -
    MIN(created_at) FILTER (WHERE type = 'game_start') AS time_to_disconnect
  FROM match_events
  GROUP BY match_id
) AS disconnect_times;
```

---

## 6. Open Risks & Mitigations ⚠️

### A. Client-Side Scoring (HIGH RISK)
**Current State:** Client submits `marks_earned` → server trusts it

**Risk:** Player can spoof scores via DevTools

**Mitigation (Phase 2 - Priority 1):**
- [ ] Modify `game-ws` to ignore client `marks_earned`
- [ ] Server fetches correct answer from `questions` table
- [ ] Server recalculates marks: `(is_correct ? total_marks : 0) - latency_penalty`
- [ ] Server sends authoritative score in `score_update`

**Acceptance:**
- [ ] Deploy modified `game-ws`
- [ ] Test: Client sends wrong `marks_earned` → server overrides
- [ ] Test: Client DevTools manipulation has no effect on DB scores

---

### B. Client-Side Timer (MEDIUM RISK)
**Current State:** Client runs local timer, sends `question_complete` when time expires

**Risk:** Player can pause timer via DevTools, gain extra thinking time

**Mitigation (Phase 2 - Priority 2):**
- [ ] Server starts timer on `game_start`
- [ ] Server broadcasts `score_update` with `time_left` every 5s
- [ ] Client displays server-provided `time_left`
- [ ] Server force-closes question after 30s regardless of client state

**Acceptance:**
- [ ] Deploy modified `game-ws`
- [ ] Test: Client timer pause has no effect (server timer is authoritative)

---

### C. Question Selection Authority (MEDIUM RISK)
**Current State:** Client-side seeding (NOT IMPLEMENTED YET)

**Risk:** Predictable question selection, desync between players

**Mitigation (Phase 2 - Priority 1):**
- [ ] Server picks question IDs in `game-ws` on `game_start`
- [ ] Use deterministic PRNG seeded with `match_id` hash
- [ ] Query: `SELECT id FROM questions WHERE subject=X AND chapter=Y ORDER BY id LIMIT 5 OFFSET (seed % count)`
- [ ] Server sends `question_ids` array in `game_start` event
- [ ] Clients fetch questions by IDs (without `correct_answer` field)

**Acceptance:**
- [ ] Deploy modified `game-ws`
- [ ] Test: Both players see exact same questions in same order
- [ ] Test: `correct_answer` column is never sent to client

---

### D. Realtime OR Listener (RESOLVED ✅)
**Current State:** Dual subscriptions (p1 and p2 filters) with deduplication

**Risk:** If not deduped, could navigate twice

**Mitigation (ALREADY IMPLEMENTED):**
- [x] `navLockRef.current` prevents duplicate navigation
- [x] Single `handleMatchInsert` callback for both subscriptions
- [x] Cleanup unsubscribes both channels on unmount

**Verification:**
- [ ] Test rapid double-INSERT (simulate race condition)
- [ ] **VERIFY:** Only one navigation occurs
- [ ] **VERIFY:** Console shows "navigation already in progress, ignoring"

---

### E. Queue Idempotency (RESOLVED ✅)
**Current State:** UNIQUE constraint on `queue.player_id`, button disabled on click

**Risk:** Double-enqueue if button click race condition

**Mitigation (ALREADY IMPLEMENTED):**
- [x] Button disabled immediately in UI
- [x] `isJoiningRef.current` prevents duplicate API calls
- [x] Database UNIQUE constraint prevents duplicate rows

**Verification:**
- [ ] Test rapid double-click on "Start Battle"
- [ ] **VERIFY:** Only one queue entry created
- [ ] **VERIFY:** No 409 conflict errors

---

## 7. Next Milestones (Prioritized) 📋

### Phase 2 - Authoritative Game Flow (Priority 1)
**Goal:** Eliminate client-side cheating surface

- [ ] Server picks question IDs and sends in `game_start`
- [ ] Server owns round timer, broadcasts `time_left` in `score_update`
- [ ] Server calculates marks based on correctness + latency
- [ ] Client removes all scoring logic, trusts WS events only

**Acceptance:** Run "Security Verification" tests, verify no client manipulation possible

---

### Phase 3 - Active Match Recovery (Priority 2)
**Goal:** Users can refresh during match and rejoin

- [ ] Create `useActiveMatch()` hook
- [ ] Query: `SELECT * FROM matches_new WHERE (p1=userId OR p2=userId) AND state IN ('pending','active')`
- [ ] On app mount: if active match exists, show "Rejoin Match" modal
- [ ] Reconnect WebSocket with existing `match_id`
- [ ] Resume from current game state (fetch scores from DB)

**Acceptance:** User refreshes → sees "Rejoin Match" → clicks → back in battle

---

### Phase 4 - Results Screen (Priority 3)
**Goal:** Show post-match summary with MMR changes

- [ ] Create `PostMatchResults.tsx` component
- [ ] Show: Winner/Loser/Draw, final scores, MMR delta (+32/-32)
- [ ] "Play Again" button → navigate back to queue
- [ ] "View Stats" button → navigate to profile

**Acceptance:** Match ends → results screen displays → user can queue again

---

### Phase 5 - Monitoring & Alerts (Priority 4)
**Goal:** Ops team can detect issues before users complain

- [ ] Set up Sentry project for frontend errors
- [ ] Set up Supabase Log Drains → Datadog/CloudWatch
- [ ] Create dashboard: queue size, match rate, WS errors
- [ ] Slack/Discord alerts: >5% error rate, cron job failures, avg wait >10s

**Acceptance:** Ops team sees alert within 5 minutes of issue

---

## 8. Production Deployment Checklist ✅

### Pre-Deploy
- [x] All migrations applied to production DB
- [x] Edge functions deployed: `enqueue`, `heartbeat`, `leave_queue`, `matchmaker_tick`, `cleanup_queue`, `game-ws`
- [x] Cron jobs scheduled: `matchmaker_tick_job` (2s), `cleanup_stale_queue_job` (30s)
- [x] Realtime enabled for `public.matches_new`
- [x] RLS policies active and tested
- [x] Build passes: `npm run build` ✅
- [x] No secrets in repo history

### Deploy Steps
1. [ ] Deploy frontend build to hosting (Vercel/Netlify/etc)
2. [ ] Verify environment variables set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. [ ] Test in production: queue → match → battle → end
4. [ ] Monitor logs for 1 hour post-deploy
5. [ ] If issues, rollback and investigate

### Post-Deploy
- [ ] Run this entire checklist against production
- [ ] Share results with team
- [ ] Document any issues in GitHub Issues
- [ ] Schedule Phase 2 work (authoritative scoring)

---

## 9. Sign-Off ✍️

**QA Engineer:**
- [ ] All functional smoke tests passed
- [ ] All resilience tests passed
- [ ] Security verification complete
- [ ] No critical issues found

**Ops Lead:**
- [ ] Monitoring configured (or Phase 5 scheduled)
- [ ] Alerting thresholds set
- [ ] Runbook documented for common issues
- [ ] On-call rotation aware of new system

**Product Manager:**
- [ ] User-facing behavior matches requirements
- [ ] 5-minute test completes successfully
- [ ] Known limitations documented
- [ ] Phase 2-5 milestones prioritized

**Engineering Lead:**
- [ ] Code reviewed and approved
- [ ] Technical debt items logged
- [ ] Next milestones assigned to sprints
- [ ] Documentation up to date

---

**Date:** ________________

**Version:** Instant Matchmaking v1.0

**Status:** [ ] Ready for Production  [ ] Needs Work

**Notes:**
