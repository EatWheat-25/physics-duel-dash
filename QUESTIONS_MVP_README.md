# Questions MVP Integration

This document describes the MVP implementation for integrating the question system with real-time matchmaking.

## What's Implemented

### 1. Database Schema (Migration: 20251115044021)

- **match_questions table**: Tracks which questions are used in each match
  - Prevents duplicate questions within a match
  - Records ordinal (question sequence)
  
- **matches_new columns**: Added `subject`, `chapter`, `rank_tier` for filtering
  
- **questions table**: Added constraints and indexes
  - Steps must be a JSONB array
  - Indexes on `(subject, chapter)`, `rank_tier`, and `(level, difficulty)`

### 2. Database Functions

#### `upsert_questions(jsonb)`
- **Security**: SECURITY DEFINER, service_role only
- **Purpose**: Idempotent seeding of questions
- **Usage**: Called by seed scripts to insert/update questions

#### `pick_next_question_v2(match_id uuid)`
- **Security**: SECURITY DEFINER, authenticated users
- **Purpose**: Select next question with 3-tier fallback
- **Returns**: `{ question_id, ordinal, question }` as JSONB
- **Fallback Strategy**:
  1. Tier 1: Match subject + chapter + rank (strict)
  2. Tier 2: Match subject + rank only (relaxed chapter)
  3. Tier 3: Any unused question (fallback)

#### `submit_answer(match_id, question_id, step_id, answer)`
- **Security**: SECURITY DEFINER, authenticated users
- **Purpose**: Server-side answer grading
- **Returns**: `{ is_correct, marks_earned, explanation }`
- **Never leaks correct answers to clients**

### 3. WebSocket Integration

The game-ws function now:
- Calls `pick_next_question_v2` when game starts
- Calls it again after each `question_complete` message
- Uses `submit_answer` RPC for server-side grading
- Broadcasts question data to both players

### 4. Seeding Script

**File**: `scripts/seed-questions.ts`
**Usage**: `npm run seed:questions`

Migrates questions from TypeScript files (a2OnlyQuestions.ts) into the database.

## How to Use

### Initial Setup

1. Run the migration:
   ```bash
   # Migration should auto-run on Supabase, or manually apply
   psql DATABASE_URL < supabase/migrations/20251115044021_questions_mvp_integration.sql
   ```

2. Set environment variables:
   ```bash
   export VITE_SUPABASE_URL="your-project-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

3. Seed initial questions:
   ```bash
   npm run seed:questions
   ```

### During a Match

1. Players join queue (existing flow)
2. Match is created with subject/chapter/rank_tier filters
3. Both players connect via WebSocket
4. When both ready, game starts:
   - Server calls `pick_next_question_v2(match_id)`
   - Question is broadcast to both players
5. Players submit answers:
   - Client sends `answer_submit` message
   - Server calls `submit_answer` RPC
   - Grades answer without leaking correct answer
   - Broadcasts result and updated scores
6. After each question completes:
   - Server calls `pick_next_question_v2` again
   - Next question is delivered
7. After 5 questions, match ends with ELO updates

## Row-Level Security

- **match_questions**: Players can only read questions for their own matches
- **questions**: Authenticated users can read, only service_role can write
- **upsert_questions**: Only callable by service_role
- **pick_next_question_v2** & **submit_answer**: Only callable by authenticated users

## Data Flow

```
Client                  WebSocket              Database
  |                         |                      |
  |----ready message------->|                      |
  |                         |---pick_next_q_v2---->|
  |                         |<----question---------|
  |<----game_start----------|                      |
  |                         |                      |
  |---answer_submit-------->|                      |
  |                         |---submit_answer----->|
  |                         |<----is_correct-------|
  |<--answer_result---------|                      |
  |<--score_update----------|                      |
  |                         |                      |
  |--question_complete----->|                      |
  |                         |---pick_next_q_v2---->|
  |<---next_question--------|<----question---------|
```

## Next Steps (Not in MVP)

- [ ] Capture subject/chapter/rank_tier on enqueue
- [ ] Add chapter selection UI
- [ ] Generate A1 questions using template system
- [ ] Bulk-generate more questions via templates
- [ ] Add validation script for question structure
- [ ] Usage telemetry and analytics
- [ ] Admin queries for sparse topics
- [ ] Alerts for excessive tier-3 fallbacks

## Testing

To verify the system works:

1. Seed at least 10 questions
2. Start two player clients
3. Both join queue (any subject/chapter)
4. Verify match created
5. Both players connect to WebSocket
6. Send "ready" messages
7. Verify question is delivered
8. Submit answers
9. Verify scores update correctly
10. Complete 5 questions
11. Verify match ends with ELO updates

## Troubleshooting

**No questions returned**:
- Check questions table has data
- Verify match has subject/chapter/rank_tier set
- Check match_questions for duplicates

**Answers not grading**:
- Verify submit_answer RPC exists
- Check step_id matches question.steps[].id
- Review match_events for error logs

**WebSocket errors**:
- Check token is valid
- Verify user is in the match (p1 or p2)
- Review server logs in Supabase dashboard
