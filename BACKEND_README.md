# A-Level Arena Backend

Production-ready backend for A-Level Arena 1v1 quiz game using **Supabase Edge Functions** (Deno), **Supabase Postgres**, **Auth**, **Realtime**, and **WebSocket**.

## Architecture Overview

```
┌─────────────┐
│   Client    │
│  (React)    │
└──────┬──────┘
       │
       ├─── REST API (Edge Functions)
       │    ├─ enqueue
       │    ├─ heartbeat
       │    └─ leave_queue
       │
       ├─── WebSocket (game-ws)
       │    └─ Real-time gameplay
       │
       └─── Realtime (Supabase)
            └─ Match notifications
```

## Database Schema

### Tables

**players**
- `id` (uuid, PK, references auth.users)
- `display_name` (text)
- `mmr` (int, default 1000)
- `region` (text, nullable)
- `updated_at` (timestamptz)

**queue**
- `id` (uuid, PK)
- `player_id` (uuid, unique, FK to players)
- `subject` (text)
- `chapter` (text)
- `mmr` (int)
- `region` (text, nullable)
- `enqueued_at` (timestamptz)
- `last_heartbeat` (timestamptz)

**matches_new**
- `id` (uuid, PK)
- `p1` (uuid, FK to players)
- `p2` (uuid, FK to players)
- `subject` (text)
- `chapter` (text)
- `state` (text: 'pending', 'active', 'ended')
- `p1_score` (int, default 0)
- `p2_score` (int, default 0)
- `winner_id` (uuid, nullable)
- `created_at` (timestamptz)
- `ended_at` (timestamptz, nullable)

**match_events**
- `id` (bigserial, PK)
- `match_id` (uuid, FK to matches_new)
- `sender` (uuid, FK to players)
- `type` (text)
- `payload` (jsonb)
- `created_at` (timestamptz)

### Indexes

- `idx_queue_subject_chapter_mmr` on queue(subject, chapter, mmr)
- `idx_queue_region` on queue(region)
- `idx_queue_heartbeat` on queue(last_heartbeat)
- `idx_matches_created_at` on matches_new(created_at)
- `idx_matches_players` on matches_new(p1, p2)
- `idx_match_events_match_id` on match_events(match_id)

### Row Level Security (RLS)

All tables have RLS enabled:
- **players**: Users can read/update their own profile
- **queue**: Users can manage their own queue entry
- **matches_new**: Users can view matches they participate in
- **match_events**: Users can view/insert events for their matches

## Edge Functions

### 1. enqueue (POST, user auth required)

Join the matchmaking queue.

**Endpoint**: `POST /functions/v1/enqueue`

**Headers**:
```
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Body**:
```json
{
  "subject": "math",
  "chapter": "calculus",
  "region": "EU" // optional
}
```

**Response**:
```json
{
  "success": true,
  "mmr": 1000
}
```

### 2. heartbeat (POST, user auth required)

Keep queue entry alive (call every 15s).

**Endpoint**: `POST /functions/v1/heartbeat`

**Headers**:
```
Authorization: Bearer <JWT>
```

**Response**:
```json
{
  "success": true
}
```

### 3. leave_queue (POST, user auth required)

Leave the matchmaking queue.

**Endpoint**: `POST /functions/v1/leave_queue`

**Headers**:
```
Authorization: Bearer <JWT>
```

**Response**:
```json
{
  "success": true
}
```

### 4. matchmaker_tick (POST, service role only)

Runs matchmaking algorithm. Should be triggered by cron every 10-15 seconds.

**Endpoint**: `POST /functions/v1/matchmaker_tick`

**Headers**:
```
Authorization: Bearer <SERVICE_ROLE_KEY>
```

**Response**:
```json
{
  "matched": 2
}
```

**Matching Logic**:
- Groups players by subject+chapter
- Sorts by wait time (oldest first)
- Pairs based on MMR (±150 base window, widens over time)
- Prefers same region
- Broadcasts `match_found` via Realtime

### 5. cleanup_queue (POST, service role only)

Removes stale queue entries (>45s since last heartbeat). Should run every 1 minute via cron.

**Endpoint**: `POST /functions/v1/cleanup_queue`

**Headers**:
```
Authorization: Bearer <SERVICE_ROLE_KEY>
```

**Response**:
```json
{
  "removed": 3
}
```

### 6. game-ws (WebSocket)

Real-time gameplay WebSocket endpoint.

**Connection**: `wss://<project-ref>.supabase.co/functions/v1/game-ws?token=<JWT>&match_id=<uuid>`

**Client Messages**:
```json
// 1. Ready up
{
  "type": "ready"
}

// 2. Submit answer
{
  "type": "answer_submit",
  "question_id": "uuid",
  "answer": 2,
  "marks_earned": 1
}

// 3. Question complete
{
  "type": "question_complete"
}
```

