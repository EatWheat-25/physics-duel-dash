# WebSocket Contract for Game Server

This document defines the complete WebSocket protocol for real-time 1v1 battles.

## Protocol v2 (authoritative snapshot + phase updates)

The server is the single source of truth for match state. Clients **must** render from
`STATE_SNAPSHOT` and only advance when `phaseSeq` increases.

### Server → Client (authoritative)

#### 1) STATE_SNAPSHOT (required on connect/reconnect)
```json
{
  "type": "STATE_SNAPSHOT",
  "protocolVersion": 2,
  "serverTime": "2026-01-15T12:00:00.000Z",
  "matchId": "uuid",
  "roundId": "uuid",
  "roundNumber": 3,
  "targetRoundsToWin": 3,
  "phase": "main",
  "phaseSeq": 5,
  "endsAt": "2026-01-15T12:00:15.000Z",
  "question": { "id": "uuid", "steps": [] },
  "totalSteps": 1,
  "players": {
    "p1": { "id": "uuid", "answered": false, "completed": false, "currentStepIndex": null, "currentSegment": null, "currentSubStepIndex": null, "segmentEndsAt": null },
    "p2": { "id": "uuid", "answered": true, "completed": false, "currentStepIndex": null, "currentSegment": null, "currentSubStepIndex": null, "segmentEndsAt": null }
  },
  "playerRoundWins": { "playerId": 1 },
  "resultsPayload": null,
  "resultsVersion": 0,
  "matchOver": false,
  "matchWinnerId": null
}
```

#### 2) PHASE_UPDATE (phase-only delta)
```json
{
  "type": "PHASE_UPDATE",
  "protocolVersion": 2,
  "serverTime": "2026-01-15T12:00:15.000Z",
  "matchId": "uuid",
  "roundId": "uuid",
  "phase": "steps",
  "phaseSeq": 6,
  "endsAt": "2026-01-15T12:00:55.000Z"
}
```

### Phase transitions (v2)

| From | To | Trigger |
| --- | --- | --- |
| `main` | `steps` | Multi-step question and `endsAt` elapsed |
| `main` | `results` | Single-step results ready or timeout forced |
| `steps` | `results` | All players complete or `endsAt` forced |
| `results` | `done` | Results timer elapsed |
| `done` | `main` | Next round created (if match not finished) |

### Client → Server (v2)

#### 1) JOIN_MATCH
```json
{
  "type": "JOIN_MATCH",
  "match_id": "uuid",
  "player_id": "uuid"
}
```

#### 2) SUBMIT_ANSWER (single-step)
```json
{
  "type": "SUBMIT_ANSWER",
  "answer": 2
}
```

#### 3) SUBMIT_SEGMENT_ANSWER (multi-step)
```json
{
  "type": "SUBMIT_SEGMENT_ANSWER",
  "stepIndex": 0,
  "segment": "main",
  "subStepIndex": 0,
  "answerIndex": 1
}
```

#### 4) READY_FOR_NEXT_ROUND (optional nudge)
```json
{
  "type": "READY_FOR_NEXT_ROUND"
}
```

---

## Legacy events (deprecated)

Older events (`QUESTION_RECEIVED`, `ROUND_START`, `PHASE_CHANGE`, `RESULTS_RECEIVED`, etc.)
may still be emitted for backwards compatibility but are **not authoritative**.

## Connection

**URL Format:**
```
wss://<supabase-project>.supabase.co/functions/v1/game-ws?token=<JWT>&match_id=<UUID>
```

**Parameters:**
- `token` (required): JWT access token from Supabase auth session
- `match_id` (required): UUID of the match from matches_new table

**Authentication:**
- Token is verified on connection
- User must be either p1 or p2 in the specified match
- Invalid token or unauthorized match returns 401/403

**Reconnection:**
- Same JWT works for duration of match
- Client should reconnect with exponential backoff on disconnect
- Server maintains game state during brief disconnections

---

## Client to Server Events

### 1. Ready Signal

Sent immediately after connection to indicate player is ready to start.

```json
{
  "type": "ready"
}
```

**When to send:**
- Immediately after WebSocket `onopen` event
- No retry needed (server tracks ready state)

**Server response:**
- Broadcasts `player_ready` event to both players
- When both players ready, broadcasts `game_start`

