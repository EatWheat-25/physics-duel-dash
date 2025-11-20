# 3-Phase Round System - Implementation Plan

## Overview

This document outlines the implementation of a 3-phase round system for Online 1v1 matches:
1. **THINKING** (5 minutes) - Players see question, no options
2. **CHOOSING** (15 seconds) - Players see 3 options, must select one
3. **RESULT** - Server grades, shows feedback, advances to next round

## ✅ Completed Steps

### 1. Database Schema (✅ DONE)
- Added phase tracking columns to `match_questions` table:
  - `phase` (thinking/choosing/result)
  - `thinking_started_at`, `choosing_started_at`
  - `thinking_ends_at`, `choosing_ends_at`
  - `p1_answer`, `p2_answer`
  - `p1_answered_at`, `p2_answered_at`
  - `p1_correct`, `p2_correct`

### 2. TypeScript Types (✅ DONE)
- Created `src/types/gameEvents.ts` with:
  - `RoundStartEvent`
  - `PhaseChangeEvent`
  - `RoundResultEvent`
  - `MatchEndEvent`
  - Supporting DTOs

### 3. WebSocket Library (✅ DONE)
- Updated `src/lib/ws.ts` with:
  - New event types in ServerEvent union
  - Callbacks: `onRoundStart`, `onPhaseChange`, `onRoundResult`
  - Message handlers for new events

## 🔨 Implementation Needed

### 4. Edge Function Rewrite (`supabase/functions/game-ws/index.ts`)

The current implementation uses a simple auto-advance system. It needs to be replaced with a timer-driven 3-phase system.

#### Current Flow (TO REPLACE):
```
Both players ready
  → Fetch question
  → Send game_start
  → Wait for both answers
  → Send answer_result + score_update
  → Auto-advance after 2 seconds
```

#### New Flow (TO IMPLEMENT):
```
Both players ready
  → Start ROUND (Phase 1: THINKING)
  → Set 5-minute timer
  → Send ROUND_START event
  ↓
After 5 minutes (or manual advance for dev)
  → Transition to Phase 2: CHOOSING
  → Set 15-second timer
  → Send PHASE_CHANGE event
  ↓
After 15 seconds OR both players submit
  → Transition to Phase 3: RESULT
  → Grade answers via submit_answer
  → Send ROUND_RESULT event
  → Update tug-of-war
  ↓
If match not over:
  → Start new ROUND (repeat from top)
Else:
  → Send MATCH_END event
```

#### Key Implementation Details:

**A. GameState Interface (UPDATE)**
```typescript
interface GameState {
  matchId: string
  p1Socket: WebSocket | null
  p2Socket: WebSocket | null
  p1Ready: boolean
  p2Ready: boolean
  currentRound: number
  p1Score: number
  p2Score: number
  gameActive: boolean
  roundsPerMatch: number
  
  // Round-specific state
  currentPhase: 'thinking' | 'choosing' | 'result'
  currentQuestionId: string | null
  currentQuestion: any | null
  thinkingTimer: number | null  // setTimeout ID
  choosingTimer: number | null  // setTimeout ID
  p1Answer: number | null
  p2Answer: number | null
}
```

**B. Start Round Function (NEW)**
```typescript
async function startRound(game: GameState, matchId: string, supabase: SupabaseClient) {
  console.log(`[${matchId}] Starting round ${game.currentRound}`)
  
  // Fetch question
  const questionData = await fetchNextQuestion(supabase, matchId)
  if (!questionData) {
    // Handle error
    return
  }
  
  game.currentQuestionId = questionData.question_id
  game.currentQuestion = questionData.question
  game.currentPhase = 'thinking'
  game.p1Answer = null
  game.p2Answer = null
  
  // Update DB
  const thinkingEndsAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  await supabase
    .from('match_questions')
    .update({
      phase: 'thinking',
      thinking_started_at: new Date().toISOString(),
      thinking_ends_at: thinkingEndsAt.toISOString()
    })
    .eq('match_id', matchId)
    .eq('question_id', questionData.question_id)
  
  // Send ROUND_START event
  const roundStartMsg = {
    type: 'ROUND_START',
    matchId,
    roundIndex: game.currentRound,
    phase: 'thinking',
    question: questionData.question,
    thinkingEndsAt: thinkingEndsAt.toISOString()
  }
  game.p1Socket?.send(JSON.stringify(roundStartMsg))
  game.p2Socket?.send(JSON.stringify(roundStartMsg))
  
  // Set timer for phase transition
  game.thinkingTimer = setTimeout(() => {
    transitionToChoosing(game, matchId, supabase)
  }, 5 * 60 * 1000) // 5 minutes
}
```