**Server Messages**:
```json
// Connection confirmed
{
  "type": "connected",
  "player": "p1" // or "p2"
}

// Player ready
{
  "type": "player_ready",
  "player": "p1"
}

// Game start
{
  "type": "game_start"
}

// Score update
{
  "type": "score_update",
  "p1_score": 3,
  "p2_score": 2
}

// Match end
{
  "type": "match_end",
  "winner_id": "uuid",
  "final_scores": { "p1": 5, "p2": 3 },
  "mmr_changes": {
    "winner_uuid": { "old": 1000, "new": 1032 },
    "loser_uuid": { "old": 1020, "new": 988 }
  }
}
```

## Client Integration

### 1. Sign in and subscribe to match notifications

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Sign in
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

const jwt = session.access_token
const userId = session.user.id

// Subscribe to match found notifications
const channel = supabase.channel(`user_${userId}`)
channel.on('broadcast', { event: 'match_found' }, (payload) => {
  const { match_id, opponent_display, server_ws_url } = payload.payload
  console.log('Match found!', match_id, opponent_display)
  
  // Connect to WebSocket
  connectToGame(server_ws_url, jwt, match_id)
}).subscribe()
```

### 2. Join queue with heartbeat

```typescript
// Join queue
const response = await fetch(`${SUPABASE_URL}/functions/v1/enqueue`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    subject: 'math',
    chapter: 'calculus'
  })
})

// Start heartbeat
const heartbeatInterval = setInterval(async () => {
  await fetch(`${SUPABASE_URL}/functions/v1/heartbeat`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}` }
  })
}, 15000) // Every 15 seconds

// Leave queue
const leaveQueue = async () => {
  clearInterval(heartbeatInterval)
  await fetch(`${SUPABASE_URL}/functions/v1/leave_queue`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}` }
  })
}
```

### 3. Connect to WebSocket for gameplay

```typescript
function connectToGame(serverWsUrl: string, jwt: string, matchId: string) {
  const ws = new WebSocket(`${serverWsUrl}?token=${jwt}&match_id=${matchId}`)

  ws.onopen = () => {
    console.log('Connected to game')
    // Send ready
    ws.send(JSON.stringify({ type: 'ready' }))
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    console.log('Received:', message)

    switch (message.type) {
      case 'game_start':
        // Start displaying questions
        break
      case 'score_update':
        // Update UI with new scores
        break
      case 'match_end':
        // Show results
        ws.close()
        break
    }
  }

  // Submit answer
  const submitAnswer = (questionId: string, answer: number, marksEarned: number) => {
    ws.send(JSON.stringify({
      type: 'answer_submit',
      question_id: questionId,
      answer,
      marks_earned: marksEarned
    }))
  }

  // Complete question
  const completeQuestion = () => {
    ws.send(JSON.stringify({ type: 'question_complete' }))
  }
}
```

## Deployment

All Edge Functions are automatically deployed by Lovable when you push changes.

## Cron Jobs Setup

To run matchmaker and cleanup automatically, set up cron jobs in Supabase:

1. Go to **Database** > **Extensions** and enable `pg_cron`
2. Go to **SQL Editor** and run:

```sql
-- Run matchmaker every 10 seconds
SELECT cron.schedule(
  'matchmaker-tick',
  '*/10 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/matchmaker-tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Run cleanup every minute
SELECT cron.schedule(
  'cleanup-queue',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cleanup-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

Replace `<project-ref>` with your Supabase project reference (e.g., `qvunaswogfwhixecjpcn`).

## ELO Rating System

The backend uses the ELO rating algorithm to update player MMR after each match:

```
Expected Score = 1 / (1 + 10^((opponent_mmr - player_mmr) / 400))
New MMR = Old MMR + K * (Actual Score - Expected Score)
```

- **K-factor**: 32 (standard for most competitive games)
- **Actual Score**: 1 for winner, 0 for loser
- Winner gains MMR, loser loses MMR
- Bigger upsets result in larger MMR changes

## Environment Variables

Edge Functions automatically have access to:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Rate Limiting

Consider implementing rate limiting at the Edge Function level or using Supabase's built-in rate limiting features to prevent abuse.

## Monitoring

- Check Edge Function logs: [Supabase Dashboard](https://supabase.com/dashboard/project/qvunaswogfwhixecjpcn/functions)
- Monitor cron job execution in the `cron.job_run_details` table
- Track match events in the `match_events` table for debugging

## Testing

Test each endpoint using curl or Postman:

```bash
# Sign in to get JWT
curl -X POST https://qvunaswogfwhixecjpcn.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Join queue
curl -X POST https://qvunaswogfwhixecjpcn.supabase.co/functions/v1/enqueue \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"subject":"math","chapter":"calculus"}'
```

## Production Checklist

- [x] Database schema with proper indexes
- [x] RLS policies for security
- [x] Edge Functions for API endpoints
- [x] WebSocket support for real-time gameplay
- [x] ELO rating system
- [x] Match event logging
- [x] Queue cleanup mechanism
- [ ] Set up cron jobs for matchmaker and cleanup
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerts
- [ ] Load testing for WebSocket connections

## Support

For issues or questions, check the [Supabase docs](https://supabase.com/docs) or reach out to the development team.