---

### 2. Submit Answer

Sent when player submits an answer to a question.

```json
{
  "type": "answer_submit",
  "question_id": "uuid-of-question",
  "answer": 2,
  "marks_earned": 1
}
```

**Fields:**
- `question_id` (string): UUID from questions table
- `answer` (number): Index of selected option (0-3)
- `marks_earned` (number): Marks calculated by client (server recalculates)

**Server behavior:**
- Validates answer against correct answer (from questions table)
- Recalculates marks based on correctness and latency
- Updates match scores in database
- Broadcasts `score_update` to both players

---

### 3. Question Complete

Sent when player finishes current question (time expires or submitted answer).

```json
{
  "type": "question_complete"
}
```

**Server behavior:**
- Increments question counter
- If 5 questions complete, ends match and calculates winner
- Broadcasts `match_end` event with final results and MMR changes

---

## Server to Client Events

### 1. Connected Confirmation

Sent immediately when client connects successfully.

```json
{
  "type": "connected",
  "player": "p1"
}
```

**Fields:**
- `player` (string): Either "p1" or "p2" indicating which player this connection represents

**Client action:**
- Send `ready` signal
- Update UI to show "Connecting..." → "Waiting for opponent"

---

### 2. Player Ready

Broadcast when a player sends ready signal.

```json
{
  "type": "player_ready",
  "player": "p2"
}
```

**Fields:**
- `player` (string): Either "p1" or "p2" indicating which player is now ready

**Client action:**
- Update UI to show opponent ready status
- Wait for `game_start` if this is not your own ready signal

---

### 3. Game Start

Broadcast when both players are ready.

```json
{
  "type": "game_start",
  "question_ids": [
    "uuid-1",
    "uuid-2",
    "uuid-3",
    "uuid-4",
    "uuid-5"
  ]
}
```

**Fields:**
- `question_ids` (array): Array of 5 question UUIDs to be played in order

**Client action:**
- Fetch questions from database using provided IDs
- Start countdown "3...2...1...START!"
- Begin displaying first question

**Note:**
- Questions are fetched client-side from `questions` table
- Server only sends IDs (not full question data)
- Correct answers are NOT included in client-side fetch

---

### 4. Score Update

Broadcast when either player submits an answer.

```json
{
  "type": "score_update",
  "p1_score": 3,
  "p2_score": 2,
  "time_left": 25
}
```

**Fields:**
- `p1_score` (number): Current score for player 1
- `p2_score` (number): Current score for player 2
- `time_left` (number, optional): Seconds remaining on question timer

**Client action:**
- Update score display for both players
- Update progress bar if timer included

---

### 5. Opponent Disconnect

Sent when opponent's WebSocket closes unexpectedly.

```json
{
  "type": "opponent_disconnect",
  "reason": "connection_lost",
  "you_win": true
}
```

**Fields:**
- `reason` (string): One of: "connection_lost", "timeout", "forfeit"
- `you_win` (boolean): Whether remaining player wins by forfeit

**Client action:**
- Show modal: "Opponent disconnected: {reason}"
- If `you_win` is true, show "You win by forfeit!" and navigate home after 5s
- If `you_win` is false, wait for potential reconnection (30s grace period)

**Grace Period:**
- Server waits 30 seconds before declaring forfeit
- If opponent reconnects within 30s, match resumes
- After 30s, sends `match_end` with forfeit winner

---

### 6. Match End

Sent when match concludes (5 questions complete or forfeit).

```json
{
  "type": "match_end",
  "winner_id": "uuid-of-winner",
  "final_scores": {
    "p1": 5,
    "p2": 3
  },
  "mmr_changes": {
    "uuid-player1": {
      "old": 1000,
      "new": 1032
    },
    "uuid-player2": {
      "old": 1020,
      "new": 988
    }
  }
}
```

**Fields:**
- `winner_id` (string|null): UUID of winning player, null for draw
- `final_scores` (object): Final scores for both players
- `mmr_changes` (object): MMR changes for both players (keyed by player UUID)

**Client action:**
- Show victory/defeat/draw screen
- Display final scores
- Show MMR change (+32 or -32)
- Close WebSocket connection
- Navigate to results page or home

---

## Error Handling