**C. Transition to Choosing (NEW)**
```typescript
async function transitionToChoosing(game: GameState, matchId: string, supabase: SupabaseClient) {
  console.log(`[${matchId}] Transitioning to CHOOSING phase`)
  
  game.currentPhase = 'choosing'
  const choosingEndsAt = new Date(Date.now() + 15 * 1000) // 15 seconds
  
  // Update DB
  await supabase
    .from('match_questions')
    .update({
      phase: 'choosing',
      choosing_started_at: new Date().toISOString(),
      choosing_ends_at: choosingEndsAt.toISOString()
    })
    .eq('match_id', matchId)
    .eq('question_id', game.currentQuestionId)
  
  // Extract options from question (first step, first 3 options)
  const options = game.currentQuestion.steps[0].options.slice(0, 3).map((text: string, idx: number) => ({
    id: idx,
    text
  }))
  
  // Send PHASE_CHANGE event
  const phaseChangeMsg = {
    type: 'PHASE_CHANGE',
    matchId,
    roundIndex: game.currentRound,
    phase: 'choosing',
    choosingEndsAt: choosingEndsAt.toISOString(),
    options
  }
  game.p1Socket?.send(JSON.stringify(phaseChangeMsg))
  game.p2Socket?.send(JSON.stringify(phaseChangeMsg))
  
  // Set timer for result phase
  game.choosingTimer = setTimeout(() => {
    transitionToResult(game, matchId, supabase)
  }, 15 * 1000) // 15 seconds
}
```

**D. Answer Submit Handler (UPDATE)**
```typescript
case 'answer_submit': {
  const { question_id, answer } = message
  
  // Verify phase
  if (game.currentPhase !== 'choosing') {
    console.log(`[${matchId}] Answer submitted during wrong phase: ${game.currentPhase}`)
    socket.send(JSON.stringify({ type: 'error', message: 'Not in choosing phase' }))
    return
  }
  
  // Store answer
  if (isP1) {
    game.p1Answer = answer
  } else {
    game.p2Answer = answer
  }
  
  console.log(`[${matchId}] ${isP1 ? 'P1' : 'P2'} submitted answer: ${answer}`)
  
  // If both answered, immediately transition to result
  if (game.p1Answer !== null && game.p2Answer !== null) {
    console.log(`[${matchId}] Both players answered, transitioning to RESULT`)
    clearTimeout(game.choosingTimer!)
    transitionToResult(game, matchId, supabase)
  }
  
  break
}
```

**E. Transition to Result (NEW)**
```typescript
async function transitionToResult(game: GameState, matchId: string, supabase: SupabaseClient) {
  console.log(`[${matchId}] Transitioning to RESULT phase`)
  
  game.currentPhase = 'result'
  
  // Update DB
  await supabase
    .from('match_questions')
    .update({
      phase: 'result'
    })
    .eq('match_id', matchId)
    .eq('question_id', game.currentQuestionId)
  
  // Get correct answer from question
  const correctAnswer = game.currentQuestion.steps[0].correctAnswer
  
  // Grade answers
  const p1IsCorrect = game.p1Answer === correctAnswer
  const p2IsCorrect = game.p2Answer === correctAnswer
  
  const marksPerQuestion = game.currentQuestion.steps[0].marks
  const p1Marks = p1IsCorrect ? marksPerQuestion : 0
  const p2Marks = p2IsCorrect ? marksPerQuestion : 0
  
  game.p1Score += p1Marks
  game.p2Score += p2Marks
  
  // Update DB with results
  await supabase
    .from('match_questions')
    .update({
      p1_answer: game.p1Answer,
      p2_answer: game.p2Answer,
      p1_correct: p1IsCorrect,
      p2_correct: p2IsCorrect
    })
    .eq('match_id', matchId)
    .eq('question_id', game.currentQuestionId)
  
  // Calculate tug-of-war
  const tugOfWar = game.p1Score - game.p2Score
  
  // Send ROUND_RESULT event
  const roundResultMsg = {
    type: 'ROUND_RESULT',
    matchId,
    roundIndex: game.currentRound,
    questionId: game.currentQuestionId,
    correctOptionId: correctAnswer,
    playerResults: [
      {
        playerId: match.p1,
        selectedOptionId: game.p1Answer,
        isCorrect: p1IsCorrect
      },
      {
        playerId: match.p2,
        selectedOptionId: game.p2Answer,
        isCorrect: p2IsCorrect
      }
    ],
    tugOfWar,
    p1Score: game.p1Score,
    p2Score: game.p2Score
  }
  game.p1Socket?.send(JSON.stringify(roundResultMsg))
  game.p2Socket?.send(JSON.stringify(roundResultMsg))
  
  // Wait 3 seconds, then advance
  setTimeout(() => {
    game.currentRound++
    
    if (game.currentRound >= game.roundsPerMatch) {
      endMatch(game, matchId, supabase, match)
    } else {
      startRound(game, matchId, supabase)
    }
  }, 3000)
}
```

