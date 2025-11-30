# Quick Start: Simple 1v1 System

## 1-Minute Setup

The system is already deployed! Just follow these steps:

### Database
✅ **Already Done**
- Migration applied: `rebuild_1v1_simple_clean.sql`
- Tables created: `battle_questions`, `matchmaking_queue`, `battle_matches`
- 5 questions seeded automatically

### Edge Functions
📝 **Deploy These**:

```bash
# Deploy matchmaker
supabase functions deploy matchmake-simple

# Deploy game WebSocket
supabase functions deploy game-ws-simple
```

### Frontend
✅ **Already Built**
- Routes added to App.tsx
- Components created
- Hook implemented

## Testing (2 Minutes)

### Open Two Browser Windows

**Window 1**:
1. Navigate to: `http://localhost:5173/matchmaking-test`
2. Click "Start Matchmaking"
3. See: "Finding opponent..."

**Window 2** (use Incognito):
1. Login with different account
2. Navigate to: `http://localhost:5173/matchmaking-test`
3. Click "Start Matchmaking"
4. See: "Match Found!"

**Both Windows**:
- Auto-navigate to `/battle-simple/:matchId`
- Question displays with 4 options
- ✅ **Working!**

## Verify Database

```sql
-- Check questions (should have 5)
SELECT COUNT(*) FROM battle_questions;

-- Check queue (should be empty after match)
SELECT * FROM matchmaking_queue;

-- Check matches (should have 1 active match)
SELECT * FROM battle_matches WHERE status = 'active';
```

## Logs to Watch

### Backend (Supabase Dashboard → Functions)

**matchmake-simple**:
```
[MATCHMAKER] Player {id} requesting match
[MATCHMAKER] Matched {id1} with {id2}
[MATCHMAKER] ✅ Match created: {matchId}
```

**game-ws-simple**:
```
[{matchId}] WebSocket connection from user {id}
[{matchId}] Player 1 connected
[{matchId}] Player 2 connected
[{matchId}] Both players connected, sending ROUND_START
[{matchId}] Selected question: {questionId}
[{matchId}] ✅ ROUND_START complete
```

### Frontend (Browser Console)

```
[MATCHMAKING] Starting matchmaking...
[MATCHMAKING] Response: { matched: true, match_id: "..." }
[BATTLE] Connecting to WebSocket: ...
[BATTLE] WebSocket connected
[BATTLE] Message received: ROUND_START
[BATTLE] Question received: { id: "...", text: "..." }
```

## If Something Breaks

### No questions display?
```sql
-- Re-seed questions
DELETE FROM battle_questions;
INSERT INTO battle_questions (text, steps) VALUES
('Test question?', '{"type": "mcq", "options": ["A", "B", "C", "D"], "answer": 0}'::jsonb);
```

### Match not created?
Check function logs:
1. Go to Supabase Dashboard
2. Functions → matchmake-simple
3. Check recent invocations

### WebSocket won't connect?
1. Check `battle_matches` table has the match
2. Verify user is player1_id or player2_id
3. Check game-ws-simple function is deployed

## Architecture Diagram

```
┌─────────────┐
│   Browser   │
│ /matchmaking│
│    -test    │
└──────┬──────┘
       │ Click "Start"
       ▼
┌──────────────────┐
│ useMatchmaking   │
│     Simple       │
└──────┬───────────┘
       │ invoke()
       ▼
┌──────────────────┐
│ matchmake-simple │  ◄──┐
│  Edge Function   │     │
└──────┬───────────┘     │
       │                 │ No match found
       │ INSERT          │ (poll every 2s)
       ▼                 │
┌──────────────────┐     │
│ matchmaking_     │     │
│     queue        │     │
└──────┬───────────┘     │
       │                 │
       │ Found opponent! │
       ▼                 │
┌──────────────────┐     │
│ battle_matches   │─────┘
└──────┬───────────┘
       │ match_id
       ▼
┌──────────────────┐
│  /battle-simple  │
│     /:matchId    │
└──────┬───────────┘
       │ WebSocket
       ▼
┌──────────────────┐
│  game-ws-simple  │
│  Edge Function   │
└──────┬───────────┘
       │ SELECT random()
       ▼
┌──────────────────┐
│ battle_questions │
└──────┬───────────┘
       │ Question data
       ▼
┌──────────────────┐
│   Browser UI     │
│ Displays question│
└──────────────────┘
```

## URLs

### Test Pages
- Matchmaking: `http://localhost:5173/matchmaking-test`
- Battle: `http://localhost:5173/battle-simple/:matchId`

### Database Tables (Supabase Dashboard)
- `battle_questions` - View questions
- `matchmaking_queue` - View queue
- `battle_matches` - View matches

### Functions (Supabase Dashboard)
- `matchmake-simple` - View matchmaker logs
- `game-ws-simple` - View game logs

## Success Checklist

- [ ] Database has 3 tables
- [ ] 5 questions in `battle_questions`
- [ ] Edge functions deployed
- [ ] Routes added to App.tsx
- [ ] Can click "Start" in test page
- [ ] Both players find match
- [ ] Question displays
- [ ] No console errors

## Next: Add Features

Once basic system works:
1. Add answer submission (Week 1)
2. Add multiple rounds (Week 2)
3. Add scoring system (Week 3)
4. Add match history (Week 4)

## Support

If stuck:
1. Check `SIMPLE_1V1_SYSTEM.md` for full docs
2. Run database verification queries
3. Check Supabase function logs
4. Look at browser console logs
5. Verify all files were created

**Expected Result**:
- Two players can find each other in < 5 seconds
- Question displays reliably
- System never crashes