### Server Errors

If server encounters an error, it sends:

```json
{
  "type": "error",
  "message": "Error description"
}
```

**Common errors:**
- "Invalid message format"
- "Question not found"
- "Match not found"
- "Unauthorized"

**Client action:**
- Log error to console
- Show user-friendly toast: "Game error occurred"
- Don't crash UI

### Connection Errors

**WebSocket `onerror` event:**
- Log to console
- Show toast: "Connection error, please try again"
- Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s)

**WebSocket `onclose` event:**
- If match not ended, show "Connection lost" toast
- Attempt reconnection (1 retry)
- If reconnection fails, navigate home with error message

---

## Ready Flow Sequence

```
Player 1 connects → sends ready → server broadcasts player_ready(p1)
Player 2 connects → sends ready → server broadcasts player_ready(p2)
Server detects both ready → broadcasts game_start to both
Both clients receive game_start → fetch questions → start countdown
```

**Timing:**
- Ready signal sent immediately on connection
- Game start occurs within 100ms of second player ready
- No artificial delays

---

## Question Flow Sequence

```
Client receives game_start with question_ids
  ↓
Client fetches questions from database (SELECT by ID)
  ↓
Client displays question 1/5 with options
  ↓
Player selects answer → client sends answer_submit
  ↓
Server validates, calculates marks, updates DB
  ↓
Server broadcasts score_update to both players
  ↓
Client sends question_complete
  ↓
Server increments counter, if < 5 continue, if == 5 end match
```

**Important:**
- Server does NOT send questions (only IDs)
- Client fetches questions independently
- Correct answers never sent to client
- Server is source of truth for scoring

---

## Security Notes

1. **Authentication:**
   - JWT validated on connection
   - User must be participant in match
   - Service role not allowed for player connections

2. **Question Data:**
   - Clients fetch questions without `correct_answer` field
   - Server validates answers against authoritative data
   - Client-submitted `marks_earned` is IGNORED (server recalculates)

3. **Score Integrity:**
   - All scoring done server-side
   - Clients only display scores from `score_update` events
   - Database is source of truth

4. **Disconnect Handling:**
   - Server tracks connection state
   - 30-second grace period for reconnections
   - Forfeit only declared after grace period expires

---

## Client Implementation Example

```typescript
import { connectGameWS, sendReady, sendAnswer, sendQuestionComplete } from '@/lib/ws';

const ws = connectGameWS({
  matchId: 'uuid',
  token: 'jwt-token',

  onConnected: (event) => {
    console.log('Connected as', event.player);
    sendReady(ws);
  },

  onGameStart: (event) => {
    console.log('Game starting with questions:', event.question_ids);
    fetchQuestions(event.question_ids);
  },

  onScoreUpdate: (event) => {
    updateScores(event.p1_score, event.p2_score);
  },

  onMatchEnd: (event) => {
    showResults(event);
    ws.close();
  },

  onError: (error) => {
    console.error('WS Error:', error);
    showToast('Game error occurred');
  }
});
```

---

## Testing WebSocket Locally

```bash
# 1. Start dev server
npm run dev

# 2. Open browser console
const ws = new WebSocket('wss://yourproject.supabase.co/functions/v1/game-ws?token=YOUR_JWT&match_id=MATCH_UUID');

ws.onopen = () => ws.send(JSON.stringify({ type: 'ready' }));
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));

# 3. Test ready flow
# Both players should connect and send ready
# Server should broadcast game_start

# 4. Test answer submission
ws.send(JSON.stringify({
  type: 'answer_submit',
  question_id: 'uuid',
  answer: 2,
  marks_earned: 1
}));

# 5. Verify score_update received
```

---

## Performance Characteristics

- **Latency:** < 100ms for message round-trip (server in same region)
- **Throughput:** Handles 100+ concurrent matches per server instance
- **Message Size:** < 1KB per message (efficient JSON)
- **Connection Lifetime:** 5-10 minutes typical match duration
- **Reconnection:** Supported with 30s grace period

---

## Future Enhancements (Not Currently Implemented)

- Server-side timer synchronization (currently client-side timer)
- Spectator mode (watch live matches)
- Replay system (review past matches)
- Mid-match pause/resume
- Voice/text chat integration
- Tournament bracket support
