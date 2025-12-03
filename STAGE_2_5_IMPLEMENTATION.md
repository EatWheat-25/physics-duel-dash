# Stage 2.5: Runtime Flow Implementation Summary

## Overview

Implemented the complete runtime flow for 1v1 matches on top of Stage 2 foundations. Matches can now start, create rounds, accept answers, evaluate rounds, and loop until completion.

## WebSocket Message Flow

### Client → Server Messages

1. **JOIN_MATCH** (existing)
   - Sent when WebSocket connects
   - Triggers match start and first round creation

2. **SUBMIT_ROUND_ANSWER** (new)
   ```typescript
   {
     type: 'SUBMIT_ROUND_ANSWER',
     matchId: string,
     roundId: string,
     payload: {
       version: 1,
       steps: Array<{
         step_index: number,
         answer_index: number,
         response_time_ms: number
       }>
     }
   }
   ```

### Server → Client Messages

1. **MATCH_START**
   - Sent once when match transitions to 'in_progress' and first round is created
   - Contains: `matchId`, `roundId`, `roundNumber`

2. **ROUND_START**
   - Sent when a new round/question is ready
   - Contains: `matchId`, `roundId`, `roundNumber`, `question` (StepBasedQuestion format)

3. **ROUND_RESULT**
   - Sent after round evaluation completes
   - Contains: `roundWinnerId`, `player1RoundScore`, `player2RoundScore`, `matchContinues`, `matchWinnerId`

4. **MATCH_FINISHED**
   - Sent when match completes
   - Contains: `winnerId`, `player1FinalScore`, `player2FinalScore`, `totalRounds`

5. **GAME_ERROR** (existing)
   - Sent on errors

## Complete Flow Sequence

### 1. Lobby → Match Start
```
Player1 connects → JOIN_MATCH
  ↓
Server: Load match (status='pending')
  ↓
Server: Call start_match(matchId, player1Id) RPC
  ↓
Server: Pick question via pickQuestionForMatch()
  ↓
Server: Insert match_rounds row (round_number=1, status='active')
  ↓
Server: Broadcast MATCH_START
  ↓
Server: Broadcast ROUND_START with question
```

### 2. Round → Answers
```
Both players receive ROUND_START
  ↓
Players select answers per step
  ↓
Player sends SUBMIT_ROUND_ANSWER
  ↓
Server: Call submit_round_answer(matchId, roundId, playerId, payload) RPC
  ↓
Server: Check if both players answered
  ↓
When both answered: Call evaluate_round(matchId, roundId) RPC
```

### 3. Round Evaluation
```
Server receives evaluate_round result
  ↓
Server: Broadcast ROUND_RESULT
  ↓
If match_continues = false:
  ├─ Call finish_match(matchId) RPC
  └─ Broadcast MATCH_FINISHED
  ↓
If match_continues = true:
  ├─ Pick next question
  ├─ Create new match_rounds row (round_number = previous + 1)
  └─ Broadcast new ROUND_START
```

### 4. Match Finished
```
Both players receive MATCH_FINISHED
  ↓
Frontend shows final summary (winner, scores, total rounds)
```

## Files Changed

### 1. `supabase/functions/game-ws/index.ts`
- **Updated `handleJoinMatch`**: Now calls `start_match` RPC if match is pending, creates first round
- **Added `handleSubmitRoundAnswer`**: Processes answer submission, calls `submit_round_answer` RPC, triggers evaluation
- **Added `broadcastToMatch`**: Helper to send messages to all sockets in a match
- **Added `pickQuestionForMatch`**: Queries questions by subject/level, avoids duplicates
- **Added `createRound`**: Creates new match_rounds row with question
- **Added `checkAndEvaluateRound`**: Checks if both answered, calls `evaluate_round`, handles match continuation/completion

### 2. `src/hooks/useMatchFlow.ts` (new)
- Manages WebSocket connection and match state
- Tracks: match, currentRound, currentQuestion, roundResult, isMatchFinished
- Tracks: playerAnswers (Map<stepIndex, answerIndex>), responseTimes (Map<stepIndex, time>)
- Handles all WebSocket message types (MATCH_START, ROUND_START, ROUND_RESULT, MATCH_FINISHED, GAME_ERROR)
- Provides: `connect`, `disconnect`, `setAnswer`, `startStepTimer`, `stopStepTimer`, `submitRoundAnswer`

