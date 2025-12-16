import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Minimal Game WebSocket
 * 
 * Only handles:
 * - WebSocket connections
 * - JOIN_MATCH message validation
 * - Connection status tracking
 * - Broadcasting when both players connected
 */

interface GameErrorEvent {
  type: 'GAME_ERROR'
  message: string
}

interface ConnectedEvent {
  type: 'CONNECTED'
  player: 'player1' | 'player2'
  matchId: string
}

interface BothConnectedEvent {
  type: 'BOTH_CONNECTED'
  matchId: string
}

interface RoundStartEvent {
  type: 'ROUND_START'
  matchId: string
  roundId: string
  roundIndex: number
  phase: 'thinking' | 'main_question'
  question: {
    id: string
    title: string
    subject: string
    chapter: string
    level: string
    difficulty: string
    questionText: string
    stem?: string
    totalMarks: number
    steps: Array<{
      id: string
      question: string
      prompt?: string
      options: string[]
      correctAnswer: number
      marks: number
      explanation?: string
    }>
    topicTags?: string[]
    rankTier?: string
  }
  thinkingEndsAt?: string
  mainQuestionEndsAt?: string
  mainQuestionTimerSeconds?: number
  totalSteps?: number
}

interface QuestionReceivedEvent {
  type: 'QUESTION_RECEIVED'
  question: any // Raw question object from questions_v2
  timer_end_at: string // ISO timestamp when timer expires (60 seconds from now)
}

interface AnswerReceivedEvent {
  type: 'ANSWER_RECEIVED'
  player: 'player1' | 'player2'
  waiting_for_opponent: boolean
}

interface PhaseChangeEvent {
  type: 'PHASE_CHANGE'
  matchId: string
  phase: 'steps'
  stepIndex: number
  totalSteps: number
  stepEndsAt: string
  currentStep: {
    id: string
    prompt: string
    options: string[]
    correctAnswer: number
    marks: number
  }
}

interface StepAnswerReceivedEvent {
  type: 'STEP_ANSWER_RECEIVED'
  stepIndex: number
  playerId: string
  waitingForOpponent: boolean
}

interface ResultsReceivedEvent {
  type: 'RESULTS_RECEIVED'
  player1_answer: number | null
  player2_answer: number | null
  correct_answer: number
  player1_correct: boolean
  player2_correct: boolean
  round_winner: string | null
  p1Score?: number
  p2Score?: number
  stepResults?: Array<{
    stepIndex: number
    correctAnswer: number
    p1AnswerIndex: number | null
    p2AnswerIndex: number | null
    p1Marks: number
    p2Marks: number
  }>
  roundNumber?: number
  targetRoundsToWin?: number
  playerRoundWins?: { [playerId: string]: number }
  matchOver?: boolean
  matchWinnerId?: string | null
}

interface MatchFinishedEvent {
  type: 'MATCH_FINISHED'
  winner_id: string | null
  total_rounds: number
}

interface RoundStartedEvent {
  type: 'ROUND_STARTED'
  round_number: number
  last_round_winner: string | null
  consecutive_wins_count: number
}

// Track sockets locally (for broadcasting) - each instance only tracks its own sockets
const sockets = new Map<string, Set<WebSocket>>() // matchId -> Set<WebSocket>

// Track timeouts per match (for cleanup)
const matchTimeouts = new Map<string, number>() // matchId -> timeoutId

// Track game state for multi-step questions
interface GameState {
  currentPhase: 'question' | 'main_question' | 'steps' | 'result'
  currentStepIndex: number
  mainQuestionTimer: number | null // timeout ID
  stepTimers: Map<number, number> // stepIndex -> timeout ID
  mainQuestionEndsAt: string | null
  stepEndsAt: string | null
  playerStepAnswers: Map<string, Map<number, number>> // playerId -> stepIndex -> answerIndex
  currentQuestion: any | null
  p1Id: string | null
  p2Id: string | null
  eliminatedPlayers: Set<string> // playerIds eliminated for this round
  roundNumber: number
  targetRoundsToWin: number
  playerRoundWins: Map<string, number> // playerId -> round wins
}

const gameStates = new Map<string, GameState>() // matchId -> GameState

// Track match-level state (round wins, etc.) for all matches
interface MatchState {
  roundNumber: number
  targetRoundsToWin: number
  playerRoundWins: Map<string, number> // playerId -> round wins
  p1Id: string | null
  p2Id: string | null
}

const matchStates = new Map<string, MatchState>() // matchId -> MatchState

/**
 * Broadcast message to all sockets for a match
 */
function broadcastToMatch(matchId: string, event: any): void {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) {
    console.warn(`[${matchId}] ⚠️ No sockets found for match - cannot broadcast ${event.type}`)
    return
  }

  let sentCount = 0
  matchSockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event))
        sentCount++
      } catch (error) {
        console.error(`[${matchId}] ❌ Error broadcasting ${event.type}:`, error)
      }
    }
  })

  console.log(`[${matchId}] 📊 Broadcast ${event.type} to ${sentCount}/${matchSockets.size} sockets`)
}

/**
 * Check if both players are connected using DATABASE (works across instances)
 * and broadcast BOTH_CONNECTED to all local sockets if so
 */
/**
 * Broadcast a question to all connected players in a match
 * Handles both multi-step and single-step questions
 */
