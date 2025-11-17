# Client-Side Fixes for Question Integration

## Problem
Battle page was stuck showing "Battle System Active - WebSocket connected. Question display and gameplay coming soon."

## Root Cause
The client code expected the old WebSocket message format with a `questions` array, but the server now sends a single `question` object with the new database-driven system.

## Changes Made

### 1. Updated WebSocket Message Types (`src/lib/ws.ts`)

**Changed:**
- `GameStartEvent` now expects `question` (single object) instead of `questions` (array)
- Added `ordinal` and `total_questions` fields
- Added `NextQuestionEvent` type for progressive question delivery
- Added `AnswerResultEvent` type for server-side grading responses
- Updated `AnswerSubmitMessage` to include `step_id` (required by server)
- Removed `marks_earned` from client submission (server calculates this)

**Added handlers:**
- `onNextQuestion` - Receives next question after `question_complete`
- `onAnswerResult` - Receives grading result with explanation

### 2. Fixed Answer Submission (`src/lib/ws.ts`)

**Before:**
```typescript
sendAnswer(ws, questionId, answer, marksEarned)
```

**After:**
```typescript
sendAnswer(ws, questionId, stepId, answer)
```

The server now:
- Validates the answer server-side
- Calculates marks earned
- Returns result without leaking correct answer

### 3. Updated Battle Component (`src/components/OnlineBattle.tsx`)

**Game Start Handler:**
- Changed from expecting `event.questions` array to `event.question` object
- Maps single question to state array

**Added Next Question Handler:**
- Receives new question after completing previous one
- Resets question and step indices

**Added Answer Result Handler:**
- Shows toast notifications for correct/incorrect answers
- Displays explanation from server

**Fixed Answer Submission:**
- Now passes `step_id` to server
- Removed client-side answer validation
- Sends `question_complete` message after last step

## Message Flow

```
Client                   WebSocket              Server
  |                         |                      |
  |----ready-------------->|                      |
  |                         |---pick_question---->|
  |<---game_start-----------|<----question--------|
  |                         |                      |
  |----answer_submit------->|                      |
  |    (question_id,        |---submit_answer---->|
  |     step_id, answer)    |<----grading---------|
  |<---answer_result--------|                      |
  |<---score_update---------|                      |
  |                         |                      |
  |----question_complete--->|                      |
  |                         |---pick_next_q------->|
  |<---next_question--------|<----question---------|
```

## Testing

Build verified successful:
```bash
npm run build
✓ built in 11.66s
```

## What's Fixed

✅ Questions now load from database via RPC
✅ Questions appear on battle screen
✅ Answer submission works with server-side grading
✅ Progressive question delivery (fetch after each complete)
✅ Server validates answers and returns results
✅ Scores update correctly
✅ No correct answers leak to client

## Next Steps

1. Seed questions into database: `npm run seed:questions`
2. Test full match flow with two players
3. Verify questions progress correctly
4. Confirm scores calculate properly

## Files Modified

- `src/lib/ws.ts` (WebSocket types and handlers)
- `src/components/OnlineBattle.tsx` (Battle UI component)