**F. End Match (UPDATE)**
```typescript
async function endMatch(game: GameState, matchId: string, supabase: SupabaseClient, match: any) {
  console.log(`[${matchId}] Match ending`)
  
  const winnerId = game.p1Score > game.p2Score ? match.p1 : 
                   game.p2Score > game.p1Score ? match.p2 : null
  
  // Update match in DB
  await supabase
    .from('matches_new')
    .update({
      state: 'ended',
      winner_id: winnerId,
      p1_score: game.p1Score,
      p2_score: game.p2Score,
      ended_at: new Date().toISOString()
    })
    .eq('id', matchId)
  
  // Calculate MMR changes (simplified)
  // ... existing ELO logic ...
  
  // Send MATCH_END event
  const matchEndMsg = {
    type: 'MATCH_END',
    matchId,
    winnerPlayerId: winnerId,
    summary: {
      roundsPlayed: game.currentRound,
      finalScores: {
        p1: game.p1Score,
        p2: game.p2Score
      }
    }
  }
  game.p1Socket?.send(JSON.stringify(matchEndMsg))
  game.p2Socket?.send(JSON.stringify(matchEndMsg))
  
  // Cleanup
  games.delete(matchId)
}
```

### 5. Frontend Updates

#### A. QuestionViewer (`src/components/questions/QuestionViewer.tsx`)

Add props:
```typescript
interface QuestionViewerProps {
  questions: StepBasedQuestion[];
  onFinished?: () => void;
  // New: Online mode props
  mode?: 'practice' | 'online';
  phase?: 'thinking' | 'choosing' | 'result';
  onSubmitAnswer?: (questionId: string, optionIndex: number) => void;
  selectedOptionId?: number | null;
  correctOptionId?: number | null;
  locked?: boolean;
}
```

Render logic:
```typescript
// In thinking phase
if (mode === 'online' && phase === 'thinking') {
  return (
    <div>
      <h2>{question.title}</h2>
      <p>{question.questionText}</p>
      <p className="text-muted-foreground">
        Think about your approach. Options will appear soon.
      </p>
      {/* NO OPTIONS SHOWN */}
    </div>
  )
}

// In choosing phase
if (mode === 'online' && phase === 'choosing') {
  const options = question.steps[0].options.slice(0, 3)
  return (
    <div>
      <h2>{question.title}</h2>
      <p>{question.questionText}</p>
      
      {/* Show 3 options */}
      {options.map((text, idx) => (
        <button
          key={idx}
          onClick={() => handleSelect(idx)}
          disabled={locked || selectedOptionId !== null}
          className={selectedOptionId === idx ? 'selected' : ''}
        >
          {String.fromCharCode(65 + idx)}: {text}
        </button>
      ))}
      
      <button
        onClick={() => onSubmitAnswer?.(question.id, selectedOptionId!)}
        disabled={selectedOptionId === null || locked}
      >
        Submit Answer
      </button>
    </div>
  )
}

// In result phase
if (mode === 'online' && phase === 'result') {
  const options = question.steps[0].options.slice(0, 3)
  return (
    <div>
      <h2>{question.title}</h2>
      
      {options.map((text, idx) => (
        <div
          key={idx}
          className={
            idx === correctOptionId ? 'correct' :
            idx === selectedOptionId ? 'wrong' : ''
          }
        >
          {String.fromCharCode(65 + idx)}: {text}
          {idx === correctOptionId && ' ✓'}
          {idx === selectedOptionId && idx !== correctOptionId && ' ✗'}
        </div>
      ))}
      
      <p>Waiting for next round...</p>
    </div>
  )
}
```

#### B. OnlineBattle (`src/components/OnlineBattle.tsx`)