async function broadcastQuestion(
  matchId: string,
  questionDb: any,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) {
    console.warn(`[${matchId}] ⚠️ [WS] No sockets found for match - cannot broadcast question`)
    return
  }
  
  console.log(`[${matchId}] ✅ [WS] Found ${matchSockets.size} socket(s) for match`)

  // Parse steps to check if multi-step
  let steps: any[] = []
  try {
    steps = Array.isArray(questionDb.steps) ? questionDb.steps : JSON.parse(questionDb.steps ?? '[]')
  } catch {
    steps = []
  }

  const isMultiStep = Array.isArray(steps) && steps.length >= 2

  // Get match players for game state
  const { data: matchData } = await supabase
    .from('matches')
    .select('player1_id, player2_id')
    .eq('id', matchId)
    .single()

  if (isMultiStep) {
    // Multi-step question flow
    console.log(`[${matchId}] 📚 Multi-step question detected (${steps.length} steps)`)
    
    // Get or initialize match-level state
    let matchState = matchStates.get(matchId)
    if (!matchState) {
      // First round - initialize match state
      matchState = {
        roundNumber: 1,
        targetRoundsToWin: 4,
        playerRoundWins: new Map(),
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null
      }
      matchStates.set(matchId, matchState)
    } else {
      // New round - increment round number
      matchState.roundNumber = (matchState.roundNumber || 0) + 1
    }

    // Initialize or reset game state for this round
    let gameState = gameStates.get(matchId)
    if (!gameState) {
      gameState = {
        currentPhase: 'main_question',
        currentStepIndex: 0,
        mainQuestionTimer: null,
        stepTimers: new Map(),
        mainQuestionEndsAt: null,
        stepEndsAt: null,
        playerStepAnswers: new Map(),
        currentQuestion: questionDb,
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null,
        eliminatedPlayers: new Set(),
        roundNumber: matchState.roundNumber,
        targetRoundsToWin: matchState.targetRoundsToWin,
        playerRoundWins: new Map(matchState.playerRoundWins) // Copy match-level wins
      }
      gameStates.set(matchId, gameState)
    } else {
      // New round - reset per-round state but keep match state
      gameState.currentPhase = 'main_question'
      gameState.currentStepIndex = 0
      gameState.mainQuestionTimer = null
      gameState.stepTimers.clear()
      gameState.mainQuestionEndsAt = null
      gameState.stepEndsAt = null
      gameState.playerStepAnswers.clear()
      gameState.currentQuestion = questionDb
      gameState.eliminatedPlayers.clear()
      gameState.roundNumber = matchState.roundNumber
      gameState.targetRoundsToWin = matchState.targetRoundsToWin
      gameState.playerRoundWins = new Map(matchState.playerRoundWins) // Sync with match state
    }

    // Read main question timer from metadata or default to 60 seconds
    const mainQuestionTimerSeconds = questionDb.main_question_timer_seconds || 60
    const mainQuestionEndsAt = new Date(Date.now() + mainQuestionTimerSeconds * 1000).toISOString()
    gameState.mainQuestionEndsAt = mainQuestionEndsAt

    // Get round number from match state
    const currentMatchState = matchStates.get(matchId)
    const currentRoundNumber = currentMatchState?.roundNumber || 1

    const roundStartEvent: RoundStartEvent = {
      type: 'ROUND_START',
      matchId,
      roundId: matchId, // Using matchId as roundId for now
      roundIndex: currentRoundNumber - 1, // roundIndex is 0-based
      phase: 'main_question',
      question: {
        id: questionDb.id,
        title: questionDb.title,
        subject: questionDb.subject,
        chapter: questionDb.chapter,
        level: questionDb.level,
        difficulty: questionDb.difficulty,
        questionText: questionDb.question_text || questionDb.stem || '',
        stem: questionDb.question_text || questionDb.stem || questionDb.title,
        totalMarks: questionDb.total_marks || 0,
        steps: steps.map((s: any) => ({
          id: s.id || '',
          question: s.prompt || s.question || '',
          prompt: s.prompt || s.question || '',
          options: Array.isArray(s.options) ? s.options : [],
          correctAnswer: s.correct_answer?.correctIndex ?? s.correctAnswer ?? 0,
          marks: s.marks || 0,
          explanation: s.explanation || undefined
        })),
        topicTags: questionDb.topic_tags || [],
        rankTier: questionDb.rank_tier || undefined
      },
      mainQuestionEndsAt,
      mainQuestionTimerSeconds,
      totalSteps: steps.length
    }

    console.log(`[${matchId}] 📤 [WS] Broadcasting multi-step ROUND_START`, {
      questionId: questionDb.id,
      totalSteps: steps.length
    })
    broadcastToMatch(matchId, roundStartEvent)
    console.log(`[${matchId}] ✅ [WS] ROUND_START broadcast completed`)

    // Start main question timer
    const mainTimerId = setTimeout(() => {
      transitionToSteps(matchId, supabase)
    }, mainQuestionTimerSeconds * 1000) as unknown as number
    
    gameState.mainQuestionTimer = mainTimerId
    console.log(`[${matchId}] ⏰ Started main question timer (${mainQuestionTimerSeconds}s)`)
  } else {
    // Single-step question - use existing flow
    console.log(`[${matchId}] 📝 Single-step question - using existing flow`)
    
    // Initialize or get match state for single-step questions
    // Don't increment round number here - it will be incremented after results
    let matchState = matchStates.get(matchId)
    if (!matchState) {
      // First round - initialize match state
      matchState = {
        roundNumber: 1,
        targetRoundsToWin: 4,
        playerRoundWins: new Map(),
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null
      }
      matchStates.set(matchId, matchState)
    }
    
    // Clear any existing game state (multi-step state)
    cleanupGameState(matchId)

    // Timeout for answer submission (60 seconds / 1 minute)
    const TIMEOUT_SECONDS = 60
    const questionSentTime = Date.now()
    
    // Calculate timer end time (60 seconds from now)
    const timerEndAt = new Date(Date.now() + TIMEOUT_SECONDS * 1000).toISOString()
    
    console.log(`[${matchId}] ⏰ [TIMER] Setting up ${TIMEOUT_SECONDS}s timer for answer submission`)
    console.log(`[${matchId}] ⏰ [TIMER] Timer will expire at: ${timerEndAt}`)
    console.log(`[${matchId}] ⏰ [TIMER] Current time: ${new Date().toISOString()}`)
    
    const questionReceivedEvent: QuestionReceivedEvent = {
      type: 'QUESTION_RECEIVED',
      question: questionDb, // Send raw DB object
      timer_end_at: timerEndAt
    }
    
    console.log(`[${matchId}] 📤 [WS] Broadcasting single-step question`, {
      questionId: questionDb.id,
      timer_end_at: timerEndAt,
      timestamp: new Date().toISOString()
    })
    
    let sentCount = 0
    let failedCount = 0
    matchSockets.forEach((socket, index) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(questionReceivedEvent))
          sentCount++
          console.log(`[${matchId}] ✅ Sent QUESTION_RECEIVED to socket ${index + 1} at ${new Date().toISOString()}`)
        } catch (error) {
          failedCount++
          console.error(`[${matchId}] ❌ Error sending QUESTION_RECEIVED to socket ${index + 1}:`, error)
        }
      } else {
        failedCount++
        console.warn(`[${matchId}] ⚠️ Socket ${index + 1} not ready (readyState: ${socket.readyState})`)
      }
    })
    
    console.log(`[${matchId}] 📊 [WS] QUESTION_RECEIVED sent to ${sentCount}/${matchSockets.size} sockets`)
    console.log(`[${matchId}] 📊 [WS] Failed sends: ${failedCount}`)
    console.log(`[${matchId}] ✅ [WS] QUESTION_RECEIVED broadcast completed at ${new Date().toISOString()}`)
    
    // Update match status
    const { error: statusUpdateError } = await supabase
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', matchId)
      .neq('status', 'in_progress')

    if (statusUpdateError) {
      console.error(`[${matchId}] ❌ Failed to update match status:`, statusUpdateError)
    } else {
      console.log(`[${matchId}] ✅ Match status updated to in_progress`)
    }

    console.log(`[${matchId}] ✅ Question selection and broadcast completed!`)

    // Start timeout for answer submission (60 seconds / 1 minute)
    const timeoutId = setTimeout(async () => {
      const timeoutTriggerTime = Date.now()
      const actualElapsed = Math.floor((timeoutTriggerTime - questionSentTime) / 1000)
      console.log(`[${matchId}] ⏰ [TIMER] Timeout triggered at ${new Date().toISOString()}`)
      console.log(`[${matchId}] ⏰ [TIMER] Expected duration: ${TIMEOUT_SECONDS}s, Actual elapsed: ${actualElapsed}s`)
      console.log(`[${matchId}] ⏰ [TIMER] Time difference: ${actualElapsed - TIMEOUT_SECONDS}s`)
      
      console.log(`[${matchId}] ⏰ [TIMER] Fetching match state for timeout handling...`)
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('player1_answer, player2_answer, results_computed_at, question_sent_at')
        .eq('id', matchId)
        .single()
      
      if (matchError) {
        console.error(`[${matchId}] ❌ [TIMER] Error fetching match during timeout:`, matchError)
        matchTimeouts.delete(matchId)
        return
      }
      
      if (!match) {
        console.error(`[${matchId}] ❌ [TIMER] Match not found during timeout`)
        matchTimeouts.delete(matchId)
        return
      }
      
      const timeSinceQuestion = match.question_sent_at 
        ? Math.floor((Date.now() - new Date(match.question_sent_at).getTime()) / 1000)
        : null
      
      console.log(`[${matchId}] ⏰ [TIMER] Match state at timeout:`)
      console.log(`[${matchId}] ⏰ [TIMER]   - Player1 answer: ${match.player1_answer ?? 'null'}`)
      console.log(`[${matchId}] ⏰ [TIMER]   - Player2 answer: ${match.player2_answer ?? 'null'}`)
      console.log(`[${matchId}] ⏰ [TIMER]   - Results computed: ${match.results_computed_at ? 'YES' : 'NO'}`)
      console.log(`[${matchId}] ⏰ [TIMER]   - Time since question sent: ${timeSinceQuestion ? `${timeSinceQuestion}s` : 'N/A'}`)
      
      // If results not computed and one player hasn't answered
      if (!match.results_computed_at && 
          (match.player1_answer == null || match.player2_answer == null)) {
        const unansweredPlayers = []
        if (match.player1_answer == null) unansweredPlayers.push('player1')
        if (match.player2_answer == null) unansweredPlayers.push('player2')
        console.log(`[${matchId}] ⏰ [TIMER] Applying timeout - unanswered players: ${unansweredPlayers.join(', ')}`)
        
        // Try force_timeout_stage3 first (Stage 3), fallback to force_timeout_stage2 (Stage 2)
        let timeoutError = null
        let timeoutResult = null
        
        const { data: stage3Result, error: stage3Error } = await supabase.rpc('force_timeout_stage3', {
          p_match_id: matchId
        })
        
        if (stage3Error) {
          // Check if RPC function doesn't exist (Stage 3 migration not applied)
          if (stage3Error.code === '42883' || stage3Error.message?.includes('does not exist') || stage3Error.message?.includes('function')) {
            console.log(`[${matchId}] ⚠️ force_timeout_stage3 not found - falling back to force_timeout_stage2`)
            const { data: stage2Result, error: stage2Error } = await supabase.rpc('force_timeout_stage2', {
              p_match_id: matchId
            })
            timeoutError = stage2Error
            timeoutResult = stage2Result
          } else {
            timeoutError = stage3Error
            timeoutResult = stage3Result
          }
        } else {
          timeoutResult = stage3Result
        }
        
        if (timeoutError) {
          console.error(`[${matchId}] ❌ Error applying timeout:`, timeoutError)
          matchTimeouts.delete(matchId)
          return
        }
        
        // Fetch and broadcast results after timeout
        const { data: matchResults } = await supabase
          .from('matches')
          .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner')
          .eq('id', matchId)
          .single()
        
        if (matchResults) {
          const resultsEvent: ResultsReceivedEvent = {
            type: 'RESULTS_RECEIVED',
            player1_answer: matchResults.player1_answer,
            player2_answer: matchResults.player2_answer,
            correct_answer: matchResults.correct_answer,
            player1_correct: matchResults.player1_correct,
            player2_correct: matchResults.player2_correct,
            round_winner: matchResults.round_winner
          }
          broadcastToMatch(matchId, resultsEvent)
        }
      }
      
      matchTimeouts.delete(matchId)
    }, TIMEOUT_SECONDS * 1000) as unknown as number
    
    matchTimeouts.set(matchId, timeoutId)
    console.log(`[${matchId}] ⏰ [TIMER] Started timeout timer (${TIMEOUT_SECONDS}s)`)
    console.log(`[${matchId}] ⏰ [TIMER] Timer ID: ${timeoutId}`)
    console.log(`[${matchId}] ⏰ [TIMER] Timer will expire at: ${timerEndAt}`)
    console.log(`[${matchId}] ⏰ [TIMER] Timer stored in matchTimeouts map`)
  }
}

/**
 * Atomic question selection and broadcast for Stage 1
 * 
 * Ensures both players see the same question by:
 * 1. Checking in-memory GameState.currentQuestion first (idempotent)
 * 2. Checking if question_id already exists (idempotency)
 * 3. Atomically claiming a question using UPDATE ... WHERE question_id IS NULL
 * 4. Filtering for True/False questions (2 options)
 * 5. Broadcasting QUESTION_RECEIVED with raw question object
 */
