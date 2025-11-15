# MVP Deployment Checklist

## Pre-Deployment

- [ ] Verify migration file exists: `supabase/migrations/20251115044021_questions_mvp_integration.sql`
- [ ] Review migration SQL for any syntax errors
- [ ] Backup current database (Supabase dashboard)
- [ ] Ensure no active matches are running

## Deployment Steps

### 1. Apply Database Migration

```bash
# Auto-deployed on git push if using Supabase CLI
# Or manually via Supabase dashboard: Database > Migrations
```

Expected tables/functions created:
- `match_questions` table
- `upsert_questions()` function  
- `pick_next_question_v2()` function
- `submit_answer()` function
- Indexes on questions table
- New columns on matches_new

### 2. Deploy WebSocket Function

```bash
# Auto-deployed on git push
# Or manually via Supabase CLI:
supabase functions deploy game-ws
```

Verify:
- Function shows in dashboard
- No deployment errors
- Logs are accessible

### 3. Seed Initial Questions

```bash
# Set environment variables first:
export VITE_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Run seeder
npm run seed:questions
```

Expected output:
- "Loaded X A2 questions"
- "Complete! Success: X, Errors: 0"

Verify in database:
```sql
SELECT count(*) FROM questions;
SELECT subject, chapter, count(*) 
FROM questions 
GROUP BY subject, chapter;
```

## Post-Deployment Verification

### Database Check

```sql
-- Verify functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('upsert_questions', 'pick_next_question_v2', 'submit_answer');

-- Verify indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'questions';

-- Check question count
SELECT count(*) FROM questions;

-- Verify RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('questions', 'match_questions');
```

### Functional Test

1. Create two test accounts
2. Both join queue
3. Match is created
4. Both connect to WebSocket
5. Send ready messages
6. Verify question appears
7. Submit answer
8. Verify score updates
9. Complete question
10. Verify next question appears

### Monitoring

Check these in Supabase Dashboard:

- [ ] Edge Functions logs (game-ws)
- [ ] Database logs (any RPC errors?)
- [ ] Match events table (answers being logged?)
- [ ] Match questions table (tracking usage?)

## Rollback Plan

If issues occur:

1. **Disable matchmaking temporarily**:
   ```sql
   -- Block new matches (emergency only)
   UPDATE queue SET status = 'disabled';
   ```

2. **Revert WebSocket function**:
   ```bash
   git checkout HEAD~1 supabase/functions/game-ws/index.ts
   supabase functions deploy game-ws
   ```

3. **Rollback migration** (last resort):
   ```sql
   DROP FUNCTION IF EXISTS submit_answer;
   DROP FUNCTION IF EXISTS pick_next_question_v2;
   DROP FUNCTION IF EXISTS upsert_questions;
   DROP TABLE IF EXISTS match_questions;
   ALTER TABLE matches_new DROP COLUMN IF EXISTS subject;
   ALTER TABLE matches_new DROP COLUMN IF EXISTS chapter;
   ALTER TABLE matches_new DROP COLUMN IF EXISTS rank_tier;
   ```

## Success Criteria

- [ ] Migration applied successfully
- [ ] At least 50 questions seeded
- [ ] WebSocket function deployed
- [ ] Test match completes successfully
- [ ] Answers graded correctly
- [ ] No console errors in client
- [ ] No errors in Supabase logs

## Known Limitations (MVP)

- Questions are random within filters (no difficulty progression yet)
- No chapter selection UI yet (defaults to null, matches any chapter)
- Tier-3 fallback may give unrelated questions if pool is small
- No analytics on question usage yet

## Next Phase

After MVP is stable:
- Add chapter selection to queue UI
- Generate more questions via templates
- Capture subject/chapter/rank on enqueue
- Add usage telemetry
- Build admin dashboard for question management
