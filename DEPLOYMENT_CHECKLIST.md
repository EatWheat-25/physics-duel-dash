# Deployment Checklist: Event-Driven Matchmaking

## Pre-Deployment

- [ ] Read `MATCHMAKING_PR.md` for full context
- [ ] Backup current database (if production)
- [ ] Verify `.env` has correct Supabase credentials
- [ ] Ensure you have Supabase CLI installed: `npm i -g supabase`

## Step 1: Database Migration

```bash
# Link to your Supabase project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Apply the new migration
supabase db push

# Verify tables created
supabase db diff
```

**Expected Result:** New columns added to `queue`, new `match_offers` table created, new RPC functions added.

## Step 2: Deploy Edge Functions

```bash
# Deploy all 4 new functions
supabase functions deploy find_match
supabase functions deploy accept_offer
supabase functions deploy decline_offer
supabase functions deploy sweeper
```

**Expected Result:** All 4 functions show as "ACTIVE" in Supabase Dashboard → Edge Functions.

## Step 3: Schedule Sweeper Cron Job

Go to Supabase Dashboard → Database → SQL Editor and run:

```sql
-- Replace YOUR-PROJECT-REF with actual project reference
SELECT cron.schedule(
  'sweeper_job',
  '10 seconds',
  $$
  SELECT net.http_post(
    url:='https://YOUR-PROJECT-REF.supabase.co/functions/v1/sweeper',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**Verify:**
```sql
-- Check cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'sweeper_job';

-- Check it's running (wait 10s then check)
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sweeper_job')
ORDER BY start_time DESC
LIMIT 5;
```

## Step 4: Clean Up Old Functions (Optional)

```bash
# Remove obsolete functions
supabase functions delete enqueue
supabase functions delete matchmaker_tick
supabase functions delete cleanup_queue
supabase functions delete heartbeat
supabase functions delete leave_queue
```

## Step 5: Clean Up Old Cron Jobs (Optional)

In Supabase Dashboard → Database → SQL Editor:

```sql
-- Remove old cron jobs
SELECT cron.unschedule('matchmaker_tick_job');
SELECT cron.unschedule('cleanup_stale_queue_job');
```

## Step 6: Build and Deploy Frontend

```bash
# Build to verify no errors
npm run build

# Deploy via your platform (Vercel, Netlify, etc.)
```

## Step 7: Smoke Test

### Test 1: Single Player Queue
1. Log in as User A
2. Click "Find Match"
3. Should see "FINDING OPPONENT" screen
4. After 30+ seconds, should still be waiting (no error)

### Test 2: Two-Player Match
1. Browser 1: Log in as User A, click "Find Match"
2. Browser 2 (incognito): Log in as User B, click "Find Match" (same subject)
3. **Expected:** Both see offer modal within 2-5 seconds
4. Both click "Accept"
5. **Expected:** Both redirect to `/online-battle/:matchId`

### Test 3: Decline Flow
1. Repeat Test 2 steps 1-3
2. User A clicks "Decline"
3. **Expected:** Modal closes for both, both can search again

### Test 4: Timeout Flow
1. Repeat Test 2 steps 1-3
2. Wait 15+ seconds without clicking
3. **Expected:** Modal closes, both can search again

## Step 8: Monitor

### Check Edge Function Logs
```bash
supabase functions logs find_match
supabase functions logs accept_offer
supabase functions logs sweeper
```

### Check Database State
```sql
-- Active queue entries
SELECT * FROM queue WHERE status = 'waiting';

-- Active offers
SELECT * FROM match_offers WHERE state = 'pending';

-- Recent matches
SELECT * FROM matches_new ORDER BY created_at DESC LIMIT 10;

-- Cron job health
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

## Rollback Plan (If Needed)

1. **Revert frontend:**
   ```bash
   git revert HEAD
   npm run build
   # Re-deploy
   ```

2. **Keep database as-is** (new columns don't break old code)

3. **Re-deploy old functions:**
   ```bash
   git checkout HEAD~1 supabase/functions/enqueue
   supabase functions deploy enqueue
   # etc.
   ```

4. **Re-enable old cron jobs** (see old migration files)

## Success Criteria

- [ ] Two players can find each other within 5 seconds
- [ ] Offer modal appears with 15-second countdown
- [ ] Both accepting creates confirmed match
- [ ] Decline/timeout returns players to queue
- [ ] No console errors in browser
- [ ] No errors in edge function logs
- [ ] Sweeper cron job runs every 10 seconds
- [ ] Database queries are fast (<100ms)

## Troubleshooting

### Issue: "Unauthorized" error in find_match
**Solution:** Check `.env` has correct `VITE_SUPABASE_ANON_KEY`

### Issue: Modal doesn't appear
**Solution:** Check browser console for errors, verify `find_match` is returning `status: 'offered'`

### Issue: Stuck on "pending" after accepting
**Solution:** Verify postgres_changes subscription is active, check `match_offers` table state

### Issue: Offers never expire
**Solution:** Verify sweeper cron job is running: `SELECT * FROM cron.job_run_details`

### Issue: "lock not acquired" or "busy"
**Solution:** This is expected under high load; retry happens automatically

## Post-Deployment

- [ ] Monitor for 24 hours
- [ ] Check database growth (queue, match_offers tables)
- [ ] Review edge function execution times
- [ ] Collect user feedback
- [ ] Consider enabling regional sharding if needed

## Performance Tuning (If Needed)

```sql
-- Add indexes if queries are slow
CREATE INDEX IF NOT EXISTS idx_queue_player_status
ON queue(player_id, status);

CREATE INDEX IF NOT EXISTS idx_offers_expires
ON match_offers(expires_at)
WHERE state = 'pending';

-- Analyze tables
ANALYZE queue;
ANALYZE match_offers;
ANALYZE matches_new;
```

---

**Done!** 🎉 Your event-driven matchmaking system is live.