async function selectAndBroadcastQuestion(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🔒 [WS] selectAndBroadcastQuestion called`)
  
  try {
    // Get match with current_round_id for clearing old results
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('subject, mode, status, winner_id, question_id, question_sent_at, current_round_id, current_round_number, target_rounds_to_win')
      .eq('id', matchId)
      .single()

    if (matchError) {
      console.error(`[${matchId}] ❌ Error fetching match:`, matchError)
      throw matchError
    }

    // Safety checks
    if (!match || match.status !== 'in_progress' || match.winner_id) {
      console.warn(`[${matchId}] ⚠️ [WS] Match not ready for question selection (status: ${match?.status}, winner: ${match?.winner_id})`)
      return
    }
    
    console.log(`[${matchId}] ✅ [WS] Match is ready (status: ${match.status}, winner: ${match.winner_id || 'none'})`)

    // ===== CRITICAL SEQUENCE: Clear old results first =====
    const previousRoundId = match.current_round_id
    if (previousRoundId) {
      console.log(`[${matchId}] 🧹 Clearing old results for round ${previousRoundId}`)
      const { data: clearResult, error: clearError } = await supabase.rpc('clear_round_results', {
        p_match_id: matchId,
        p_expected_round_id: previousRoundId
      })
      
      if (clearError) {
        console.error(`[${matchId}] ❌ Error clearing round results:`, clearError)
        // Continue anyway - clear might have already been done
      } else if (!clearResult?.success && clearResult?.reason !== 'nothing_to_clear') {
        console.warn(`[${matchId}] ⚠️ Clear round results returned:`, clearResult)
      }
    }

    // Calculate new round number
    const newRoundNumber = (match.current_round_number || 0) + 1

    // Select question (reuse existing logic)
    let questionDb: any = null

    if (match.question_id) {
      // Question already assigned, fetch it
      console.log(`[${matchId}] ✅ Question already assigned: ${match.question_id}`)
      const { data: q, error: fetchError } = await supabase
        .from('questions_v2')
        .select('*')
        .eq('id', match.question_id)
        .single()

      if (fetchError || !q) {
        console.error(`[${matchId}] ❌ Failed to fetch existing question:`, fetchError)
        throw new Error(`Failed to fetch question ${match.question_id}`)
      }
      questionDb = q
      console.log(`[${matchId}] ✅ Fetched existing question: ${questionDb.id} - "${questionDb.title}"`)
    } else {
      // No question assigned, try to claim one atomically with tiered filtering
      console.log(`[${matchId}] 🔍 No question assigned, fetching TF questions with tiered filtering...`)

      const subject = match.subject ?? null
      const level = match.mode ?? null // mode = level (A1/A2)

      // Tiered fetching with early filtering
      const fetchTier = async (filters: { subject?: boolean; level?: boolean }) => {
        let q = supabase
          .from('questions_v2')
          .select('*')
          .limit(200)
        
        if (filters.subject && subject) q = q.eq('subject', subject)
        if (filters.level && level) q = q.eq('level', level)
        
        const { data, error } = await q
        
        if (error) {
          console.warn(`[${matchId}] ⚠️ Tier fetch error:`, error)
          return []
        }
        
        return (data ?? []).filter((q: any) => {
          try {
            const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
            return Array.isArray(steps) && steps.length > 0
          } catch {
            return false
          }
        })
      }

      // Fetch in tiers
      const tiers = [
        await fetchTier({ subject: true, level: true }),
        await fetchTier({ subject: true, level: false }),
        await fetchTier({ subject: false, level: true }),
        await fetchTier({ subject: false, level: false })
      ]

      // Filter for True/False questions
      const isTF = (q: any) => {
        try {
          const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
          const first = steps?.[0]
          const opts = first?.options ?? []
          return first?.type === 'true_false' || (Array.isArray(opts) && opts.length === 2)
        } catch {
          return false
        }
      }

      const tfPool = tiers.flatMap(list => list.filter(isTF))

      if (tfPool.length === 0) {
        console.error(`[${matchId}] ❌ No True/False questions available`)
        throw new Error('No True/False questions available')
      }

      const selectedQuestion = tfPool[Math.floor(Math.random() * tfPool.length)]
      console.log(`[${matchId}] 🎯 Selected TF question: ${selectedQuestion.id} - "${selectedQuestion.title}"`)

      // Atomic claim: UPDATE only if question_id IS NULL
      const { data: lock, error: lockError } = await supabase
        .from('matches')
        .update({
          question_sent_at: new Date().toISOString(),
          question_id: selectedQuestion.id,
        })
        .eq('id', matchId)
        .is('question_id', null)
        .select('id, question_id')
        .maybeSingle()

      if (lockError) {
        console.error(`[${matchId}] ❌ Lock error:`, lockError)
        throw lockError
      }

      if (!lock) {
        // Lost race condition
        console.log(`[${matchId}] ⚠️ Lost atomic lock, re-reading question_id...`)
        
        const { data: matchAfterRace } = await supabase
          .from('matches')
          .select('question_id, question_sent_at')
          .eq('id', matchId)
          .single()

        if (!matchAfterRace?.question_id) {
          throw new Error('Failed to claim question and no question found after race')
        }

        const { data: qAfterRace } = await supabase
          .from('questions_v2')
          .select('*')
          .eq('id', matchAfterRace.question_id)
          .single()

        if (!qAfterRace) {
          throw new Error(`Failed to fetch question ${matchAfterRace.question_id} after race`)
        }

        questionDb = qAfterRace
        console.log(`[${matchId}] ✅ Using question claimed by other instance: ${questionDb.id}`)
      } else {
        questionDb = selectedQuestion
        console.log(`[${matchId}] ✅ Won atomic lock, claimed question: ${questionDb.id}`)
      }
    }

    // ===== Create new match_rounds row with question_id (NON-NEGOTIABLE 1: single source of truth) =====
    const { data: newRound, error: roundError } = await supabase
      .from('match_rounds')
      .insert({
        match_id: matchId,
        question_id: questionDb.id, // Single source of truth for question
        round_number: newRoundNumber,
        status: 'main' // For simple questions, will transition to 'results' when computed
      })
      .select('id')
      .single()

    if (roundError || !newRound) {
      console.error(`[${matchId}] ❌ Failed to create match_rounds row:`, roundError)
      throw roundError || new Error('Failed to create match_rounds row')
    }

    console.log(`[${matchId}] ✅ Created match_rounds row: ${newRound.id} for round ${newRoundNumber}`)

    // ===== Update matches with current_round_id and current_round_number =====
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        current_round_id: newRound.id,
        current_round_number: newRoundNumber,
        // Keep question_id for backwards compatibility, but we read from match_rounds.question_id
        question_id: questionDb.id
      })
      .eq('id', matchId)

    if (updateError) {
      console.error(`[${matchId}] ❌ Failed to update matches with round info:`, updateError)
      throw updateError
    }

    console.log(`[${matchId}] ✅ Updated matches.current_round_id = ${newRound.id}, current_round_number = ${newRoundNumber}`)

    // After obtaining questionDb, set it in gameState for idempotency
    const existingGameState = gameStates.get(matchId)
    if (existingGameState) {
      existingGameState.currentQuestion = questionDb
    } else {
      // Get match players for game state initialization
      const { data: matchData } = await supabase
        .from('matches')
        .select('player1_id, player2_id')
        .eq('id', matchId)
        .single()
      
      const newGameState: GameState = {
        currentPhase: 'question',
        currentStepIndex: 0,
        mainQuestionTimer: null,
        stepTimers: new Map(),
        mainQuestionEndsAt: null,
        stepEndsAt: null,
        playerStepAnswers: new Map(),
        currentQuestion: questionDb,
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null,
        eliminatedPlayers: new Set(),
        roundNumber: newRoundNumber,
        targetRoundsToWin: match.target_rounds_to_win || 4,
        playerRoundWins: new Map()
      }
      gameStates.set(matchId, newGameState)
    }
    
    console.log(`[${matchId}] ✅ Selected new question from DB: ${questionDb.id}`)
    await broadcastQuestion(matchId, questionDb, supabase)
  } catch (error) {
    console.error(`[${matchId}] ❌ Error in atomic question selection:`, error)
    
    // Send error to all sockets
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      const errorEvent: GameErrorEvent = {
        type: 'GAME_ERROR',
        message: 'Failed to select question'
      }
      matchSockets.forEach(socket => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify(errorEvent))
          } catch (err) {
            console.error(`[${matchId}] Failed to send error event:`, err)
          }
        }
      })
    }
  }
}

/**
 * Check if both players are connected and broadcast BOTH_CONNECTED if so
 * @returns true if broadcast was successful, false otherwise
 */
async function checkAndBroadcastBothConnected(
  matchId: string,
  match: any,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  // Query database to check connection status (works across all instances!)
  // IMPORTANT: We check RIGHT BEFORE broadcasting to catch disconnects
  const { data: matchStatus, error: statusError } = await supabase
    .from('matches')
    .select('player1_connected_at, player2_connected_at')
    .eq('id', matchId)
    .single()

  if (statusError || !matchStatus) {
    console.error(`[${matchId}] ❌ Failed to query connection status:`, statusError)
    return false
  }

  const player1Connected = matchStatus.player1_connected_at !== null
  const player2Connected = matchStatus.player2_connected_at !== null
  const bothConnected = player1Connected && player2Connected
  
  console.log(`[${matchId}] Checking both connected status (from database):`)
  console.log(`  - Player1 (${match.player1_id}): ${player1Connected ? '✅ Connected' : '❌ Not connected'}`)
  console.log(`  - Player2 (${match.player2_id}): ${player2Connected ? '✅ Connected' : '❌ Not connected'}`)
  console.log(`  - Both connected: ${bothConnected ? '✅ YES' : '❌ NO'}`)

  // If not both connected, return false immediately (don't broadcast)
  if (!bothConnected) {
    const connectedCount = (player1Connected ? 1 : 0) + (player2Connected ? 1 : 0)
    console.log(`[${matchId}] ⏳ Waiting for both players - currently ${connectedCount}/2 connected`)
    return false
  }

  // Both are connected - proceed with broadcast
  console.log(`[${matchId}] ✅ Both players connected! Broadcasting BOTH_CONNECTED to local sockets...`)
  
  const matchSockets = sockets.get(matchId)
  console.log(`[${matchId}] Local socket map has ${matchSockets?.size || 0} socket(s) for this match`)
  
  if (!matchSockets || matchSockets.size === 0) {
    console.warn(`[${matchId}] ⚠️  No local sockets found for match (other instance may have the sockets)`)
    // This is not a failure - the other instance will handle it
    // Return true to prevent infinite retries
    return true
  }

  const bothConnectedMessage: BothConnectedEvent = {
    type: 'BOTH_CONNECTED',
    matchId: matchId
  }
  let sentCount = 0
  let skippedCount = 0
  
  matchSockets.forEach((s, index) => {
    console.log(`[${matchId}] Socket ${index + 1}/${matchSockets.size} readyState: ${s.readyState} (OPEN=1, CONNECTING=0, CLOSING=2, CLOSED=3)`)
    
    if (s.readyState === WebSocket.OPEN) {
      try {
        s.send(JSON.stringify(bothConnectedMessage))
        sentCount++
        console.log(`[${matchId}] ✅ Sent BOTH_CONNECTED to socket ${index + 1}`)
      } catch (error) {
        console.error(`[${matchId}] ❌ Error sending BOTH_CONNECTED to socket ${index + 1}:`, error)
        skippedCount++
      }
    } else {
      console.warn(`[${matchId}] ⚠️  Socket ${index + 1} not ready (readyState: ${s.readyState}), skipping`)
      skippedCount++
    }
  })
  
  console.log(`[${matchId}] 📊 Broadcast summary: ${sentCount} sent, ${skippedCount} skipped, ${matchSockets.size} total`)
  
  // Return true only if we successfully sent to at least one socket
  // This allows retries if broadcast completely failed
  const success = sentCount > 0
  if (!success) {
    console.error(`[${matchId}] ❌ WARNING: Failed to send BOTH_CONNECTED to any socket! Will retry...`)
  }
  
  return success
}
      console.log(`[${matchId}] ⏰ Timeout triggered after ${TIMEOUT_SECONDS}s`)
      
      const { data: match } = await supabase
        .from('matches')
        .select('player1_answer, player2_answer, results_computed_at')
        .eq('id', matchId)
        .single()
      
      if (!match) {
        console.error(`[${matchId}] ❌ Match not found during timeout`)
        matchTimeouts.delete(matchId)
        return
      }
      
      // If results not computed and one player hasn't answered
      if (!match.results_computed_at && 
          (match.player1_answer == null || match.player2_answer == null)) {
        console.log(`[${matchId}] ⏰ Applying timeout - marking unanswered player as wrong`)
        
        // Try force_timeout_stage3 first (Stage 3), fallback to force_timeout_stage2 (Stage 2)
        let timeoutError = null
        let timeoutResult = null
        
        const { data: stage3Result, error: stage3Error } = await supabase.rpc('force_timeout_stage3', {
          p_match_id: matchId
        })
        
        if (stage3Error) {
          // Check if RPC function doesn't exist (Stage 3 migration not applied)
          if (stage3Error.code === '42883' || stage3Error.message?.includes('does not exist') || stage3Error.message?.includes('function')) {
            console.log(`[${matchId}] ⚠️ force_timeout_stage3 not found - falling back to force_timeout_stage2`)
            const { data: stage2Result, error: stage2Error } = await supabase.rpc('force_timeout_stage2', {
              p_match_id: matchId
            })
            timeoutError = stage2Error
            timeoutResult = stage2Result
          } else {
            timeoutError = stage3Error
            timeoutResult = stage3Result
          }
        } else {
          timeoutResult = stage3Result
        }
        
        if (timeoutError) {
          console.error(`[${matchId}] ❌ Error applying timeout:`, timeoutError)
          matchTimeouts.delete(matchId)
          return
        }
        
        // Fetch and broadcast results after timeout
        const { data: matchResults } = await supabase
          .from('matches')
          .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner')
          .eq('id', matchId)
          .single()
        
        if (matchResults) {
          const resultsEvent: ResultsReceivedEvent = {
            type: 'RESULTS_RECEIVED',
            player1_answer: matchResults.player1_answer,
            player2_answer: matchResults.player2_answer,
            correct_answer: matchResults.correct_answer!,
            player1_correct: matchResults.player1_correct!,
            player2_correct: matchResults.player2_correct!,
            round_winner: matchResults.round_winner
          }
          
          broadcastToMatch(matchId, resultsEvent)
          
          // Stage 3: After RESULTS_RECEIVED, check match state and transition
          await handleRoundTransition(matchId, supabase)
        }
      }
      
      // Clean up timeout reference
      matchTimeouts.delete(matchId)
    }, TIMEOUT_SECONDS * 1000)
    
    matchTimeouts.set(matchId, timeoutId)
    console.log(`[${matchId}] ⏰ Started ${TIMEOUT_SECONDS}s timeout for answer submission`)
    }
  } catch (error) {
    console.error(`[${matchId}] ❌ Error in atomic question selection:`, error)
    
    // Send error to all sockets
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      const errorEvent: GameErrorEvent = {
        type: 'GAME_ERROR',
        message: 'Failed to select question'
      }
      matchSockets.forEach(socket => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify(errorEvent))
          } catch (err) {
            console.error(`[${matchId}] Failed to send error event:`, err)
          }
        }
      })
    }
  }
}

/**
 * Check if both players are connected and broadcast BOTH_CONNECTED if so
 * @returns true if broadcast was successful, false otherwise
 */
async function checkAndBroadcastBothConnected(
  matchId: string,
  match: any,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  // Query database to check connection status (works across all instances!)
  // IMPORTANT: We check RIGHT BEFORE broadcasting to catch disconnects
  const { data: matchStatus, error: statusError } = await supabase
    .from('matches')
    .select('player1_connected_at, player2_connected_at')
    .eq('id', matchId)
    .single()

  if (statusError || !matchStatus) {
    console.error(`[${matchId}] ❌ Failed to query connection status:`, statusError)
    return false
  }

  const player1Connected = matchStatus.player1_connected_at !== null
  const player2Connected = matchStatus.player2_connected_at !== null
  const bothConnected = player1Connected && player2Connected
  
  console.log(`[${matchId}] Checking both connected status (from database):`)
  console.log(`  - Player1 (${match.player1_id}): ${player1Connected ? '✅ Connected' : '❌ Not connected'}`)
  console.log(`  - Player2 (${match.player2_id}): ${player2Connected ? '✅ Connected' : '❌ Not connected'}`)
  console.log(`  - Both connected: ${bothConnected ? '✅ YES' : '❌ NO'}`)

  // If not both connected, return false immediately (don't broadcast)
  if (!bothConnected) {
    const connectedCount = (player1Connected ? 1 : 0) + (player2Connected ? 1 : 0)
    console.log(`[${matchId}] ⏳ Waiting for both players - currently ${connectedCount}/2 connected`)
    return false
  }

  // Both are connected - proceed with broadcast
  console.log(`[${matchId}] ✅ Both players connected! Broadcasting BOTH_CONNECTED to local sockets...`)
  
  const matchSockets = sockets.get(matchId)
  console.log(`[${matchId}] Local socket map has ${matchSockets?.size || 0} socket(s) for this match`)
  
  if (!matchSockets || matchSockets.size === 0) {
    console.warn(`[${matchId}] ⚠️  No local sockets found for match (other instance may have the sockets)`)
    // This is not a failure - the other instance will handle it
    // Return true to prevent infinite retries
    return true
  }

  const bothConnectedMessage: BothConnectedEvent = {
    type: 'BOTH_CONNECTED',
    matchId: matchId
  }
  let sentCount = 0
  let skippedCount = 0
  
  matchSockets.forEach((s, index) => {
    console.log(`[${matchId}] Socket ${index + 1}/${matchSockets.size} readyState: ${s.readyState} (OPEN=1, CONNECTING=0, CLOSING=2, CLOSED=3)`)
    
    if (s.readyState === WebSocket.OPEN) {
      try {
        s.send(JSON.stringify(bothConnectedMessage))
        sentCount++
        console.log(`[${matchId}] ✅ Sent BOTH_CONNECTED to socket ${index + 1}`)
      } catch (error) {
        console.error(`[${matchId}] ❌ Error sending BOTH_CONNECTED to socket ${index + 1}:`, error)
        skippedCount++
      }
    } else {
      console.warn(`[${matchId}] ⚠️  Socket ${index + 1} not ready (readyState: ${s.readyState}), skipping`)
      skippedCount++
    }
  })
  
  console.log(`[${matchId}] 📊 Broadcast summary: ${sentCount} sent, ${skippedCount} skipped, ${matchSockets.size} total`)
  
  // Return true only if we successfully sent to at least one socket
  // This allows retries if broadcast completely failed
  const success = sentCount > 0
  if (!success) {
    console.error(`[${matchId}] ❌ WARNING: Failed to send BOTH_CONNECTED to any socket! Will retry...`)
  }
  
  return success
}

/**
 * Cleanup game state for a match
 */
function cleanupGameState(matchId: string): void {
  const state = gameStates.get(matchId)
  if (state) {
    if (state.mainQuestionTimer) {
      clearTimeout(state.mainQuestionTimer)
    }
    state.stepTimers.forEach((timerId) => {
      clearTimeout(timerId)
    })
    gameStates.delete(matchId)
  }
  // Also cleanup match state if match is over
  matchStates.delete(matchId)
}

/**
 * Transition from main question phase to steps phase
 */
async function transitionToSteps(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const state = gameStates.get(matchId)
  if (!state || state.currentPhase !== 'main_question') {
    console.warn(`[${matchId}] ⚠️ Cannot transition to steps - invalid state`)
    return
  }

  // Clear main question timer
  if (state.mainQuestionTimer) {
    clearTimeout(state.mainQuestionTimer)
    state.mainQuestionTimer = null
  }

  state.currentPhase = 'steps'
  state.currentStepIndex = 0
  // Reset eliminated players for new round (should already be clear, but ensure it)
  state.eliminatedPlayers.clear()

  const steps = Array.isArray(state.currentQuestion.steps) 
    ? state.currentQuestion.steps 
    : JSON.parse(state.currentQuestion.steps ?? '[]')
  
  if (steps.length === 0) {
    console.error(`[${matchId}] ❌ No steps found`)
    return
  }

  const currentStep = steps[0]
  const stepEndsAt = new Date(Date.now() + 15 * 1000).toISOString()
  state.stepEndsAt = stepEndsAt

  const phaseChangeEvent: PhaseChangeEvent = {
    type: 'PHASE_CHANGE',
    matchId,
    phase: 'steps',
    stepIndex: 0,
    totalSteps: steps.length,
    stepEndsAt,
    currentStep: {
      id: currentStep.id || '',
      prompt: currentStep.prompt || currentStep.question || '',
      options: Array.isArray(currentStep.options) ? currentStep.options : [],
      correctAnswer: currentStep.correct_answer?.correctIndex ?? currentStep.correctAnswer ?? 0,
      marks: currentStep.marks || 0
    }
  }

  broadcastToMatch(matchId, phaseChangeEvent)

  // Start step timer - on timeout, check for eliminations
  const stepTimerId = setTimeout(() => {
    checkStepTimeout(matchId, 0, supabase)
  }, 15 * 1000) as unknown as number
  
  state.stepTimers.set(0, stepTimerId)
  console.log(`[${matchId}] ⏰ Started step 0 timer (15s)`)
}

/**
 * Check for step timeout and eliminate players who didn't answer
 */
async function checkStepTimeout(
  matchId: string,
  stepIndex: number,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] ⏰ [TIMEOUT] checkStepTimeout called for step ${stepIndex} at ${new Date().toISOString()}`)
  
  const state = gameStates.get(matchId)
  
  // Guard: Skip if state is invalid or we've already moved past this step
  if (!state || state.currentPhase !== 'steps' || state.currentStepIndex !== stepIndex) {
    console.log(`[${matchId}] ⏰ [TIMEOUT] Skipping timeout for step ${stepIndex} - state is stale or already advanced`)
    console.log(`[${matchId}] ⏰ [TIMEOUT]   state exists: ${!!state}, phase: ${state?.currentPhase}, currentStepIndex: ${state?.currentStepIndex}`)
    return
  }

  console.log(`[${matchId}] ⚠️ [TIMEOUT] Step ${stepIndex} timed out - checking for unanswered players`)

  const p1Answers = state.playerStepAnswers.get(state.p1Id || '') || new Map()
  const p2Answers = state.playerStepAnswers.get(state.p2Id || '') || new Map()

  const p1Answered = p1Answers.has(stepIndex)
  const p2Answered = p2Answers.has(stepIndex)
  
  console.log(`[${matchId}] 📊 [TIMEOUT] Answer status at timeout: P1 answered=${p1Answered}, P2 answered=${p2Answered}`)

  // Eliminate players who didn't answer this step
  if (!p1Answered && state.p1Id) {
    state.eliminatedPlayers.add(state.p1Id)
    console.log(`[${matchId}] ❌ [TIMEOUT] Player 1 eliminated - no answer for step ${stepIndex}`)
  }
  if (!p2Answered && state.p2Id) {
    state.eliminatedPlayers.add(state.p2Id)
    console.log(`[${matchId}] ❌ [TIMEOUT] Player 2 eliminated - no answer for step ${stepIndex}`)
  }

  // Move to next step (or results)
  console.log(`[${matchId}] ➡️ [TIMEOUT] Moving to next step after timeout`)
  await moveToNextStep(matchId, supabase)
}