### 3. `src/pages/OnlineBattleNew.tsx`
- Refactored to use `useMatchFlow` hook
- Displays: round number, scores, target points, max rounds
- Renders question with step-by-step navigation
- Shows round result when available
- Shows match finished screen with winner/scores

### 4. `src/types/schema.ts`
- Updated `MatchRow` to include new scoring fields: `target_points`, `max_rounds`, `player1_score`, `player2_score`, `winner_id`, `started_at`, `completed_at`, `current_round_number`, `rules_version`
- Updated `MatchRow.status` to include `'in_progress'` and `'abandoned'`
- Updated `MatchRoundRow` to include: `round_number`, `player1_round_score`, `player2_round_score`, `player1_answered_at`, `player2_answered_at`, `player1_answer_payload`, `player2_answer_payload`, `round_deadline`
- Updated `MatchRoundRow.status` to include `'evaluating'`

## TODOs Left in Code

1. `// TODO: Implement real scoring logic in submit_round_answer RPC` (in game-ws)
2. `// TODO: Add proper timeout handling (round_deadline enforcement)` (in game-ws)
3. `// TODO: Add reconnection logic for dropped WebSocket connections` (in game-ws)
4. `// TODO: Add round timeout auto-evaluation (currently only evaluates when both answered)` (in game-ws)

## Testing

### Manual Test Steps

1. **Create test match** (in Supabase SQL editor):
```sql
-- Replace with actual user IDs
INSERT INTO public.matches (
  player1_id, 
  player2_id, 
  status, 
  subject, 
  mode, 
  target_points, 
  max_rounds
) VALUES (
  'user1-uuid'::uuid,
  'user2-uuid'::uuid,
  'pending',
  'math',
  'A2',
  5,
  9
) RETURNING id;
```

2. **Open OnlineBattleNew** in two browser tabs:
   - Tab 1: Logged in as user1, navigate to `/online-battle-new/{matchId}`
   - Tab 2: Logged in as user2, navigate to `/online-battle-new/{matchId}`

3. **Verify sequence**:
   - ✅ Both tabs show "Connecting to battle..."
   - ✅ Both receive ROUND_START with question
   - ✅ Each player selects answers and clicks "Submit Answer"
   - ✅ After both submit, ROUND_RESULT appears
   - ✅ Scores update, new round starts (if match continues)
   - ✅ Process repeats until target_points or max_rounds reached
   - ✅ MATCH_FINISHED appears with final summary

### Database Verification

```sql
-- Check match status
SELECT id, status, player1_score, player2_score, current_round_number, winner_id
FROM public.matches
WHERE id = 'match-id-here';

-- Check rounds
SELECT id, round_number, status, player1_round_score, player2_round_score,
       player1_answered_at IS NOT NULL as p1_answered,
       player2_answered_at IS NOT NULL as p2_answered
FROM public.match_rounds
WHERE match_id = 'match-id-here'
ORDER BY round_number;
```

## Key Implementation Details

### Question Mapping
- Edge function sends question data in StepBasedQuestion-compatible format
- Frontend `questionMapper` handles full transformation
- Supports both simple (text, steps) and complex (title, question_text, etc.) question structures

### Answer Payload Format
```json
{
  "version": 1,
  "steps": [
    { "step_index": 0, "answer_index": 2, "response_time_ms": 1200 },
    { "step_index": 1, "answer_index": 0, "response_time_ms": 800 }
  ]
}
```

### Scoring (Placeholder)
- Currently all round scores are 0 (placeholder in `submit_round_answer` RPC)
- Structure is ready for real scoring logic to be added later
- Win condition: first to `target_points` (default 5) OR `max_rounds` (default 9) reached

### Concurrency Safety
- `submit_round_answer` RPC uses WHERE conditions to prevent double-submission
- `evaluate_round` RPC uses concurrency guard (UPDATE ... WHERE status='active')
- Only one evaluation per round can succeed

## Next Steps (Future)

1. Implement real scoring logic in `submit_round_answer` RPC
2. Add timeout handling (enforce `round_deadline`)
3. Add reconnection logic for dropped WebSocket connections
4. Add round timeout auto-evaluation
5. Polish UI/UX (animations, better feedback, etc.)