Add state:
```typescript
const [currentPhase, setCurrentPhase] = useState<'thinking' | 'choosing' | 'result'>('thinking')
const [currentRound, setCurrentRound] = useState(0)
const [thinkingEndsAt, setThinkingEndsAt] = useState<string | null>(null)
const [choosingEndsAt, setChoosingEndsAt] = useState<string | null>(null)
const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
const [correctAnswer, setCorrectAnswer] = useState<number | null>(null)
const [lastRoundResult, setLastRoundResult] = useState<any>(null)
```

Add handlers:
```typescript
onRoundStart: (event) => {
  console.log('[OnlineBattle] ROUND_START', event)
  setCurrentPhase('thinking')
  setCurrentRound(event.roundIndex)
  setThinkingEndsAt(event.thinkingEndsAt)
  setQuestions([formatQuestion(event.question)])
  setSelectedAnswer(null)
  setCorrectAnswer(null)
},

onPhaseChange: (event) => {
  console.log('[OnlineBattle] PHASE_CHANGE', event)
  setCurrentPhase(event.phase)
  if (event.phase === 'choosing') {
    setChoosingEndsAt(event.choosingEndsAt)
  }
},

onRoundResult: (event) => {
  console.log('[OnlineBattle] ROUND_RESULT', event)
  setCurrentPhase('result')
  setCorrectAnswer(event.correctOptionId)
  setLastRoundResult(event)
  
  // Update tug-of-war
  setMatch(prev => prev ? {
    ...prev,
    p1_score: event.p1Score,
    p2_score: event.p2Score
  } : null)
},
```

Add timer display:
```typescript
const [timeLeft, setTimeLeft] = useState(0)

useEffect(() => {
  if (currentPhase === 'thinking' && thinkingEndsAt) {
    const interval = setInterval(() => {
      const now = Date.now()
      const end = new Date(thinkingEndsAt).getTime()
      const diff = Math.max(0, Math.floor((end - now) / 1000))
      setTimeLeft(diff)
    }, 1000)
    return () => clearInterval(interval)
  } else if (currentPhase === 'choosing' && choosingEndsAt) {
    const interval = setInterval(() => {
      const now = Date.now()
      const end = new Date(choosingEndsAt).getTime()
      const diff = Math.max(0, Math.floor((end - now) / 1000))
      setTimeLeft(diff)
    }, 1000)
    return () => clearInterval(interval)
  }
}, [currentPhase, thinkingEndsAt, choosingEndsAt])
```

Render:
```typescript
return (
  <div>
    {/* Header with timer */}
    <div>
      Round {currentRound + 1} - {currentPhase.toUpperCase()}
      {currentPhase === 'thinking' && <div>Thinking time: {Math.floor(timeLeft / 60)}:{timeLeft % 60}</div>}
      {currentPhase === 'choosing' && <div>Choose now: {timeLeft}s</div>}
    </div>
    
    {/* Tug-of-war bar */}
    <TugOfWarBar position={tugPosition} />
    
    {/* Question viewer */}
    <QuestionViewer
      questions={questions}
      mode="online"
      phase={currentPhase}
      onSubmitAnswer={handleSubmitAnswer}
      selectedOptionId={selectedAnswer}
      correctOptionId={correctAnswer}
      locked={currentPhase === 'result'}
    />
  </div>
)
```

## Testing Checklist

- [ ] Database migration applied
- [ ] Types compile without errors
- [ ] Edge Function deploys successfully
- [ ] Two players can join a match
- [ ] ROUND_START event received, thinking phase shown
- [ ] Timer counts down from 5 minutes
- [ ] After 5 minutes (or dev fast-forward), PHASE_CHANGE to choosing
- [ ] Options appear, 15-second timer starts
- [ ] Both players can submit answers
- [ ] ROUND_RESULT shows correct/incorrect
- [ ] Tug-of-war bar updates
- [ ] Next round starts automatically
- [ ] After configured rounds, MATCH_END received
- [ ] Practice mode still works unchanged

## Dev Testing Shortcuts

For faster testing, temporarily reduce timers:
```typescript
// In Edge Function
const THINKING_TIME_MS = 10 * 1000 // 10 seconds instead of 5 minutes
const CHOOSING_TIME_MS = 5 * 1000  // 5 seconds instead of 15 seconds
```

Remember to revert before production!

## Notes

- Keep existing Practice mode untouched
- All timing is server-authoritative
- Frontend timers are for display only
- Answer validation happens server-side
- Database stores complete round history