/**
 * Move to next step or calculate results
 */
async function moveToNextStep(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const state = gameStates.get(matchId)
  if (!state || state.currentPhase !== 'steps') {
    console.warn(`[${matchId}] ⚠️ [STEP] Cannot move to next step - invalid state (phase: ${state?.currentPhase})`)
    return
  }

  console.log(`[${matchId}] ➡️ [STEP] moveToNextStep called for step ${state.currentStepIndex}`)

  // Clear current step timer (defensive - may already be cleared in handleStepAnswer)
  const currentTimer = state.stepTimers.get(state.currentStepIndex)
  if (currentTimer) {
    console.log(`[${matchId}] 🔥 [TIMER] Clearing step ${state.currentStepIndex} timer in moveToNextStep (timer ID: ${currentTimer})`)
    clearTimeout(currentTimer)
    state.stepTimers.delete(state.currentStepIndex)
    console.log(`[${matchId}] ✅ [TIMER] Step ${state.currentStepIndex} timer cleared in moveToNextStep`)
  } else {
    console.log(`[${matchId}] ⚠️ [TIMER] Step ${state.currentStepIndex} timer already cleared (cleared in handleStepAnswer - good!)`)
  }

  const steps = Array.isArray(state.currentQuestion.steps) 
    ? state.currentQuestion.steps 
    : JSON.parse(state.currentQuestion.steps ?? '[]')
  
  const nextStepIndex = state.currentStepIndex + 1

  if (nextStepIndex >= steps.length) {
    // All steps done - calculate results
    console.log(`[${matchId}] 🏁 [STEP] All steps complete (${steps.length}/${steps.length}) - calculating results`)
    await calculateStepResults(matchId, supabase)
    return
  }

  // Move to next step
  console.log(`[${matchId}] ⏩ [STEP] Advancing from step ${state.currentStepIndex} to step ${nextStepIndex}`)
  state.currentStepIndex = nextStepIndex
  const currentStep = steps[nextStepIndex]
  const stepEndsAt = new Date(Date.now() + 15 * 1000).toISOString()
  state.stepEndsAt = stepEndsAt

  const phaseChangeEvent: PhaseChangeEvent = {
    type: 'PHASE_CHANGE',
    matchId,
    phase: 'steps',
    stepIndex: nextStepIndex,
    totalSteps: steps.length,
    stepEndsAt,
    currentStep: {
      id: currentStep.id || '',
      prompt: currentStep.prompt || currentStep.question || '',
      options: Array.isArray(currentStep.options) ? currentStep.options : [],
      correctAnswer: currentStep.correct_answer?.correctIndex ?? currentStep.correctAnswer ?? 0,
      marks: currentStep.marks || 0
    }
  }

  console.log(`[${matchId}] 📤 [STEP] Broadcasting PHASE_CHANGE for step ${nextStepIndex}`)
  broadcastToMatch(matchId, phaseChangeEvent)

  // Start timer for next step - on timeout, check for eliminations
  const stepTimerId = setTimeout(() => {
    console.log(`[${matchId}] ⏰ [TIMER] Step ${nextStepIndex} timeout fired - checking for eliminations`)
    checkStepTimeout(matchId, nextStepIndex, supabase)
  }, 15 * 1000) as unknown as number
  
  state.stepTimers.set(nextStepIndex, stepTimerId)
  console.log(`[${matchId}] ⏰ [TIMER] Started step ${nextStepIndex} timer (15s, timer ID: ${stepTimerId})`)
}

/**
 * Calculate results for all steps
 */
async function calculateStepResults(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🧮 [RESULTS] calculateStepResults called at ${new Date().toISOString()}`)
  
  const state = gameStates.get(matchId)
  if (!state) {
    console.warn(`[${matchId}] ⚠️ [RESULTS] Cannot calculate results - no game state`)
    return
  }

  // Clear all timers
  console.log(`[${matchId}] 🔥 [TIMER] Clearing ALL step timers (${state.stepTimers.size} active)`)
  state.stepTimers.forEach((timerId, stepIndex) => {
    console.log(`[${matchId}] 🔥 [TIMER] Clearing timer for step ${stepIndex} (timer ID: ${timerId})`)
    clearTimeout(timerId)
  })
  state.stepTimers.clear()
  console.log(`[${matchId}] ✅ [TIMER] All step timers cleared`)

  const steps = Array.isArray(state.currentQuestion.steps) 
    ? state.currentQuestion.steps 
    : JSON.parse(state.currentQuestion.steps ?? '[]')
  
  const p1Answers = state.playerStepAnswers.get(state.p1Id || '') || new Map()
  const p2Answers = state.playerStepAnswers.get(state.p2Id || '') || new Map()

  let p1Score = 0
  let p2Score = 0
  const stepResults: Array<{
    stepIndex: number
    correctAnswer: number
    p1AnswerIndex: number | null
    p2AnswerIndex: number | null
    p1Marks: number
    p2Marks: number
  }> = []

  steps.forEach((step: any, index: number) => {
    const correctAnswer = step.correct_answer?.correctIndex ?? step.correctAnswer ?? 0
    const marks = step.marks || 0

    const p1Answer = p1Answers.get(index) ?? null
    const p2Answer = p2Answers.get(index) ?? null

    const p1Correct = p1Answer === correctAnswer
    const p2Correct = p2Answer === correctAnswer

    const p1StepMarks = p1Correct ? marks : 0
    const p2StepMarks = p2Correct ? marks : 0

    p1Score += p1StepMarks
    p2Score += p2StepMarks

    stepResults.push({
      stepIndex: index,
      correctAnswer,
      p1AnswerIndex: p1Answer,
      p2AnswerIndex: p2Answer,
      p1Marks: p1StepMarks,
      p2Marks: p2StepMarks
    })
  })

  // Apply elimination penalty: eliminated players get 0 score
  const p1Eliminated = state.eliminatedPlayers.has(state.p1Id || '')
  const p2Eliminated = state.eliminatedPlayers.has(state.p2Id || '')
  
  if (p1Eliminated) {
    p1Score = 0
    console.log(`[${matchId}] ⚠️ Player 1 eliminated - score set to 0`)
  }
  if (p2Eliminated) {
    p2Score = 0
    console.log(`[${matchId}] ⚠️ Player 2 eliminated - score set to 0`)
  }

  // Determine round winner
  const winnerId = p1Score > p2Score ? state.p1Id : p2Score > p1Score ? state.p2Id : null

  // Update round wins in both game state and match state
  if (winnerId) {
    const currentWins = state.playerRoundWins.get(winnerId) || 0
    state.playerRoundWins.set(winnerId, currentWins + 1)
    
    // Also update match-level state
    const matchState = matchStates.get(matchId)
    if (matchState) {
      matchState.playerRoundWins.set(winnerId, currentWins + 1)
    }
    
    console.log(`[${matchId}] 🏆 Round ${state.roundNumber} won by ${winnerId} (now has ${currentWins + 1} wins)`)
  }

  // Check if match is over
  const p1Wins = state.playerRoundWins.get(state.p1Id || '') || 0
  const p2Wins = state.playerRoundWins.get(state.p2Id || '') || 0
  const targetWins = state.targetRoundsToWin || 4
  const matchOver = p1Wins >= targetWins || p2Wins >= targetWins
  const matchWinnerId = matchOver ? (p1Wins >= targetWins ? state.p1Id : state.p2Id) : null

  state.currentPhase = 'result'

  // Convert playerRoundWins Map to object for JSON serialization
  const playerRoundWinsObj: { [playerId: string]: number } = {}
  state.playerRoundWins.forEach((wins, playerId) => {
    playerRoundWinsObj[playerId] = wins
  })

  const resultsEvent: ResultsReceivedEvent = {
    type: 'RESULTS_RECEIVED',
    player1_answer: null, // Not used for multi-step
    player2_answer: null, // Not used for multi-step
    correct_answer: 0, // Not used for multi-step
    player1_correct: p1Score > p2Score,
    player2_correct: p2Score > p1Score,
    round_winner: winnerId,
    p1Score,
    p2Score,
    stepResults,
    roundNumber: state.roundNumber,
    targetRoundsToWin: targetWins,
    playerRoundWins: playerRoundWinsObj,
    matchOver,
    matchWinnerId
  }

  // Persist results payload so Realtime delivers to all instances (prevents one-player-only results)
  try {
    const { data: matchRow, error: matchRowError } = await supabase
      .from('matches')
      .select('results_version, current_round_id')
      .eq('id', matchId)
      .single()

    if (matchRowError) {
      console.error(`[${matchId}] ❌ [RESULTS] Failed to fetch match row for results persistence:`, matchRowError)
    } else {
      const nextResultsVersion = (matchRow?.results_version ?? 0) + 1
      const resultsPayload = {
        mode: 'steps',
        round_id: matchRow?.current_round_id ?? null,
        round_number: state.roundNumber,
        correct_answer: 0,
        p1: { total: p1Score, steps: stepResults },
        p2: { total: p2Score, steps: stepResults },
        round_winner: winnerId,
        match_over: matchOver,
        match_winner_id: matchWinnerId
      }

      const { error: persistError } = await supabase
        .from('matches')
        .update({
          results_payload: resultsPayload,
          results_version: nextResultsVersion,
          results_round_id: matchRow?.current_round_id ?? null,
          results_computed_at: new Date().toISOString()
        })
        .eq('id', matchId)

      if (persistError) {
        console.error(`[${matchId}] ❌ [RESULTS] Failed to persist results payload:`, persistError)
      } else {
        console.log(`[${matchId}] ✅ [RESULTS] Persisted results payload (version ${nextResultsVersion}, round_id=${resultsPayload.round_id})`)
      }
    }
  } catch (err) {
    console.error(`[${matchId}] ❌ [RESULTS] Exception while persisting results payload:`, err)
  }

  // Log socket state before broadcasting
  const matchSockets = sockets.get(matchId)
  const socketCount = matchSockets?.size || 0
  const openSocketCount = matchSockets ? Array.from(matchSockets).filter(s => s.readyState === WebSocket.OPEN).length : 0
  
  console.log(`[${matchId}] 📤 [RESULTS] Broadcasting RESULTS_RECEIVED to ${socketCount} socket(s) (${openSocketCount} open)`)
  console.log(`[${matchId}] 📊 [RESULTS] Results summary: P1: ${p1Score}, P2: ${p2Score}, Winner: ${winnerId || 'Tie'}, Match Over: ${matchOver}`)
  console.log(`[${matchId}] 📊 [RESULTS] Player states: P1 eliminated=${p1Eliminated}, P2 eliminated=${p2Eliminated}`)
  
  broadcastToMatch(matchId, resultsEvent)
  
  console.log(`[${matchId}] ✅ [RESULTS] RESULTS_RECEIVED broadcast completed - clients should reset waiting flags now`)

  if (matchOver) {
    // Match finished - cleanup and don't start next round
    console.log(`[${matchId}] 🏁 Match finished - Winner: ${matchWinnerId}`)
    matchStates.delete(matchId)
    setTimeout(() => {
      cleanupGameState(matchId)
    }, 5000) // Give time for UI to show final results
  } else {
    // Transition to next round after delay
    setTimeout(async () => {
      await handleRoundTransition(matchId, supabase)
      // Don't cleanup game state - we need it for next round
    }, 3000)
  }
}

/**
 * Handle EARLY_ANSWER message (skip main question phase)
 */
async function handleEarlyAnswer(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const state = gameStates.get(matchId)
  if (!state || state.currentPhase !== 'main_question') {
    console.warn(`[${matchId}] ⚠️ Cannot handle early answer - invalid state`)
    return
  }

  console.log(`[${matchId}] ⚡ Early answer received - transitioning to steps`)
  await transitionToSteps(matchId, supabase)
}

/**
 * Handle SUBMIT_STEP_ANSWER message
 */
async function handleStepAnswer(
  matchId: string,
  playerId: string,
  stepIndex: number,
  answerIndex: number,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🎯 [STEP] SUBMIT_STEP_ANSWER received at ${new Date().toISOString()}`)
  console.log(`[${matchId}] 🎯 [STEP] Player: ${playerId}, StepIndex: ${stepIndex}, AnswerIndex: ${answerIndex}`)
  
  const state = gameStates.get(matchId)
  if (!state) {
    console.error(`[${matchId}] ❌ [STEP] No game state found for match`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid step answer submission - no game state'
    } as GameErrorEvent))
    return
  }
  
  console.log(`[${matchId}] 📊 [STEP] Current state: phase=${state.currentPhase}, currentStepIndex=${state.currentStepIndex}`)
  
  // Validation: must be in steps phase
  if (state.currentPhase !== 'steps') {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid step answer submission - not in steps phase'
    } as GameErrorEvent))
    return
  }

  // Allow current step or previous step (catch-up), reject future steps
  const isCurrentStep = stepIndex === state.currentStepIndex
  const isPreviousStep = stepIndex === state.currentStepIndex - 1
  const isFutureStep = stepIndex > state.currentStepIndex

  if (isFutureStep) {
    console.warn(`[${matchId}] ⚠️ [STEP] Rejecting future step answer - current step is ${state.currentStepIndex}, got ${stepIndex}`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: `Invalid step answer submission - current step is ${state.currentStepIndex}, cannot submit for future step ${stepIndex}`
    } as GameErrorEvent))
    return
  }

  if (isPreviousStep) {
    console.log(`[${matchId}] ⚠️ [STEP] Player ${playerId} submitting answer for previous step ${stepIndex} (current is ${state.currentStepIndex}) - allowing catch-up`)
  }

  // Check if player is eliminated - ignore their answer
  if (state.eliminatedPlayers.has(playerId)) {
    console.log(`[${matchId}] ⚠️ [STEP] Ignoring answer from eliminated player ${playerId}`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'You have been eliminated from this round'
    } as GameErrorEvent))
    return
  }

  // Store answer in local state
  if (!state.playerStepAnswers.has(playerId)) {
    state.playerStepAnswers.set(playerId, new Map())
  }
  state.playerStepAnswers.get(playerId)!.set(stepIndex, answerIndex)

  console.log(`[${matchId}] ✅ [STEP] Step ${stepIndex} answer stored in local state for player ${playerId}: ${answerIndex}`)
  console.log(`[${matchId}] 📊 [STEP] Local state - p1Answers: [${Array.from((state.playerStepAnswers.get(state.p1Id || '') || new Map()).keys()).join(', ')}], p2Answers: [${Array.from((state.playerStepAnswers.get(state.p2Id || '') || new Map()).keys()).join(', ')}]`)

  // Check if both players have either answered OR are eliminated for the CURRENT step
  const currentStepIdx = state.currentStepIndex
  const p1Answers = state.playerStepAnswers.get(state.p1Id || '') || new Map()
  const p2Answers = state.playerStepAnswers.get(state.p2Id || '') || new Map()
  const p1Eliminated = state.eliminatedPlayers.has(state.p1Id || '')
  const p2Eliminated = state.eliminatedPlayers.has(state.p2Id || '')
  const p1Done = p1Answers.has(currentStepIdx) || p1Eliminated
  const p2Done = p2Answers.has(currentStepIdx) || p2Eliminated
  const bothDone = p1Done && p2Done
  
  console.log(`[${matchId}] 📊 [STEP] Completion check (current step ${currentStepIdx}): p1Done=${p1Done} (answered=${p1Answers.has(currentStepIdx)}, eliminated=${p1Eliminated}), p2Done=${p2Done} (answered=${p2Answers.has(currentStepIdx)}, eliminated=${p2Eliminated}), bothDone=${bothDone}`)

  // Send confirmation
  const stepAnswerEvent: StepAnswerReceivedEvent = {
    type: 'STEP_ANSWER_RECEIVED',
    stepIndex,
    playerId,
    waitingForOpponent: !bothDone
  }

  socket.send(JSON.stringify(stepAnswerEvent))

  if (bothDone) {
    // Both players done (answered or eliminated) - CLEAR TIMER FIRST, then move to next step
    console.log(`[${matchId}] ⚡ [STEP] Both players done with step ${currentStepIdx} - clearing timer and moving to next step immediately`)
    
    // Clear timer BEFORE moving to prevent race with timeout
    const currentTimer = state.stepTimers.get(currentStepIdx)
    if (currentTimer) {
      console.log(`[${matchId}] 🔥 [TIMER] Clearing step ${currentStepIdx} timer BEFORE progression (timer ID: ${currentTimer})`)
      clearTimeout(currentTimer)
      state.stepTimers.delete(currentStepIdx)
      console.log(`[${matchId}] ✅ [TIMER] Step ${currentStepIdx} timer cleared successfully`)
    } else {
      console.log(`[${matchId}] ⚠️ [TIMER] No active timer found for step ${currentStepIdx} (already cleared or never set)`)
    }
    
    await moveToNextStep(matchId, supabase)
  }
}

/**
 * Handle SUBMIT_ANSWER message
 * - Validates answer
 * - Calls atomic RPC
 * - Broadcasts results when both answered
 * - Clears timeout on early completion
 */
async function handleSubmitAnswer(
  matchId: string,
  playerId: string,
  answer: number,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] SUBMIT_ANSWER from player ${playerId}, answer: ${answer}`)

  // Validate answer index
  if (answer !== 0 && answer !== 1) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid answer: must be 0 or 1'
    } as GameErrorEvent))
    return
  }

  // Get match to determine player role
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('player1_id, player2_id')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    console.error(`[${matchId}] ❌ Match not found:`, matchError)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Match not found'
    } as GameErrorEvent))
    return
  }

  const isP1 = match.player1_id === playerId

  // Call atomic RPC
  const { data: result, error } = await supabase.rpc('submit_answer_stage2', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_answer: answer
  })

  if (error) {
    // Check if RPC function doesn't exist (migration not applied)
    if (error.code === '42883' || error.message?.includes('does not exist') || error.message?.includes('function')) {
      console.error(`[${matchId}] ❌ RPC function submit_answer_stage2 not found - migrations may not be applied`)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Answer submission not available - database migrations required'
      } as GameErrorEvent))
      return
    }
    console.error(`[${matchId}] ❌ Error submitting answer:`, error)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: error.message || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  if (!result?.success) {
    console.error(`[${matchId}] ❌ RPC returned error:`, result?.error)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: result?.error || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  // Send confirmation to submitter
  socket.send(JSON.stringify({
    type: 'ANSWER_SUBMITTED',
    both_answered: result.both_answered
  }))

  // If both answered, fetch and broadcast results
  if (result.both_answered) {
    // Clear timeout since both answered early
    const existingTimeout = matchTimeouts.get(matchId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      matchTimeouts.delete(matchId)
      console.log(`[${matchId}] ✅ Cleared timeout - both players answered early`)
    }

    const { data: matchResults } = await supabase
      .from('matches')
      .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner')
      .eq('id', matchId)
      .single()

    if (matchResults) {
      // Get match state (should already be initialized in selectAndBroadcastQuestion)
      const matchState = matchStates.get(matchId)
      if (!matchState) {
        console.error(`[${matchId}] ⚠️ Match state not found for single-step question`)
        // Fallback - create it now
        const { data: matchData } = await supabase
          .from('matches')
          .select('player1_id, player2_id')
          .eq('id', matchId)
          .single()
        const fallbackState: MatchState = {
          roundNumber: 1,
          targetRoundsToWin: 4,
          playerRoundWins: new Map(),
          p1Id: matchData?.player1_id || null,
          p2Id: matchData?.player2_id || null
        }
        matchStates.set(matchId, fallbackState)
        await handleRoundTransition(matchId, supabase)
        return
      }

      // Update round wins
      const winnerId = matchResults.round_winner
      if (winnerId) {
        const currentWins = matchState.playerRoundWins.get(winnerId) || 0
        matchState.playerRoundWins.set(winnerId, currentWins + 1)
        console.log(`[${matchId}] 🏆 Round ${matchState.roundNumber} won by ${winnerId} (now has ${currentWins + 1} wins)`)
      }
      
      // Increment round number for next round (if match continues)
      const currentRoundNum = matchState.roundNumber

      // Check if match is over
      const p1Wins = matchState.playerRoundWins.get(matchState.p1Id || '') || 0
      const p2Wins = matchState.playerRoundWins.get(matchState.p2Id || '') || 0
      const targetWins = matchState.targetRoundsToWin || 4
      const matchOver = p1Wins >= targetWins || p2Wins >= targetWins
      const matchWinnerId = matchOver ? (p1Wins >= targetWins ? matchState.p1Id : matchState.p2Id) : null

      // Convert playerRoundWins Map to object for JSON serialization
      const playerRoundWinsObj: { [playerId: string]: number } = {}
      matchState.playerRoundWins.forEach((wins, playerId) => {
        playerRoundWinsObj[playerId] = wins
      })

      const resultsEvent: ResultsReceivedEvent = {
        type: 'RESULTS_RECEIVED',
        player1_answer: matchResults.player1_answer,
        player2_answer: matchResults.player2_answer,
        correct_answer: matchResults.correct_answer!,
        player1_correct: matchResults.player1_correct!,
        player2_correct: matchResults.player2_correct!,
        round_winner: matchResults.round_winner,
        roundNumber: currentRoundNum,
        targetRoundsToWin: targetWins,
        playerRoundWins: playerRoundWinsObj,
        matchOver,
        matchWinnerId
      }

      broadcastToMatch(matchId, resultsEvent)
      
      if (matchOver) {
        // Match finished - cleanup and don't start next round
        console.log(`[${matchId}] 🏁 Match finished - Winner: ${matchWinnerId}`)
        matchStates.delete(matchId)
      } else {
        // Increment round number for next round
        matchState.roundNumber = currentRoundNum + 1
        // Stage 3: After RESULTS_RECEIVED, check match state and transition
        await handleRoundTransition(matchId, supabase)
      }
    }
  } else {
    // Only one answered - broadcast "waiting" to both
    const answerReceivedEvent: AnswerReceivedEvent = {
      type: 'ANSWER_RECEIVED',
      player: isP1 ? 'player1' : 'player2',
      waiting_for_opponent: true
    }

    broadcastToMatch(matchId, answerReceivedEvent)
  }
}

/**
 * Handle SUBMIT_ANSWER message (V2 - DB-driven)
 * - Validates answer
 * - Calls submit_round_answer_v2 RPC (single source of truth)
 * - Broadcasts RESULTS_RECEIVED when both answered
 * - Starts next round if match continues
 * 
 * Key difference: No in-memory state. Everything comes from RPC return value.
 */
async function handleSubmitAnswerV2(
  matchId: string,
  playerId: string,
  answer: number,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const submitStartTime = Date.now()
  console.log(`[${matchId}] 🎯 [V2] SUBMIT_ANSWER received at ${new Date().toISOString()}`)
  console.log(`[${matchId}] 🎯 [V2] Player: ${playerId}, Answer: ${answer}`)
  console.log(`[${matchId}] 🎯 [V2] Socket readyState: ${socket.readyState} (OPEN=1)`)

  // Check current match state before submission
  const { data: matchBefore, error: matchBeforeError } = await supabase
    .from('matches')
    .select('player1_id, player2_id, player1_answer, player2_answer, question_sent_at, results_computed_at, current_round_id')
    .eq('id', matchId)
    .single()

  if (matchBeforeError) {
    console.error(`[${matchId}] ❌ [V2] Failed to fetch match state before submission:`, matchBeforeError)
  } else if (matchBefore) {
    const timeSinceQuestionSent = matchBefore.question_sent_at 
      ? Date.now() - new Date(matchBefore.question_sent_at).getTime()
      : null
    console.log(`[${matchId}] 📊 [V2] Match state BEFORE submission:`)
    console.log(`[${matchId}] 📊 [V2]   - Player1 answer: ${matchBefore.player1_answer ?? 'null'}`)
    console.log(`[${matchId}] 📊 [V2]   - Player2 answer: ${matchBefore.player2_answer ?? 'null'}`)
    console.log(`[${matchId}] 📊 [V2]   - Results computed: ${matchBefore.results_computed_at ? 'YES' : 'NO'}`)
    console.log(`[${matchId}] 📊 [V2]   - Question sent at: ${matchBefore.question_sent_at ?? 'null'}`)
    console.log(`[${matchId}] 📊 [V2]   - Time since question sent: ${timeSinceQuestionSent ? `${Math.floor(timeSinceQuestionSent / 1000)}s` : 'N/A'}`)
    console.log(`[${matchId}] 📊 [V2]   - Current round ID: ${matchBefore.current_round_id ?? 'null'}`)
  }

  // Check timer status
  const existingTimeout = matchTimeouts.get(matchId)
  console.log(`[${matchId}] ⏰ [V2] Timer status: ${existingTimeout ? 'ACTIVE' : 'INACTIVE'}`)
  if (existingTimeout) {
    console.log(`[${matchId}] ⏰ [V2] Timer ID: ${existingTimeout}`)
  }

  // Validate answer index
  if (answer !== 0 && answer !== 1) {
    console.error(`[${matchId}] ❌ [V2] Invalid answer validation: ${answer} (must be 0 or 1)`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid answer: must be 0 or 1'
    } as GameErrorEvent))
    return
  }

  console.log(`[${matchId}] 🔄 [V2] Calling submit_round_answer_v2 RPC...`)
  const rpcStartTime = Date.now()

  // Call v2 RPC (single source of truth)
  const { data, error } = await supabase.rpc('submit_round_answer_v2', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_answer: answer
  })

  const rpcDuration = Date.now() - rpcStartTime
  console.log(`[${matchId}] ⏱️ [V2] RPC call duration: ${rpcDuration}ms`)

  if (error) {
    console.error(`[${matchId}] ❌ [V2] RPC error after ${rpcDuration}ms:`, error)
    console.error(`[${matchId}] ❌ [V2] Error code: ${error.code}, message: ${error.message}`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: error.message || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  console.log(`[${matchId}] 📦 [V2] RPC response received:`)
  console.log(`[${matchId}] 📦 [V2]   - Success: ${data?.success ?? 'undefined'}`)
  console.log(`[${matchId}] 📦 [V2]   - Both answered: ${data?.both_answered ?? 'undefined'}`)
  console.log(`[${matchId}] 📦 [V2]   - Error: ${data?.error ?? 'none'}`)
  console.log(`[${matchId}] 📦 [V2]   - Reason: ${data?.reason ?? 'none'}`)
  console.log(`[${matchId}] 📦 [V2]   - Has results_payload: ${data?.results_payload ? 'YES' : 'NO'}`)

  if (!data?.success) {
    console.error(`[${matchId}] ❌ [V2] RPC returned failure after ${rpcDuration}ms`)
    console.error(`[${matchId}] ❌ [V2] Error: ${data?.error ?? 'unknown'}, Reason: ${data?.reason ?? 'unknown'}`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: data?.error || data?.reason || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  // Check match state after submission
  const { data: matchAfter, error: matchAfterError } = await supabase
    .from('matches')
    .select('player1_answer, player2_answer, results_computed_at')
    .eq('id', matchId)
    .single()

  if (matchAfterError) {
    console.error(`[${matchId}] ❌ [V2] Failed to fetch match state after submission:`, matchAfterError)
  } else if (matchAfter) {
    console.log(`[${matchId}] 📊 [V2] Match state AFTER submission:`)
    console.log(`[${matchId}] 📊 [V2]   - Player1 answer: ${matchAfter.player1_answer ?? 'null'}`)
    console.log(`[${matchId}] 📊 [V2]   - Player2 answer: ${matchAfter.player2_answer ?? 'null'}`)
    console.log(`[${matchId}] 📊 [V2]   - Results computed: ${matchAfter.results_computed_at ? 'YES' : 'NO'}`)
  }

  const totalDuration = Date.now() - submitStartTime
  console.log(`[${matchId}] ⏱️ [V2] Total submission duration: ${totalDuration}ms`)

  // Send confirmation to submitter
  console.log(`[${matchId}] 📤 [V2] Sending ANSWER_SUBMITTED confirmation to player ${playerId}`)
  console.log(`[${matchId}] 📤 [V2] Both answered: ${data.both_answered}`)
  
  try {
    socket.send(JSON.stringify({
      type: 'ANSWER_SUBMITTED',
      both_answered: data.both_answered
    }))
    console.log(`[${matchId}] ✅ [V2] ANSWER_SUBMITTED sent successfully`)
  } catch (sendError) {
    console.error(`[${matchId}] ❌ [V2] Failed to send ANSWER_SUBMITTED:`, sendError)
  }

  // Realtime will deliver results to all clients (primary mechanism)
  // Optional: Send WS RESULTS_RECEIVED as fast-path if both answered (but don't rely on it)
  if (data.both_answered && data.results_payload) {
    console.log(`[${matchId}] 🎉 [V2] Both players answered! Processing results...`)
    
    // Clear timeout since both answered early
    const timeoutToClear = matchTimeouts.get(matchId)
    if (timeoutToClear) {
      clearTimeout(timeoutToClear)
      matchTimeouts.delete(matchId)
      console.log(`[${matchId}] ✅ [V2] Cleared timeout (ID: ${timeoutToClear}) - both players answered early`)
    } else {
      console.log(`[${matchId}] ⚠️ [V2] No active timeout to clear (may have already been cleared or never set)`)
    }

    // Optional fast-path: Broadcast via WebSocket (same instance optimization)
    // Realtime is the reliable source, this is just optimization
    console.log(`[${matchId}] 📤 [V2] Preparing RESULTS_RECEIVED event...`)
    console.log(`[${matchId}] 📤 [V2] Results payload:`, JSON.stringify(data.results_payload, null, 2))
    
    const resultsEvent: ResultsReceivedEvent = {
      type: 'RESULTS_RECEIVED',
      player1_answer: data.results_payload.p1?.answer ?? null,
      player2_answer: data.results_payload.p2?.answer ?? null,
      correct_answer: data.results_payload.correct_answer,
      player1_correct: data.results_payload.p1?.correct ?? false,
      player2_correct: data.results_payload.p2?.correct ?? false,
      round_winner: data.results_payload.round_winner,
      roundNumber: data.results_payload.round_number,
      targetRoundsToWin: 4, // Will be read from match state
      playerRoundWins: {
        [data.results_payload.p1?.total?.toString() || '']: data.results_payload.p1?.total ?? 0,
        [data.results_payload.p2?.total?.toString() || '']: data.results_payload.p2?.total ?? 0
      },
      matchOver: false, // Will be determined from match status
      matchWinnerId: null
    }
    
    console.log(`[${matchId}] 📤 [V2] Broadcasting RESULTS_RECEIVED event...`)
    broadcastToMatch(matchId, resultsEvent)
    console.log(`[${matchId}] ✅ [V2] RESULTS_RECEIVED broadcast completed (fast-path, Realtime is primary)`)

    // Note: Next round will be started by server after delay or client signal
    // Don't start it here to avoid double-firing
  } else {
    // Only one answered - get match to determine player role for broadcast
    console.log(`[${matchId}] ⏳ [V2] Only one player answered - waiting for opponent`)
    console.log(`[${matchId}] ⏳ [V2] Current player: ${playerId}`)
    
    const { data: matchData } = await supabase
      .from('matches')
      .select('player1_id, player2_id')
      .eq('id', matchId)
      .single()
    
    if (matchData) {
      const playerRole = matchData.player1_id === playerId ? 'player1' : 'player2'
      console.log(`[${matchId}] 📤 [V2] Broadcasting ANSWER_RECEIVED for ${playerRole}`)
      
      const answerReceivedEvent: AnswerReceivedEvent = {
        type: 'ANSWER_RECEIVED',
        player: playerRole,
        waiting_for_opponent: true
      }
      broadcastToMatch(matchId, answerReceivedEvent)
      console.log(`[${matchId}] ✅ [V2] ANSWER_RECEIVED broadcast completed`)
    } else {
      console.error(`[${matchId}] ❌ [V2] Failed to fetch match data for ANSWER_RECEIVED broadcast`)
    }
  }
  
  const finalDuration = Date.now() - submitStartTime
  console.log(`[${matchId}] ✅ [V2] handleSubmitAnswerV2 completed in ${finalDuration}ms`)
}

/**
 * Handle round transition after RESULTS_RECEIVED
 * - Fetches fresh match state from database
 * - If match finished, broadcasts MATCH_FINISHED
 * - If match continues, starts next round
 */
async function handleRoundTransition(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🔄 Checking match state for round transition...`)
  
  // Fetch fresh match state from database (don't use cached state)
  const { data: dbMatchState, error: stateError } = await supabase
    .from('matches')
    .select('winner_id, status')
    .eq('id', matchId)
    .single()
  
  if (stateError || !dbMatchState) {
    console.error(`[${matchId}] ❌ Failed to fetch match state:`, stateError)
    return
  }
  
  // If match finished, broadcast MATCH_FINISHED
  if (dbMatchState.winner_id !== null) {
    console.log(`[${matchId}] 🏆 Match finished - winner: ${dbMatchState.winner_id}`)
    
    // Get round number from in-memory state
    const inMemoryState = matchStates.get(matchId)
    const totalRounds = inMemoryState?.roundNumber || 0
    
    const matchFinishedEvent: MatchFinishedEvent = {
      type: 'MATCH_FINISHED',
      winner_id: dbMatchState.winner_id,
      total_rounds: totalRounds
    }
    
    broadcastToMatch(matchId, matchFinishedEvent)
    return
  }
  
  // Match continues - start next round
  console.log(`[${matchId}] ➡️ Match continues - starting next round...`)
  
  // Clear timeout (if any)
  const existingTimeout = matchTimeouts.get(matchId)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
    matchTimeouts.delete(matchId)
  }
  
  // Call start_next_round_stage3 to clear answer fields
  const { data: resetResult, error: resetError } = await supabase.rpc('start_next_round_stage3', {
    p_match_id: matchId
  })
  
  if (resetError) {
    // Check if RPC function doesn't exist (migration not applied)
    if (resetError.code === '42883' || resetError.message?.includes('does not exist') || resetError.message?.includes('function')) {
      console.warn(`[${matchId}] ⚠️ RPC function start_next_round_stage3 not found - Stage 3 migrations may not be applied`)
      return
    }
    console.error(`[${matchId}] ❌ Error starting next round:`, resetError)
    return
  }
  
  if (!resetResult?.success) {
    console.error(`[${matchId}] ❌ Failed to start next round:`, resetResult?.error)
    return
  }
  
  console.log(`[${matchId}] ✅ Round reset successful - selecting next question...`)
  
  // Select and broadcast next question
  await selectAndBroadcastQuestion(matchId, supabase)
  
  // Optionally broadcast ROUND_STARTED event (using in-memory state instead of DB columns)
  const matchState = matchStates.get(matchId)
  if (matchState) {
    const roundStartedEvent: RoundStartedEvent = {
      type: 'ROUND_STARTED',
      round_number: matchState.roundNumber || 0,
      last_round_winner: null, // Not tracked in new system
      consecutive_wins_count: 0 // Not tracked in new system
    }
    
    broadcastToMatch(matchId, roundStartedEvent)
  }
}

/**
 * Handle JOIN_MATCH message
 * - Validates match and player
 * - Tracks connection
 * - Sends connection confirmation
 * - Broadcasts when both players connected
 */
async function handleJoinMatch(
  matchId: string,
  playerId: string,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] JOIN_MATCH from player ${playerId}`)

  // 1. Validate match exists and player is part of it
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    console.error(`[${matchId}] ❌ Match not found:`, matchError)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Match not found'
    } as GameErrorEvent))
    return
  }

  if (match.player1_id !== playerId && match.player2_id !== playerId) {
    console.error(`[${matchId}] ❌ Player ${playerId} not in match`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'You are not part of this match'
    } as GameErrorEvent))
    return
  }

  // 2. Determine if player is player1 or player2
  const isPlayer1 = match.player1_id === playerId
  const playerRole = isPlayer1 ? 'player1' : 'player2'
  const connectionColumn = isPlayer1 ? 'player1_connected_at' : 'player2_connected_at'

  // 3. Update database to mark this player as connected (works across instances!)
  const { error: updateError } = await supabase
    .from('matches')
    .update({
      [connectionColumn]: new Date().toISOString()
    })
    .eq('id', matchId)

  if (updateError) {
    console.error(`[${matchId}] ❌ Failed to update connection status:`, updateError)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Failed to register connection'
    } as GameErrorEvent))
    return
  }

  console.log(`[${matchId}] ✅ Player ${playerRole} (${playerId}) connection recorded in database`)

  // 4. Send connection confirmation
  socket.send(JSON.stringify({
    type: 'CONNECTED',
    player: playerRole,
    matchId: matchId
  } as ConnectedEvent))

  console.log(`[${matchId}] ✅ Player ${playerRole} (${playerId}) connected and confirmed`)

  // 5. Check if both players are connected (query database) and broadcast if so
  // Add a small delay to ensure database update is committed
  await new Promise(resolve => setTimeout(resolve, 200))
  
  // Track if we've already sent BOTH_CONNECTED
  let bothConnectedSent = false
  let checkInterval: number | null = null
  
  const checkConnection = async (): Promise<boolean> => {
    if (bothConnectedSent) return true // Already sent
    
    // Query database for current connection status
    const { data: matchStatus, error: statusError } = await supabase
      .from('matches')
      .select('player1_connected_at, player2_connected_at')
      .eq('id', matchId)
      .single()
    
    if (statusError || !matchStatus) {
      return false
    }
    
    if (matchStatus.player1_connected_at && matchStatus.player2_connected_at) {
      // Both connected! Attempt to broadcast
      console.log(`[${matchId}] ✅ [WS] Both players connected detected in checkConnection`)
      // NOTE: checkAndBroadcastBothConnected will re-check the database
      // right before broadcasting to catch any disconnects
      const broadcastSuccess = await checkAndBroadcastBothConnected(matchId, match, supabase)
      console.log(`[${matchId}] 📊 [WS] checkAndBroadcastBothConnected returned:`, broadcastSuccess)
      
      // Only mark as sent and clear interval if broadcast was successful
      if (broadcastSuccess) {
        bothConnectedSent = true
        
        // Clear the interval since we've successfully broadcasted
        if (checkInterval !== null) {
          clearInterval(checkInterval)
          checkInterval = null
          console.log(`[${matchId}] Stopped periodic connection check - BOTH_CONNECTED successfully sent`)
        }
        
        // Start the game round after both players are connected
        // First, ensure match status is 'in_progress' (it may still be 'pending')
        console.log(`[${matchId}] 🎮 [WS] BOTH_CONNECTED handler - updating match status to in_progress...`)
        const { error: statusUpdateError } = await supabase
          .from('matches')
          .update({ status: 'in_progress' })
          .eq('id', matchId)
          .neq('status', 'in_progress')
        
        if (statusUpdateError) {
          console.error(`[${matchId}] ❌ [WS] Failed to update match status:`, statusUpdateError)
        } else {
          console.log(`[${matchId}] ✅ [WS] Match status updated to in_progress`)
        }
        
        // selectAndBroadcastQuestion is idempotent - it handles existing questions internally
        console.log(`[${matchId}] 🎮 [WS] BOTH_CONNECTED handler - calling selectAndBroadcastQuestion...`)
        try {
          await selectAndBroadcastQuestion(matchId, supabase)
          console.log(`[${matchId}] ✅ [WS] selectAndBroadcastQuestion completed successfully`)
        } catch (error) {
          console.error(`[${matchId}] ❌ [WS] Error in selectAndBroadcastQuestion:`, error)
          console.error(`[${matchId}] ❌ [WS] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
          // Don't throw - let the game continue, question might already be sent
        }
        
        return true
      } else {
        // Broadcast failed - keep flag false so we can retry
        console.log(`[${matchId}] Broadcast failed, will retry on next check`)
        return false
      }
    }
    
    return false
  }
  
  // Initial check
  const alreadyBothConnected = await checkConnection()
  
  // Set up periodic check only if not already both connected
  // This handles the case where the other player connects to a different instance
  if (!alreadyBothConnected) {
    let checkCount = 0
    const maxChecks = 20 // 20 checks × 500ms = 10 seconds max
    
    checkInterval = setInterval(async () => {
      checkCount++
      
      // Stop if socket closed
      if (socket.readyState !== WebSocket.OPEN) {
        if (checkInterval !== null) {
          clearInterval(checkInterval)
          checkInterval = null
        }
        return
      }
      
      // Stop after max checks
      if (checkCount >= maxChecks) {
        if (checkInterval !== null) {
          clearInterval(checkInterval)
          checkInterval = null
        }
        console.log(`[${matchId}] Stopped periodic connection check after ${maxChecks} attempts`)
        return
      }
      
      // Check connection - will stop interval if both connected
      const connected = await checkConnection()
      if (connected && checkInterval !== null) {
        clearInterval(checkInterval)
        checkInterval = null
      }
    }, 500) as unknown as number // Deno uses number for intervals

    // Store interval ID on socket for cleanup
    ;(socket as any)._checkInterval = checkInterval
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const matchId = url.searchParams.get('match_id')

  if (!token || !matchId) {
    return new Response('Missing token or match_id', { 
      status: 400,
      headers: corsHeaders 
    })
  }

  // Verify JWT and get user
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: corsHeaders 
    })
  }

  console.log(`[${matchId}] WebSocket connection request from user ${user.id}`)

  // Upgrade to WebSocket
  const upgrade = req.headers.get('upgrade') || ''
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { 
      status: 426,
      headers: corsHeaders 
    })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)

  // Track socket
  if (!sockets.has(matchId)) {
    sockets.set(matchId, new Set())
  }
  sockets.get(matchId)!.add(socket)

  // Use service role for database operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  socket.onopen = async () => {
    console.log(`[${matchId}] WebSocket opened for user ${user.id}`)
    // Send initial connection confirmation (client will send JOIN_MATCH after this)
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established'
    }))
    
    // Connection tracking is now done via database, no need to check local state here
  }

  socket.onmessage = async (event) => {
    const messageReceivedTimestamp = Date.now()
    try {
      console.log(`[${matchId}] 📨 [RAW] Raw message received at ${new Date().toISOString()}`)
      console.log(`[${matchId}] 📨 [RAW] Message data:`, event.data)
      const message = JSON.parse(event.data)
      console.log(`[${matchId}] 📨 [RAW] Parsed message type: ${message.type}`)
      console.log(`[${matchId}] 📨 [RAW] Parsed message:`, JSON.stringify(message, null, 2))

      if (message.type === 'PING') {
        // Lightweight heartbeat - respond with PONG (no game logic)
        try {
          socket.send(JSON.stringify({ type: 'PONG' }))
        } catch (_err) {
          // Ignore send errors for heartbeat
        }
      } else if (message.type === 'JOIN_MATCH') {
        console.log(`[${matchId}] Processing JOIN_MATCH from user ${user.id}`)
        await handleJoinMatch(matchId, user.id, socket, supabase)
      } else if (message.type === 'EARLY_ANSWER') {
        console.log(`[${matchId}] Processing EARLY_ANSWER from user ${user.id}`)
        await handleEarlyAnswer(matchId, supabase)
      } else if (message.type === 'SUBMIT_STEP_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_STEP_ANSWER from user ${user.id}`)
        await handleStepAnswer(matchId, user.id, message.stepIndex, message.answerIndex, socket, supabase)
      } else if (message.type === 'SUBMIT_ANSWER') {
        const messageReceivedTime = Date.now()
        console.log(`[${matchId}] 📨 [MESSAGE] SUBMIT_ANSWER received at ${new Date().toISOString()}`)
        console.log(`[${matchId}] 📨 [MESSAGE] From user: ${user.id}`)
        console.log(`[${matchId}] 📨 [MESSAGE] Answer value: ${message.answer}`)
        console.log(`[${matchId}] 📨 [MESSAGE] Socket readyState: ${socket.readyState}`)
        
        // Check if we're in step phase - if so, route to step handler
        const state = gameStates.get(matchId)
        if (state && state.currentPhase === 'steps') {
          console.log(`[${matchId}] 📨 [MESSAGE] Routing to step handler (currentPhase: ${state.currentPhase})`)
          await handleStepAnswer(matchId, user.id, state.currentStepIndex, message.answer, socket, supabase)
        } else {
          console.log(`[${matchId}] 📨 [MESSAGE] Routing to handleSubmitAnswerV2 (currentPhase: ${state?.currentPhase ?? 'none'})`)
          // V2: Always use handleSubmitAnswerV2 (migrations must be deployed first)
          await handleSubmitAnswerV2(matchId, user.id, message.answer, socket, supabase)
        }
        
        const messageProcessedTime = Date.now()
        const messageProcessingDuration = messageProcessedTime - messageReceivedTime
        console.log(`[${matchId}] 📨 [MESSAGE] SUBMIT_ANSWER processing completed in ${messageProcessingDuration}ms`)
      } else {
        console.warn(`[${matchId}] Unknown message type: ${message.type}`)
        socket.send(JSON.stringify({
          type: 'GAME_ERROR',
          message: `Unknown message type: ${message.type}`
        } as GameErrorEvent))
      }
    } catch (error) {
      console.error(`[${matchId}] Error handling message:`, error, event.data)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Error processing message'
      } as GameErrorEvent))
    }
  }

  socket.onclose = async () => {
    console.log(`[${matchId}] WebSocket closed for user ${user.id}`)
    
    // Clear periodic check interval
    if ((socket as any)._checkInterval) {
      clearInterval((socket as any)._checkInterval)
      delete (socket as any)._checkInterval
    }
    
    // Get match to determine which player disconnected
    const { data: match } = await supabase
      .from('matches')
      .select('player1_id, player2_id')
      .eq('id', matchId)
      .single()

    if (match) {
      const isPlayer1 = match.player1_id === user.id
      const connectionColumn = isPlayer1 ? 'player1_connected_at' : 'player2_connected_at'
      
      // Clear connection status in database
      await supabase
        .from('matches')
        .update({
          [connectionColumn]: null
        })
        .eq('id', matchId)
      
      console.log(`[${matchId}] ✅ Cleared ${isPlayer1 ? 'player1' : 'player2'} connection status in database`)
    }
    
    // Remove from local sockets
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      matchSockets.delete(socket)
      if (matchSockets.size === 0) {
        sockets.delete(matchId)
        // Cleanup game state when all sockets disconnected
        cleanupGameState(matchId)
      }
    }
  }

  socket.onerror = (error) => {
    console.error(`[${matchId}] WebSocket error:`, error)
  }

  return response
})

