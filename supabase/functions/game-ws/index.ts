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
  phase: 'thinking' | 'main_question' | 'steps'
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
  segment?: 'main' | 'sub'
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

// Track which user each socket belongs to (for per-player sends)
const socketMeta = new Map<WebSocket, { matchId: string; userId: string }>()

// Track timeouts per match (for cleanup)
const matchTimeouts = new Map<string, number>() // matchId -> timeoutId

// Periodic async segment sweep intervals (per match) for server-side timeouts
const matchSweepIntervals = new Map<string, number>() // matchId -> intervalId

const sweepInFlight = new Set<string>() // matchId guard to avoid overlapping sweeps

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
  p1AllStepsComplete: boolean
  p2AllStepsComplete: boolean
  // Async segments (no-wait) bookkeeping (per instance only)
  lastSentSegmentKeyByPlayer: Map<string, string> // playerId -> `${stepIndex}:${segment}`
  lastResultsRoundIdBroadcasted: string | null
}

const gameStates = new Map<string, GameState>() // matchId -> GameState

// Track match-level state (round wins, etc.) for all matches
interface MatchState {
  roundNumber: number
  targetRoundsToWin: number
  playerRoundWins: Map<string, number> // playerId -> round wins
  p1Id: string | null
  p2Id: string | null
  p1ResultsAcknowledged: boolean
  p2ResultsAcknowledged: boolean
  roundTransitionInProgress: boolean
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

  // Online battle ruleset: exactly 4 main steps (parts)
  const isMultiStep = Array.isArray(steps) && steps.length === 4

  // Get match players for game state
  const { data: matchData } = await supabase
    .from('matches')
    .select('player1_id, player2_id, current_round_id, current_round_number, target_rounds_to_win')
    .eq('id', matchId)
    .single()

  if (isMultiStep) {
    // Multi-step question flow
    console.log(`[${matchId}] 📚 Multi-step question detected (${steps.length} steps)`)
    
    // Canonical round identity comes from DB (cross-instance safe)
    const dbRoundNumber = Math.max(1, matchData?.current_round_number || 1)
    const dbRoundId = matchData?.current_round_id || null
    
    // Get or initialize match-level state
    let matchState = matchStates.get(matchId)
    if (!matchState) {
      // First round - initialize match state
      matchState = {
        roundNumber: dbRoundNumber,
        targetRoundsToWin: matchData?.target_rounds_to_win || 4,
        playerRoundWins: new Map(),
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null,
        p1ResultsAcknowledged: false,
        p2ResultsAcknowledged: false,
        roundTransitionInProgress: false
      }
      matchStates.set(matchId, matchState)
    } else {
      // Sync round number from DB and reset readiness (do NOT increment in-memory)
      matchState.roundNumber = dbRoundNumber
      matchState.targetRoundsToWin = matchData?.target_rounds_to_win || matchState.targetRoundsToWin
      matchState.p1Id = matchData?.player1_id || matchState.p1Id
      matchState.p2Id = matchData?.player2_id || matchState.p2Id
      matchState.p1ResultsAcknowledged = false
      matchState.p2ResultsAcknowledged = false
      matchState.roundTransitionInProgress = false
    }

    // Initialize or reset game state for this round
    let gameState = gameStates.get(matchId)
    if (!gameState) {
      gameState = {
        currentPhase: 'steps',
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
        roundNumber: dbRoundNumber,
        targetRoundsToWin: matchState.targetRoundsToWin,
        playerRoundWins: new Map(matchState.playerRoundWins), // Copy match-level wins
        p1AllStepsComplete: false,
        p2AllStepsComplete: false,
        lastSentSegmentKeyByPlayer: new Map(),
        lastResultsRoundIdBroadcasted: null
      }
      gameStates.set(matchId, gameState)
    } else {
      // New round - reset per-round state but keep match state
      gameState.currentPhase = 'steps'
      gameState.currentStepIndex = 0
      gameState.mainQuestionTimer = null
      gameState.stepTimers.clear()
      gameState.mainQuestionEndsAt = null
      gameState.stepEndsAt = null
      gameState.playerStepAnswers.clear()
      gameState.currentQuestion = questionDb
      gameState.eliminatedPlayers.clear()
      gameState.roundNumber = dbRoundNumber
      gameState.targetRoundsToWin = matchState.targetRoundsToWin
      gameState.playerRoundWins = new Map(matchState.playerRoundWins) // Sync with match state
      gameState.p1AllStepsComplete = false
      gameState.p2AllStepsComplete = false
      gameState.lastSentSegmentKeyByPlayer.clear()
      gameState.lastResultsRoundIdBroadcasted = null
    }

    // Async segments model: start steps immediately (no global "main question" waiting)
    gameState.mainQuestionEndsAt = null
    gameState.stepEndsAt = null

    // Persist round status for observability (best-effort; progression is per-player via progress table)
    if (dbRoundId) {
      const { error: roundUpdateError } = await supabase
        .from('match_rounds')
        .update({
          status: 'steps',
          current_step_index: 0,
          step_ends_at: null,
          main_question_ends_at: null
        })
        .eq('id', dbRoundId)

      if (roundUpdateError) {
        console.error(`[${matchId}] ❌ Failed to mark match_rounds as steps:`, roundUpdateError)
      }
    } else {
      console.warn(`[${matchId}] ⚠️ No current_round_id found; cannot initialize async segments`)
      return
    }

    const roundStartEvent: RoundStartEvent = {
      type: 'ROUND_START',
      matchId,
      roundId: dbRoundId || matchId,
      roundIndex: dbRoundNumber - 1, // roundIndex is 0-based
      phase: 'steps',
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
      totalSteps: steps.length
    }

    console.log(`[${matchId}] 📤 [WS] Broadcasting multi-step ROUND_START`, {
      questionId: questionDb.id,
      totalSteps: steps.length
    })
    broadcastToMatch(matchId, roundStartEvent)
    console.log(`[${matchId}] ✅ [WS] ROUND_START broadcast completed`)

    // Initialize per-player progress and send initial segment to each player
    const { error: initError } = await supabase.rpc('init_round_progress_v1', {
      p_match_id: matchId,
      p_round_id: dbRoundId
    })
    if (initError) {
      console.error(`[${matchId}] ❌ init_round_progress_v1 failed:`, initError)
      return
    }

    const { data: progressRows, error: progressError } = await supabase
      .from('match_round_player_progress_v1')
      .select('player_id, current_step_index, current_segment, segment_ends_at, completed_at')
      .eq('match_id', matchId)
      .eq('round_id', dbRoundId)

    if (progressError) {
      console.error(`[${matchId}] ❌ Failed to fetch progress rows:`, progressError)
      return
    }

    for (const row of progressRows ?? []) {
      if (!row?.player_id || row.completed_at) continue
      const seg = (row.current_segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
      await sendSegmentStartToPlayer(
        matchId,
        row.player_id,
        questionDb,
        row.current_step_index ?? 0,
        seg,
        row.segment_ends_at
      )
      gameState.lastSentSegmentKeyByPlayer.set(row.player_id, `${row.current_step_index ?? 0}:${seg}`)
    }

    // Start server-side timeout sweeper (per instance)
    ensureAsyncSegmentSweep(matchId, supabase)
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
        p2Id: matchData?.player2_id || null,
        p1ResultsAcknowledged: false,
        p2ResultsAcknowledged: false,
        roundTransitionInProgress: false
      }
      matchStates.set(matchId, matchState)
    }
    
    // Clear any existing game state (multi-step state)
    cleanupGameState(matchId)

    // Timeout for answer submission (60 seconds / 1 minute)
    const TIMEOUT_SECONDS = 60
    
    // Calculate timer end time (60 seconds from now)
    const timerEndAt = new Date(Date.now() + TIMEOUT_SECONDS * 1000).toISOString()
    
    const questionReceivedEvent: QuestionReceivedEvent = {
      type: 'QUESTION_RECEIVED',
      question: questionDb, // Send raw DB object
      timer_end_at: timerEndAt
    }
    
    console.log(`[${matchId}] 📤 [WS] Broadcasting single-step question`, {
      questionId: questionDb.id,
      timer_end_at: timerEndAt
    })
    
    let sentCount = 0
    const matchSocketsArray = Array.from(matchSockets)
    matchSocketsArray.forEach((socket, index) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(questionReceivedEvent))
          sentCount++
          console.log(`[${matchId}] ✅ Sent QUESTION_RECEIVED to socket ${index + 1}`)
        } catch (error) {
          console.error(`[${matchId}] ❌ Error sending QUESTION_RECEIVED to socket ${index + 1}:`, error)
        }
      }
    })
    
    console.log(`[${matchId}] 📊 [WS] QUESTION_RECEIVED sent to ${sentCount}/${matchSocketsArray.length} sockets`)
    console.log(`[${matchId}] ✅ [WS] QUESTION_RECEIVED broadcast completed`)
    
    // Update match status
    await supabase
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', matchId)
      .neq('status', 'in_progress')

    console.log(`[${matchId}] ✅ Question selection and broadcast completed!`)

    // Start timeout for answer submission (60 seconds / 1 minute)
    const timeoutId = setTimeout(async () => {
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
          // Persist round phase in match_rounds (DB-authoritative) on timeout (best-effort)
          try {
            const { data: matchRow } = await supabase
              .from('matches')
              .select('current_round_id')
              .eq('id', matchId)
              .maybeSingle()
            const roundIdToMark = (matchRow as any)?.current_round_id ?? null
            if (roundIdToMark) {
              const { error: roundStatusError } = await supabase
                .from('match_rounds')
                .update({
                  status: 'results',
                  step_ends_at: null,
                  main_question_ends_at: null
                })
                .eq('id', roundIdToMark)
              if (roundStatusError) {
                console.warn(`[${matchId}] ⚠️ Failed to mark match_rounds.status='results' on timeout for round ${roundIdToMark}:`, roundStatusError)
              }
            }
          } catch (err) {
            console.warn(`[${matchId}] ⚠️ Exception marking round status to results on timeout:`, err)
          }

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
    console.log(`[${matchId}] ⏰ Started timeout timer (${TIMEOUT_SECONDS}s)`)
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

    // ===== Idempotency: reuse existing active round (cross-instance safe) =====
    // If an active match_rounds row already exists (status in ('main','steps')), reuse it
    // instead of inserting another row (prevents current_round_id churn and desync).
    try {
      let activeRound: any = null

      if (match.current_round_id) {
        const { data: roundById, error: roundByIdError } = await supabase
          .from('match_rounds')
          .select('id, question_id, round_number, status, created_at')
          .eq('id', match.current_round_id)
          .maybeSingle()
        if (!roundByIdError && roundById && (roundById.status === 'main' || roundById.status === 'steps')) {
          activeRound = roundById
        }
      }

      if (!activeRound) {
        const { data: latestActive, error: latestActiveError } = await supabase
          .from('match_rounds')
          .select('id, question_id, round_number, status, created_at')
          .eq('match_id', matchId)
          .in('status', ['main', 'steps'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!latestActiveError && latestActive) {
          activeRound = latestActive
        }
      }

      if (activeRound?.id && activeRound?.question_id) {
        console.log(`[${matchId}] ♻️ Reusing existing active round ${activeRound.id} (status=${activeRound.status}, round_number=${activeRound.round_number})`)

        // Fetch question for this round from the canonical source: match_rounds.question_id
        const { data: q, error: qErr } = await supabase
          .from('questions_v2')
          .select('*')
          .eq('id', activeRound.question_id)
          .single()

        if (qErr || !q) {
          console.error(`[${matchId}] ❌ Failed to fetch question for active round ${activeRound.id}:`, qErr)
          throw qErr || new Error(`Failed to fetch question ${activeRound.question_id}`)
        }

        // Best-effort realign matches.current_round_id/current_round_number/question_id (defense-in-depth)
        const desiredUpdate: Record<string, any> = {}
        if (match.current_round_id !== activeRound.id) desiredUpdate.current_round_id = activeRound.id
        if (activeRound.round_number != null && match.current_round_number !== activeRound.round_number) {
          desiredUpdate.current_round_number = activeRound.round_number
        }
        if (match.question_id !== activeRound.question_id) desiredUpdate.question_id = activeRound.question_id

        if (Object.keys(desiredUpdate).length > 0) {
          const { error: alignError } = await supabase
            .from('matches')
            .update(desiredUpdate)
            .eq('id', matchId)
          if (alignError) {
            console.warn(`[${matchId}] ⚠️ Failed to realign matches to active round ${activeRound.id}:`, alignError)
          }
        }

        // Update in-memory state for idempotency
        const existingGameState = gameStates.get(matchId)
        if (existingGameState) {
          existingGameState.currentQuestion = q
          if (activeRound.round_number != null) existingGameState.roundNumber = activeRound.round_number
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
            currentQuestion: q,
            p1Id: matchData?.player1_id || null,
            p2Id: matchData?.player2_id || null,
            eliminatedPlayers: new Set(),
            roundNumber: activeRound.round_number ?? (match.current_round_number || 1),
            targetRoundsToWin: match.target_rounds_to_win || 4,
            playerRoundWins: new Map(),
            p1AllStepsComplete: false,
            p2AllStepsComplete: false,
            lastSentSegmentKeyByPlayer: new Map(),
            lastResultsRoundIdBroadcasted: null
          }
          gameStates.set(matchId, newGameState)
        }

        await broadcastQuestion(matchId, q, supabase)
        return
      }
    } catch (err) {
      console.warn(`[${matchId}] ⚠️ Failed active-round reuse check (continuing to create new round):`, err)
    }

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
      console.log(`[${matchId}] 🔍 No question assigned, fetching questions with tiered filtering...`)

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

      // Filter for valid battle questions:
      // - EXACTLY 4 steps (parts)
      // - Each step must have options (2 for TF or 4 for MCQ; tolerate empty strings)
      const isValidQuestion = (q: any) => {
        try {
          const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
          if (!Array.isArray(steps) || steps.length !== 4) return false

          return steps.every((s: any) => {
            const opts = Array.isArray(s?.options) ? s.options : []
            const optionCount = opts.filter((opt: any) => opt && String(opt).trim()).length
            return optionCount === 2 || optionCount === 4
          })
        } catch {
          return false
        }
      }

      const questionPool = tiers.flatMap(list => list.filter(isValidQuestion))

      if (questionPool.length === 0) {
        console.error(`[${matchId}] ❌ No valid questions available (need True/False or MCQ questions)`)
        throw new Error('No valid questions available')
      }

      const selectedQuestion = questionPool[Math.floor(Math.random() * questionPool.length)]
      console.log(`[${matchId}] 🎯 Selected question: ${selectedQuestion.id} - "${selectedQuestion.title}"`)

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

    // ===== Create new match_rounds row with question_id (single source of truth) =====
    // Cross-instance safe: a partial unique index enforces only one active round (main/steps).
    // If another instance wins the race, we re-select and reuse the active round.
    let roundIdToUse: string | null = null
    let roundNumberToUse: number = newRoundNumber

    const { data: insertedRound, error: roundError } = await supabase
      .from('match_rounds')
      .insert({
        match_id: matchId,
        question_id: questionDb.id, // Single source of truth for question
        round_number: newRoundNumber,
        status: 'main' // For simple questions, will transition to 'results' when computed
      })
      .select('id, round_number')
      .single()

    if (roundError) {
      const msgLower = String(roundError.message || '').toLowerCase()
      const detailsLower = String((roundError as any).details || '').toLowerCase()
      const isUniqueViolation =
        (roundError as any).code === '23505' ||
        msgLower.includes('duplicate key') ||
        msgLower.includes('unique') ||
        detailsLower.includes('idx_match_rounds_match_active')

      if (!isUniqueViolation) {
        console.error(`[${matchId}] ❌ Failed to create match_rounds row:`, roundError)
        throw roundError
      }

      console.warn(`[${matchId}] ⚠️ match_rounds insert hit active-round uniqueness; reusing existing active round`)
      const { data: existingActive, error: existingActiveError } = await supabase
        .from('match_rounds')
        .select('id, question_id, round_number, status, created_at')
        .eq('match_id', matchId)
        .in('status', ['main', 'steps'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingActiveError || !existingActive?.id) {
        console.error(`[${matchId}] ❌ Failed to re-select active round after uniqueness violation:`, existingActiveError)
        throw roundError
      }

      roundIdToUse = existingActive.id
      roundNumberToUse = existingActive.round_number ?? newRoundNumber
    } else if (insertedRound?.id) {
      roundIdToUse = insertedRound.id
      roundNumberToUse = insertedRound.round_number ?? newRoundNumber
      console.log(`[${matchId}] ✅ Created match_rounds row: ${roundIdToUse} for round ${roundNumberToUse}`)
    }

    if (!roundIdToUse) {
      throw new Error('Failed to resolve current round id for match')
    }

    // ===== Update matches with current_round_id and current_round_number =====
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        current_round_id: roundIdToUse,
        current_round_number: roundNumberToUse,
        // Keep question_id for backwards compatibility, but we read from match_rounds.question_id
        question_id: questionDb.id
      })
      .eq('id', matchId)

    if (updateError) {
      console.error(`[${matchId}] ❌ Failed to update matches with round info:`, updateError)
      throw updateError
    }

    console.log(`[${matchId}] ✅ Updated matches.current_round_id = ${roundIdToUse}, current_round_number = ${roundNumberToUse}`)

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
        roundNumber: roundNumberToUse,
        targetRoundsToWin: match.target_rounds_to_win || 4,
        playerRoundWins: new Map(),
        p1AllStepsComplete: false,
        p2AllStepsComplete: false,
        lastSentSegmentKeyByPlayer: new Map(),
        lastResultsRoundIdBroadcasted: null
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
  
  const socketsArray = Array.from(matchSockets)
  socketsArray.forEach((s, index) => {
    console.log(`[${matchId}] Socket ${index + 1}/${socketsArray.length} readyState: ${s.readyState} (OPEN=1, CONNECTING=0, CLOSING=2, CLOSED=3)`)
    
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

  const sweepId = matchSweepIntervals.get(matchId)
  if (sweepId) {
    clearInterval(sweepId)
    matchSweepIntervals.delete(matchId)
  }
}

function parseQuestionSteps(rawSteps: any): any[] {
  try {
    return Array.isArray(rawSteps) ? rawSteps : JSON.parse(rawSteps ?? '[]')
  } catch {
    return []
  }
}

function sendToPlayer(matchId: string, playerId: string, event: any): void {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) return

  matchSockets.forEach((socket) => {
    if (socket.readyState !== WebSocket.OPEN) return
    const meta = socketMeta.get(socket)
    if (!meta || meta.matchId !== matchId || meta.userId !== playerId) return
    try {
      socket.send(JSON.stringify(event))
    } catch (error) {
      console.error(`[${matchId}] ❌ Error sending ${event?.type} to player ${playerId}:`, error)
    }
  })
}

function buildSegmentStepFromQuestion(
  questionDb: any,
  stepIndex: number,
  segment: 'main' | 'sub'
): { id: string; prompt: string; options: string[]; correctAnswer: number; marks: number } | null {
  const steps = parseQuestionSteps(questionDb?.steps)
  const step = steps?.[stepIndex]
  if (!step) return null

  if (segment === 'main') {
    return {
      id: step?.id || `step-${stepIndex}`,
      prompt: step?.prompt || step?.question || '',
      options: Array.isArray(step?.options) ? step.options : [],
      correctAnswer: step?.correct_answer?.correctIndex ?? step?.correctAnswer ?? 0,
      marks: step?.marks || 0
    }
  }

  const sub = step?.subStep || step?.sub_step
  if (!sub) return null
  return {
    id: `${step?.id || `step-${stepIndex}`}:sub`,
    prompt: sub?.prompt || sub?.question || '',
    options: Array.isArray(sub?.options) ? sub.options : [],
    correctAnswer: sub?.correct_answer?.correctIndex ?? sub?.correctAnswer ?? 0,
    marks: 0
  }
}

async function sendSegmentStartToPlayer(
  matchId: string,
  playerId: string,
  questionDb: any,
  stepIndex: number,
  segment: 'main' | 'sub',
  segmentEndsAt: string | null
): Promise<void> {
  const current = buildSegmentStepFromQuestion(questionDb, stepIndex, segment)
  if (!current || !segmentEndsAt) return

  const phaseChangeEvent: PhaseChangeEvent = {
    type: 'PHASE_CHANGE',
    matchId,
    phase: 'steps',
    stepIndex,
    totalSteps: 4,
    stepEndsAt: segmentEndsAt,
    segment,
    currentStep: current
  }

  sendToPlayer(matchId, playerId, phaseChangeEvent)
}

function ensureAsyncSegmentSweep(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): void {
  if (matchSweepIntervals.has(matchId)) return

  const intervalId = setInterval(() => {
    if (sweepInFlight.has(matchId)) return
    sweepInFlight.add(matchId)

    ;(async () => {
      const ctx = await getDbRoundContext(matchId, supabase)
      if (!ctx) return

      const { match, round, roundIndex } = ctx
      const state = gameStates.get(matchId)
      const questionId = round.question_id || match.question_id || null
      const questionDb = await getQuestionForRound(matchId, questionId, supabase)
      if (!questionDb) return

      // Only sweep while the round is in active phases
      if (round.status !== 'steps' && round.status !== 'main') return

      // Server-side timeout advancement (DB-authoritative)
      await supabase.rpc('auto_advance_overdue_segments_v1', {
        p_match_id: matchId,
        p_round_id: round.id
      })

      // Read current per-player progress to push next segments to local sockets
      const { data: progressRows } = await supabase
        .from('match_round_player_progress_v1')
        .select('player_id, current_step_index, current_segment, segment_ends_at, completed_at')
        .eq('match_id', matchId)
        .eq('round_id', round.id)

      const p1Complete = !!progressRows?.find((r: any) => r.player_id === match.player1_id)?.completed_at
      const p2Complete = !!progressRows?.find((r: any) => r.player_id === match.player2_id)?.completed_at

      if (state) {
        const changed = state.p1AllStepsComplete !== p1Complete || state.p2AllStepsComplete !== p2Complete
        state.p1AllStepsComplete = p1Complete
        state.p2AllStepsComplete = p2Complete

        if (changed) {
          broadcastToMatch(matchId, {
            type: 'ALL_STEPS_COMPLETE_WAITING',
            p1Complete,
            p2Complete
          })
        }
      }

      for (const row of progressRows ?? []) {
        if (!row?.player_id || row.completed_at) continue
        const seg = (row.current_segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
        const key = `${row.current_step_index ?? 0}:${seg}`
        const lastKey = state?.lastSentSegmentKeyByPlayer.get(row.player_id)
        if (lastKey === key) continue

        await sendSegmentStartToPlayer(
          matchId,
          row.player_id,
          questionDb,
          row.current_step_index ?? 0,
          seg,
          row.segment_ends_at
        )
        state?.lastSentSegmentKeyByPlayer.set(row.player_id, key)
      }

      // If both complete, compute results and broadcast once (WS fast-path)
      if (p1Complete && p2Complete && state?.lastResultsRoundIdBroadcasted !== round.id) {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('compute_multi_step_results_v3', {
          p_match_id: matchId,
          p_round_id: round.id
        })
        if (!rpcError && rpcResult?.success && rpcResult?.results_payload) {
          const payload = rpcResult.results_payload
          broadcastToMatch(matchId, {
            type: 'RESULTS_RECEIVED',
            results_payload: payload,
            results_version: rpcResult.results_version,
            round_number: payload.round_number || match.current_round_number || 0,
            round_id: payload.round_id || round.id
          })
          if (state) state.lastResultsRoundIdBroadcasted = round.id

          if (payload.match_over) {
            setTimeout(() => cleanupGameState(matchId), 5000)
          }
        }
      }
    })()
      .catch((err) => console.error(`[${matchId}] ❌ async segment sweep error:`, err))
      .finally(() => {
        sweepInFlight.delete(matchId)
      })
  }, 800) as unknown as number

  matchSweepIntervals.set(matchId, intervalId)
}

async function getDbRoundContext(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ match: any; round: any; roundIndex: number } | null> {
  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select('current_round_id, current_round_number, player1_id, player2_id, question_id')
    .eq('id', matchId)
    .single()

  if (matchError || !matchRow?.current_round_id) {
    console.error(`[${matchId}] ❌ getDbRoundContext: failed to fetch matches.current_round_id:`, matchError)
    return null
  }

  const { data: roundRow, error: roundError } = await supabase
    .from('match_rounds')
    .select('id, match_id, question_id, status, current_step_index, step_ends_at, main_question_ends_at, p1_eliminated_at, p2_eliminated_at')
    .eq('id', matchRow.current_round_id)
    .single()

  if (roundError || !roundRow) {
    console.error(`[${matchId}] ❌ getDbRoundContext: failed to fetch match_rounds row:`, roundError)
    return null
  }

  const roundIndex = Math.max(0, (matchRow.current_round_number || 0) - 1)

  return { match: matchRow, round: roundRow, roundIndex }
}

async function getQuestionForRound(
  matchId: string,
  questionId: string | null,
  supabase: ReturnType<typeof createClient>
): Promise<any | null> {
  if (!questionId) return null
  const state = gameStates.get(matchId)
  if (state?.currentQuestion?.id === questionId) return state.currentQuestion

  const { data: questionDb, error: qError } = await supabase
    .from('questions_v2')
    .select('*')
    .eq('id', questionId)
    .single()

  if (qError || !questionDb) {
    console.error(`[${matchId}] ❌ Failed to fetch questions_v2(${questionId}):`, qError)
    return null
  }

  if (state) state.currentQuestion = questionDb
  return questionDb
}

async function advanceFromStepDb(
  matchId: string,
  currentStepIndex: number,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const ctx = await getDbRoundContext(matchId, supabase)
  if (!ctx) return

  const { match, round } = ctx

  // Only advance if DB still considers this the active step
  if (round.status !== 'steps' || round.current_step_index !== currentStepIndex) return

  const questionId = round.question_id || match.question_id || null
  const questionDb = await getQuestionForRound(matchId, questionId, supabase)
  if (!questionDb) return

  const steps = parseQuestionSteps(questionDb.steps)
  if (steps.length === 0) {
    console.error(`[${matchId}] ❌ advanceFromStepDb: no steps found in question`)
    return
  }

  // Last step → compute results (DB-driven RPC writes matches.results_payload)
  if (currentStepIndex >= steps.length - 1) {
    await calculateStepResults(matchId, supabase)
    return
  }

  const nextStepIndex = currentStepIndex + 1
  const stepEndsAt = new Date(Date.now() + 15 * 1000).toISOString()

  // CAS update: only one instance can advance
  const { data: updatedRound, error: updateError } = await supabase
    .from('match_rounds')
    .update({
      status: 'steps',
      current_step_index: nextStepIndex,
      step_ends_at: stepEndsAt
    })
    .eq('id', round.id)
    .eq('status', 'steps')
    .eq('current_step_index', currentStepIndex)
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error(`[${matchId}] ❌ advanceFromStepDb: CAS update failed:`, updateError)
    return
  }
  if (!updatedRound) {
    // Another instance advanced already
    return
  }

  // Sync local state (best-effort; canonical is DB/Reatime)
  const state = gameStates.get(matchId)
  if (state) {
    state.currentPhase = 'steps'
    state.currentStepIndex = nextStepIndex
    state.stepEndsAt = stepEndsAt
  }

  const nextStep = steps[nextStepIndex]
  const phaseChangeEvent: PhaseChangeEvent = {
    type: 'PHASE_CHANGE',
    matchId,
    phase: 'steps',
    stepIndex: nextStepIndex,
    totalSteps: steps.length,
    stepEndsAt,
    currentStep: {
      id: nextStep?.id || '',
      prompt: nextStep?.prompt || nextStep?.question || '',
      options: Array.isArray(nextStep?.options) ? nextStep.options : [],
      correctAnswer: nextStep?.correct_answer?.correctIndex ?? nextStep?.correctAnswer ?? 0,
      marks: nextStep?.marks || 0
    }
  }

  // FAST-PATH: broadcast to local sockets (clients still advance via Realtime on match_rounds)
  broadcastToMatch(matchId, phaseChangeEvent)

  // Start timer for the next step on the advancing instance
  const stepTimerId = setTimeout(() => {
    checkStepTimeout(matchId, nextStepIndex, supabase)
  }, 15 * 1000) as unknown as number

  if (state) {
    state.stepTimers.set(nextStepIndex, stepTimerId)
  }
  console.log(`[${matchId}] ⏰ Started step ${nextStepIndex} timer (15s)`)
}

/**
 * Transition from main question phase to steps phase
 */
async function transitionToSteps(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const state = gameStates.get(matchId)

  // Clear main question timer (best-effort)
  if (state?.mainQuestionTimer) {
    clearTimeout(state.mainQuestionTimer)
    state.mainQuestionTimer = null
  }

  const ctx = await getDbRoundContext(matchId, supabase)
  if (!ctx) return

  const { match, round } = ctx
  const questionId = round.question_id || match.question_id || null
  const questionDb = await getQuestionForRound(matchId, questionId, supabase)
  if (!questionDb) return

  const steps = parseQuestionSteps(questionDb.steps)
  if (steps.length === 0) {
    console.error(`[${matchId}] ❌ transitionToSteps: no steps found`)
    return
  }

  const stepEndsAt = new Date(Date.now() + 15 * 1000).toISOString()

  // CAS transition: only move main -> steps once (prevents resetting timers)
  const { data: transitioned, error: transitionError } = await supabase
    .from('match_rounds')
    .update({
      status: 'steps',
      current_step_index: 0,
      step_ends_at: stepEndsAt
    })
    .eq('id', round.id)
    .eq('status', 'main')
    .select('id')
    .maybeSingle()

  if (transitionError) {
    console.error(`[${matchId}] ❌ transitionToSteps: failed to update match_rounds:`, transitionError)
    return
  }
  if (!transitioned) {
    // Already transitioned (another instance or earlier trigger)
    return
  }

  // Sync local state (best-effort)
  if (state) {
    state.currentPhase = 'steps'
    state.currentStepIndex = 0
    state.stepEndsAt = stepEndsAt
    state.eliminatedPlayers.clear()
    state.p1AllStepsComplete = false
    state.p2AllStepsComplete = false
  }

  const currentStep = steps[0]
  const phaseChangeEvent: PhaseChangeEvent = {
    type: 'PHASE_CHANGE',
    matchId,
    phase: 'steps',
    stepIndex: 0,
    totalSteps: steps.length,
    stepEndsAt,
    currentStep: {
      id: currentStep?.id || '',
      prompt: currentStep?.prompt || currentStep?.question || '',
      options: Array.isArray(currentStep?.options) ? currentStep.options : [],
      correctAnswer: currentStep?.correct_answer?.correctIndex ?? currentStep?.correctAnswer ?? 0,
      marks: currentStep?.marks || 0
    }
  }

  // FAST-PATH: broadcast to local sockets (clients still advance via Realtime)
  broadcastToMatch(matchId, phaseChangeEvent)

  const stepTimerId = setTimeout(() => {
    checkStepTimeout(matchId, 0, supabase)
  }, 15 * 1000) as unknown as number

  if (state) {
    state.stepTimers.set(0, stepTimerId)
  }
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
  const ctx = await getDbRoundContext(matchId, supabase)
  if (!ctx) return

  const { match, round, roundIndex } = ctx

  // Only act if DB still says we're on this step
  if (round.status !== 'steps' || round.current_step_index !== stepIndex) return

  // If DB has a deadline and we fired early, do nothing (another instance may reschedule)
  if (round.step_ends_at) {
    const endMs = new Date(round.step_ends_at).getTime()
    if (Date.now() + 50 < endMs) return
  }

  // On timeout: mark eliminations for players who didn't answer this step (optional but preserves intended rules)
  try {
    const { data: answers } = await supabase
      .from('match_step_answers_v2')
      .select('player_id')
      .eq('match_id', matchId)
      .eq('round_index', roundIndex)
      .eq('step_index', stepIndex)

    const answered = new Set<string>((answers ?? []).map((r: any) => r.player_id))
    const nowIso = new Date().toISOString()
    const eliminationUpdate: Record<string, any> = {}

    if (match.player1_id && !answered.has(match.player1_id) && !round.p1_eliminated_at) {
      eliminationUpdate.p1_eliminated_at = nowIso
    }
    if (match.player2_id && !answered.has(match.player2_id) && !round.p2_eliminated_at) {
      eliminationUpdate.p2_eliminated_at = nowIso
    }

    if (Object.keys(eliminationUpdate).length > 0) {
      await supabase
        .from('match_rounds')
        .update(eliminationUpdate)
        .eq('id', round.id)
    }
  } catch (err) {
    console.error(`[${matchId}] ❌ checkStepTimeout: elimination check failed:`, err)
  }

  // Call complete_step_v2 with force_timeout=true (plan requirement; advisory lock prevents double-advance)
  try {
    const { error: completeError } = await supabase.rpc('complete_step_v2', {
      p_match_id: matchId,
      p_round_index: roundIndex,
      p_step_index: stepIndex,
      p_force_timeout: true
    })
    if (completeError) {
      console.warn(`[${matchId}] ⚠️ complete_step_v2 (timeout) error:`, completeError)
    }
  } catch (err) {
    console.warn(`[${matchId}] ⚠️ complete_step_v2 (timeout) threw:`, err)
  }

  // Force advance to next step (or compute results if last step)
  await advanceFromStepDb(matchId, stepIndex, supabase)
}

/**
 * Move to next step or calculate results
 * @param playerId - Optional player ID who triggered this (for completion tracking)
 */
async function moveToNextStep(
  matchId: string,
  supabase: ReturnType<typeof createClient>,
  playerId: string | null = null
): Promise<void> {
  // Legacy wrapper retained for compatibility; DB-authoritative progression happens in advanceFromStepDb.
  const state = gameStates.get(matchId)
  const currentStepIndex = state?.currentStepIndex ?? null
  if (currentStepIndex == null) return
  await advanceFromStepDb(matchId, currentStepIndex, supabase)
}

/**
 * Calculate results for all steps
 */
async function calculateStepResults(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] *** calculateStepResults CALLED ***`)
  const state = gameStates.get(matchId) || null

  // Clear local timers (best-effort; canonical is DB)
  if (state) {
    state.stepTimers.forEach((timerId) => clearTimeout(timerId))
    state.stepTimers.clear()
  }

  const ctx = await getDbRoundContext(matchId, supabase)
  if (!ctx) return

  const { match, round, roundIndex } = ctx

  const questionId = round.question_id || match.question_id || null
  const questionDb = await getQuestionForRound(matchId, questionId, supabase)
  if (!questionDb) return

  const steps = parseQuestionSteps(questionDb.steps)
  if (steps.length === 0) {
    console.error(`[${matchId}] ❌ calculateStepResults: no steps found`)
    return
  }

  const p1Id: string | null = match.player1_id || null
  const p2Id: string | null = match.player2_id || null

  // DB-authoritative elimination flags
  const p1Eliminated = !!round.p1_eliminated_at
  const p2Eliminated = !!round.p2_eliminated_at

  // Load step answers from DB (cross-instance safe)
  const p1Answers = new Map<number, number>()
  const p2Answers = new Map<number, number>()
  try {
    const { data: answerRows, error: answersError } = await supabase
      .from('match_step_answers_v2')
      .select('player_id, step_index, selected_option')
      .eq('match_id', matchId)
      .eq('round_index', roundIndex)
      .eq('question_id', questionDb.id)

    if (answersError) {
      console.error(`[${matchId}] ❌ calculateStepResults: error fetching match_step_answers_v2:`, answersError)
    } else {
      for (const row of answerRows ?? []) {
        if (p1Id && row.player_id === p1Id) p1Answers.set(row.step_index, row.selected_option)
        if (p2Id && row.player_id === p2Id) p2Answers.set(row.step_index, row.selected_option)
      }
    }
  } catch (err) {
    console.error(`[${matchId}] ❌ calculateStepResults: exception fetching match_step_answers_v2:`, err)
  }

  // Format step results for RPC call
  const stepResultsArray: Array<{
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

    // If player is eliminated, they get 0 marks for this step
    const p1StepMarks = (p1Eliminated || !p1Correct) ? 0 : marks
    const p2StepMarks = (p2Eliminated || !p2Correct) ? 0 : marks

    stepResultsArray.push({
      stepIndex: index,
      correctAnswer,
      p1AnswerIndex: p1Answer,
      p2AnswerIndex: p2Answer,
      p1Marks: p1StepMarks,
      p2Marks: p2StepMarks
    })
  })

  const roundId = round.id

  // Call database RPC to compute results and write to database
  console.log(`[${matchId}] 📊 Calling compute_multi_step_results_v2 RPC with ${stepResultsArray.length} steps`)
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33e99397-07ed-449b-a525-dd11743750ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game-ws/index.ts:calculateStepResults',message:'BEFORE RPC CALL',data:{matchId,roundId,stepCount:stepResultsArray.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const { data: rpcResult, error: rpcError } = await supabase.rpc('compute_multi_step_results_v2', {
    p_match_id: matchId,
    p_round_id: roundId,
    p_step_results: stepResultsArray as any
  })
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33e99397-07ed-449b-a525-dd11743750ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game-ws/index.ts:calculateStepResults',message:'AFTER RPC CALL',data:{matchId,hasError:!!rpcError,hasResult:!!rpcResult,success:rpcResult?.success,error:rpcError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (rpcError) {
    console.error(`[${matchId}] ❌ Error calling compute_multi_step_results_v2:`, rpcError)
    // DO NOT broadcast WS-only results here - would break cross-instance sync
    // If RPC fails, we don't write to DB → no canonical state → let client timeout/recover
    return
  }

  if (!rpcResult?.success) {
    console.error(`[${matchId}] ❌ RPC returned error:`, rpcResult?.error)
    console.error(`[${matchId}] 🔍 DEBUG: RPC FAILED - NO SUCCESS - error=${rpcResult?.error}`)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/33e99397-07ed-449b-a525-dd11743750ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game-ws/index.ts:1291',message:'RPC FAILED - NO SUCCESS',data:{matchId,error:rpcResult?.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return
  }

  // RPC has written results_payload to database
  // Realtime subscription will deliver to both players simultaneously
  // Update in-memory state from RPC result
  const payload = rpcResult.results_payload
  console.log(`[${matchId}] 🔍 DEBUG: RPC SUCCESS - PAYLOAD RECEIVED - hasPayload=${!!payload}, mode=${payload?.mode}, resultsVersion=${rpcResult.results_version}`)
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33e99397-07ed-449b-a525-dd11743750ba',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game-ws/index.ts:1295',message:'RPC SUCCESS - PAYLOAD RECEIVED',data:{matchId,hasPayload:!!payload,payloadMode:payload?.mode,resultsVersion:rpcResult.results_version},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  if (payload) {
    // Persist round phase in match_rounds (DB-authoritative)
    try {
      const { error: roundStatusError } = await supabase
        .from('match_rounds')
        .update({
          status: 'results',
          step_ends_at: null,
          main_question_ends_at: null
        })
        .eq('id', roundId)
      if (roundStatusError) {
        console.warn(`[${matchId}] ⚠️ Failed to mark match_rounds.status='results' for round ${roundId}:`, roundStatusError)
      }
    } catch (err) {
      console.warn(`[${matchId}] ⚠️ Exception marking round status to results:`, err)
    }

    const roundWinner = payload.round_winner
    const matchOver = payload.match_over || false
    const matchWinnerId = payload.match_winner_id || null

    // Update round wins in memory state
    if (roundWinner) {
      const matchState = matchStates.get(matchId)
      if (matchState) {
        const currentWins = matchState.playerRoundWins.get(roundWinner) || 0
        matchState.playerRoundWins.set(roundWinner, currentWins + 1)
        console.log(`[${matchId}] 🏆 Round ${match.current_round_number || 0} won by ${roundWinner} (now has ${currentWins + 1} wins)`)
      }
      if (state) {
        const currentWins = state.playerRoundWins.get(roundWinner) || 0
        state.playerRoundWins.set(roundWinner, currentWins + 1)
      }
    }

    // Convert playerRoundWins from payload
    const playerRoundWinsObj: { [playerId: string]: number } = {}
    if (payload.p1?.total !== undefined && payload.p2?.total !== undefined) {
      if (p1Id) playerRoundWinsObj[p1Id] = payload.p1.total
      if (p2Id) playerRoundWinsObj[p2Id] = payload.p2.total
    }

    // RPC has written results_payload to database
    // CANONICAL: Realtime UPDATE delivers to all clients on all instances
    // FAST-PATH: Also broadcast via WebSocket for same-instance optimization
    console.log(`[${matchId}] ✅ Results written to DB (results_version=${rpcResult.results_version}) - Realtime delivers to all, WS fast-path for same-instance`)

    // FAST-PATH: Broadcast via WebSocket (only reaches same-instance sockets)
    // If both players are on this instance, they get instant results
    // If players are on different instances, Realtime will deliver shortly after
    const resultsEvent = {
      type: 'RESULTS_RECEIVED',
      results_payload: payload,
      results_version: rpcResult.results_version,
      round_number: payload.round_number || match.current_round_number || 0,
      round_id: payload.round_id || roundId
    }
    console.log(`[${matchId}] ⚡ WS fast-path: Broadcasting to local sockets`)
    broadcastToMatch(matchId, resultsEvent)

    // Initialize readiness tracking for results acknowledgment
    const matchState = matchStates.get(matchId)
    if (matchState) {
      matchState.p1ResultsAcknowledged = false
      matchState.p2ResultsAcknowledged = false
      matchState.roundTransitionInProgress = false
    }

    if (matchOver) {
      // Match finished - cleanup and don't start next round
      console.log(`[${matchId}] 🏁 Match finished - Winner: ${matchWinnerId}`)
      matchStates.delete(matchId)
      setTimeout(() => {
        cleanupGameState(matchId)
      }, 5000) // Give time for UI to show final results
    } else {
      // Don't auto-transition - wait for both players to acknowledge results
      console.log(`[${matchId}] ⏳ Waiting for both players to acknowledge results before starting next round`)
    }
  } else {
    console.error(`[${matchId}] ❌ RPC did not return results_payload`)
  }
}

/**
 * Handle EARLY_ANSWER message (skip main question phase)
 */
async function handleEarlyAnswer(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // Async segments ruleset: steps start immediately at ROUND_START.
  // Keep handler for backwards compatibility, but do not mutate shared round state.
  console.log(`[${matchId}] ⚡ Early answer received (no-op in async segments ruleset)`)
}

/**
 * Handle SUBMIT_SEGMENT_ANSWER message (async: no waiting between parts)
 */
async function handleSegmentAnswer(
  matchId: string,
  playerId: string,
  stepIndex: number,
  segment: 'main' | 'sub',
  answerIndex: number,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const ctx = await getDbRoundContext(matchId, supabase)
  if (!ctx) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Match round not ready'
    } as GameErrorEvent))
    return
  }

  const { match, round, roundIndex } = ctx

  if (playerId !== match.player1_id && playerId !== match.player2_id) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'You are not part of this match'
    } as GameErrorEvent))
    return
  }

  const questionId = round.question_id || match.question_id || null
  const questionDb = await getQuestionForRound(matchId, questionId, supabase)
  if (!questionDb) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Question not available'
    } as GameErrorEvent))
    return
  }

  const steps = parseQuestionSteps(questionDb.steps)
  const step = steps?.[stepIndex]
  if (!step) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid step index'
    } as GameErrorEvent))
    return
  }

  let correctAnswer = 0
  if (segment === 'main') {
    correctAnswer = step?.correct_answer?.correctIndex ?? step?.correctAnswer ?? 0
  } else {
    const sub = step?.subStep || step?.sub_step
    if (!sub) {
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Sub-step not configured'
      } as GameErrorEvent))
      return
    }
    correctAnswer = sub?.correct_answer?.correctIndex ?? sub?.correctAnswer ?? 0
  }

  const isCorrect = answerIndex === correctAnswer

  const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_segment_v1', {
    p_match_id: matchId,
    p_round_id: round.id,
    p_player_id: playerId,
    p_step_index: stepIndex,
    p_segment: segment,
    p_answer_index: answerIndex,
    p_is_correct: isCorrect
  })

  if (rpcError || !rpcResult?.success) {
    console.error(`[${matchId}] ❌ submit_segment_v1 failed:`, rpcError || rpcResult)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: rpcError?.message || rpcResult?.error || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  // Resync path
  if (rpcResult.out_of_sync && rpcResult.canonical) {
    const c = rpcResult.canonical
    const cStepIndex = c.stepIndex ?? 0
    const cSegment = (c.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
    await sendSegmentStartToPlayer(matchId, playerId, questionDb, cStepIndex, cSegment, c.segmentEndsAt ?? null)
    const state = gameStates.get(matchId)
    state?.lastSentSegmentKeyByPlayer.set(playerId, `${cStepIndex}:${cSegment}`)
    return
  }

  // Next segment (immediate advance)
  if (!rpcResult.completed && rpcResult.next) {
    const n = rpcResult.next
    const nextStepIndex = n.stepIndex ?? stepIndex
    const nextSegment = (n.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
    await sendSegmentStartToPlayer(matchId, playerId, questionDb, nextStepIndex, nextSegment, n.segmentEndsAt ?? null)
    const state = gameStates.get(matchId)
    state?.lastSentSegmentKeyByPlayer.set(playerId, `${nextStepIndex}:${nextSegment}`)
  }

  // Completion + results gate (only wait at end)
  const { data: progressRows } = await supabase
    .from('match_round_player_progress_v1')
    .select('player_id, completed_at')
    .eq('match_id', matchId)
    .eq('round_id', round.id)

  const p1Complete = !!progressRows?.find((r: any) => r.player_id === match.player1_id)?.completed_at
  const p2Complete = !!progressRows?.find((r: any) => r.player_id === match.player2_id)?.completed_at

  // Notify completion state (client shows waiting screen only after their own completion)
  broadcastToMatch(matchId, {
    type: 'ALL_STEPS_COMPLETE_WAITING',
    p1Complete,
    p2Complete
  })

  const state = gameStates.get(matchId)
  if (state) {
    state.p1AllStepsComplete = p1Complete
    state.p2AllStepsComplete = p2Complete
  }

  // If both completed, compute + broadcast results immediately
  if (p1Complete && p2Complete && state?.lastResultsRoundIdBroadcasted !== round.id) {
    const { data: computeResult, error: computeError } = await supabase.rpc('compute_multi_step_results_v3', {
      p_match_id: matchId,
      p_round_id: round.id
    })
    if (computeError) {
      console.error(`[${matchId}] ❌ compute_multi_step_results_v3 failed:`, computeError)
      return
    }
    if (computeResult?.success && computeResult?.results_payload) {
      const payload = computeResult.results_payload
      broadcastToMatch(matchId, {
        type: 'RESULTS_RECEIVED',
        results_payload: payload,
        results_version: computeResult.results_version,
        round_number: payload.round_number || match.current_round_number || 0,
        round_id: payload.round_id || round.id
      })
      if (state) state.lastResultsRoundIdBroadcasted = round.id

      if (payload.match_over) {
        setTimeout(() => cleanupGameState(matchId), 5000)
      }
    }
  }
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
  const ctx = await getDbRoundContext(matchId, supabase)
  if (!ctx) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Match round not ready'
    } as GameErrorEvent))
    return
  }

  const { match, round, roundIndex } = ctx

  if (playerId !== match.player1_id && playerId !== match.player2_id) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'You are not part of this match'
    } as GameErrorEvent))
    return
  }

  if (round.status !== 'steps') {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Round is not in steps phase'
    } as GameErrorEvent))
    return
  }

  if (round.current_step_index !== stepIndex) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Out of sync: step already advanced'
    } as GameErrorEvent))
    return
  }

  // If eliminated in DB, reject
  const isP1 = match.player1_id === playerId
  const isP2 = match.player2_id === playerId
  if ((isP1 && round.p1_eliminated_at) || (isP2 && round.p2_eliminated_at)) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'You have been eliminated from this round'
    } as GameErrorEvent))
    return
  }

  const questionId = round.question_id || match.question_id || null
  const questionDb = await getQuestionForRound(matchId, questionId, supabase)
  if (!questionDb) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Question not available'
    } as GameErrorEvent))
    return
  }

  const steps = parseQuestionSteps(questionDb.steps)
  const step = steps?.[stepIndex]
  if (!step) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid step index'
    } as GameErrorEvent))
    return
  }

  const correctAnswer = step?.correct_answer?.correctIndex ?? step?.correctAnswer ?? 0
  const isCorrect = answerIndex === correctAnswer

  // Write answer to DB (authoritative; used for cross-instance completion)
  const { error: upsertError } = await supabase
    .from('match_step_answers_v2')
    .upsert({
      match_id: matchId,
      round_index: roundIndex,
      question_id: questionDb.id,
      player_id: playerId,
      step_index: stepIndex,
      selected_option: answerIndex,
      is_correct: isCorrect,
      response_time_ms: 0
    })

  if (upsertError) {
    console.error(`[${matchId}] ❌ [STEP] DB upsert error for step ${stepIndex}:`, upsertError)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Failed to submit step answer'
    } as GameErrorEvent))
    return
  }

  // Track in memory (best-effort debugging only)
  const state = gameStates.get(matchId)
  if (state) {
    if (!state.playerStepAnswers.has(playerId)) state.playerStepAnswers.set(playerId, new Map())
    state.playerStepAnswers.get(playerId)!.set(stepIndex, answerIndex)
  }

  // Determine if the step is complete via DB RPC (cross-instance safe)
  let advanced = false
  try {
    const { data: completeResult, error: completeError } = await supabase.rpc('complete_step_v2', {
      p_match_id: matchId,
      p_round_index: roundIndex,
      p_step_index: stepIndex,
      p_force_timeout: false
    })
    if (completeError) {
      console.warn(`[${matchId}] ⚠️ complete_step_v2 error:`, completeError)
    } else {
      advanced = !!(completeResult as any)?.advanced
    }
  } catch (err) {
    console.warn(`[${matchId}] ⚠️ complete_step_v2 threw:`, err)
  }

  // ACK submitter
  const stepAnswerEvent: StepAnswerReceivedEvent = {
    type: 'STEP_ANSWER_RECEIVED',
    stepIndex,
    playerId,
    waitingForOpponent: !advanced
  }
  socket.send(JSON.stringify(stepAnswerEvent))

  if (advanced) {
    // Clear local timer for this step (best-effort; canonical is DB)
    if (state) {
      const currentTimer = state.stepTimers.get(stepIndex)
      if (currentTimer) {
        clearTimeout(currentTimer)
        state.stepTimers.delete(stepIndex)
      }
    }
    await advanceFromStepDb(matchId, stepIndex, supabase)
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
      .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner, current_round_id')
      .eq('id', matchId)
      .single()

    if (matchResults) {
      // Persist round phase in match_rounds (DB-authoritative)
      try {
        const roundIdToMark = (matchResults as any).current_round_id ?? null
        if (roundIdToMark) {
          const { error: roundStatusError } = await supabase
            .from('match_rounds')
            .update({
              status: 'results',
              step_ends_at: null,
              main_question_ends_at: null
            })
            .eq('id', roundIdToMark)
          if (roundStatusError) {
            console.warn(`[${matchId}] ⚠️ Failed to mark match_rounds.status='results' for round ${roundIdToMark}:`, roundStatusError)
          }
        }
      } catch (err) {
        console.warn(`[${matchId}] ⚠️ Exception marking round status to results:`, err)
      }

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
          p2Id: matchData?.player2_id || null,
          p1ResultsAcknowledged: false,
          p2ResultsAcknowledged: false,
          roundTransitionInProgress: false
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
      
      // Initialize readiness tracking for results acknowledgment
      matchState.p1ResultsAcknowledged = false
      matchState.p2ResultsAcknowledged = false
      matchState.roundTransitionInProgress = false

      if (matchOver) {
        // Match finished - cleanup and don't start next round
        console.log(`[${matchId}] 🏁 Match finished - Winner: ${matchWinnerId}`)
        matchStates.delete(matchId)
      } else {
        // Increment round number for next round
        matchState.roundNumber = currentRoundNum + 1
        // Don't auto-transition - wait for both players to acknowledge results
        console.log(`[${matchId}] ⏳ Waiting for both players to acknowledge results before starting next round`)
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
  console.log(`[${matchId}] [V2] SUBMIT_ANSWER from player ${playerId}, answer: ${answer}`)

  // Validate answer index
  if (answer !== 0 && answer !== 1) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid answer: must be 0 or 1'
    } as GameErrorEvent))
    return
  }

  // Call v2 RPC (single source of truth)
  const { data, error } = await supabase.rpc('submit_round_answer_v2', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_answer: answer
  })

  if (error) {
    console.error(`[${matchId}] ❌ [V2] Error submitting answer:`, error)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: error.message || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  if (!data?.success) {
    console.error(`[${matchId}] ❌ [V2] RPC returned error:`, data?.error || data?.reason)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: data?.error || data?.reason || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  // Send confirmation to submitter
  socket.send(JSON.stringify({
    type: 'ANSWER_SUBMITTED',
    both_answered: data.both_answered
  }))

  // Realtime will deliver results to all clients (primary mechanism)
  // WebSocket broadcast as fallback in case Realtime is delayed/fails
  if (data.both_answered && data.results_payload) {
    // Clear timeout since both answered early
    const existingTimeout = matchTimeouts.get(matchId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      matchTimeouts.delete(matchId)
      console.log(`[${matchId}] ✅ [V2] Cleared timeout - both players answered early`)
    }

    // Persist round phase in match_rounds (DB-authoritative) so old rounds don't remain main/steps
    try {
      let roundIdToMark: string | null =
        (data.results_payload as any)?.round_id ??
        (data.results_payload as any)?.roundId ??
        null

      if (!roundIdToMark) {
        const { data: matchRow } = await supabase
          .from('matches')
          .select('current_round_id')
          .eq('id', matchId)
          .maybeSingle()
        roundIdToMark = (matchRow as any)?.current_round_id ?? null
      }

      if (roundIdToMark) {
        const { error: roundStatusError } = await supabase
          .from('match_rounds')
          .update({
            status: 'results',
            step_ends_at: null,
            main_question_ends_at: null
          })
          .eq('id', roundIdToMark)
        if (roundStatusError) {
          console.warn(`[${matchId}] ⚠️ [V2] Failed to mark match_rounds.status='results' for round ${roundIdToMark}:`, roundStatusError)
        }
      }
    } catch (err) {
      console.warn(`[${matchId}] ⚠️ [V2] Exception marking round status to results:`, err)
    }

    // PRIMARY: Realtime will deliver results (works across Edge instances)
    // FALLBACK: Also send WebSocket message in case Realtime is delayed/fails
    console.log(`[${matchId}] ✅ [V2] Results computed - sending via WebSocket (Realtime fallback)`)
    
    const resultsEvent = {
      type: 'RESULTS_RECEIVED',
      results_payload: data.results_payload,
      results_version: data.results_version || 0,
      round_number: data.results_payload?.round_number || 0
    }
    broadcastToMatch(matchId, resultsEvent)

    // Initialize readiness tracking for results acknowledgment
    const matchState = matchStates.get(matchId)
    if (matchState) {
      matchState.p1ResultsAcknowledged = false
      matchState.p2ResultsAcknowledged = false
      matchState.roundTransitionInProgress = false
    }

    // Don't auto-transition - wait for both players to acknowledge results
    console.log(`[${matchId}] ⏳ [V2] Waiting for both players to acknowledge results before starting next round`)
  } else {
    // Only one answered - get match to determine player role for broadcast
    const { data: matchData } = await supabase
      .from('matches')
      .select('player1_id, player2_id')
      .eq('id', matchId)
      .single()
    
    if (matchData) {
      const answerReceivedEvent: AnswerReceivedEvent = {
        type: 'ANSWER_RECEIVED',
        player: matchData.player1_id === playerId ? 'player1' : 'player2',
        waiting_for_opponent: true
      }
      broadcastToMatch(matchId, answerReceivedEvent)
    }
  }
}

/**
 * Handle round transition after both players acknowledge results
 * - Checks if both players are ready
 * - Fetches fresh match state from database
 * - If match finished, broadcasts MATCH_FINISHED
 * - If match continues, starts next round
 * - Includes idempotency checks to prevent double-firing
 */
async function handleRoundTransition(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🔄 Checking match state for round transition...`)
  
  const matchState = matchStates.get(matchId)
  if (!matchState) {
    console.error(`[${matchId}] ❌ No match state found for round transition`)
    return
  }

  // Idempotency check: prevent double-firing
  if (matchState.roundTransitionInProgress) {
    console.log(`[${matchId}] ⚠️ Round transition already in progress - skipping`)
    return
  }

  // Check if both players have acknowledged results
  if (!matchState.p1ResultsAcknowledged || !matchState.p2ResultsAcknowledged) {
    console.log(`[${matchId}] ⏳ Not all players ready - P1: ${matchState.p1ResultsAcknowledged}, P2: ${matchState.p2ResultsAcknowledged}`)
    return
  }

  // Mark transition as in progress
  matchState.roundTransitionInProgress = true
  
  // Fetch fresh match state from database (don't use cached state)
  const { data: dbMatchState, error: stateError } = await supabase
    .from('matches')
    .select('winner_id, status, current_round_id')
    .eq('id', matchId)
    .single()
  
  if (stateError || !dbMatchState) {
    console.error(`[${matchId}] ❌ Failed to fetch match state:`, stateError)
    matchState.roundTransitionInProgress = false
    return
  }
  
  // If match finished, broadcast MATCH_FINISHED
  if (dbMatchState.winner_id !== null) {
    // Mark current round as done in DB (best-effort)
    try {
      const prevRoundId = (dbMatchState as any).current_round_id ?? null
      if (prevRoundId) {
        const { error: roundDoneError } = await supabase
          .from('match_rounds')
          .update({
            status: 'done',
            step_ends_at: null,
            main_question_ends_at: null
          })
          .eq('id', prevRoundId)
        if (roundDoneError) {
          console.warn(`[${matchId}] ⚠️ Failed to mark prior round done (${prevRoundId}) on match finish:`, roundDoneError)
        }
      }
    } catch (err) {
      console.warn(`[${matchId}] ⚠️ Exception marking prior round done on match finish:`, err)
    }

    console.log(`[${matchId}] 🏆 Match finished - winner: ${dbMatchState.winner_id}`)
    
    const totalRounds = matchState.roundNumber || 0
    
    const matchFinishedEvent: MatchFinishedEvent = {
      type: 'MATCH_FINISHED',
      winner_id: dbMatchState.winner_id,
      total_rounds: totalRounds
    }
    
    broadcastToMatch(matchId, matchFinishedEvent)
    matchStates.delete(matchId)
    return
  }
  
  // Match continues - start next round
  console.log(`[${matchId}] ➡️ Match continues - starting next round...`)

  // Mark prior round as done in DB so it can't remain main/steps forever (best-effort)
  try {
    const prevRoundId = (dbMatchState as any).current_round_id ?? null
    if (prevRoundId) {
      const { error: roundDoneError } = await supabase
        .from('match_rounds')
        .update({
          status: 'done',
          step_ends_at: null,
          main_question_ends_at: null
        })
        .eq('id', prevRoundId)
      if (roundDoneError) {
        console.warn(`[${matchId}] ⚠️ Failed to mark prior round done (${prevRoundId}) before starting next round:`, roundDoneError)
      }
    }
  } catch (err) {
    console.warn(`[${matchId}] ⚠️ Exception marking prior round done before starting next round:`, err)
  }
  
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
      matchState.roundTransitionInProgress = false
      return
    }
    console.error(`[${matchId}] ❌ Error starting next round:`, resetError)
    matchState.roundTransitionInProgress = false
    return
  }
  
  if (!resetResult?.success) {
    console.error(`[${matchId}] ❌ Failed to start next round:`, resetResult?.error)
    matchState.roundTransitionInProgress = false
    return
  }
  
  console.log(`[${matchId}] ✅ Round reset successful - selecting next question...`)
  
  // Reset readiness flags for next round
  matchState.p1ResultsAcknowledged = false
  matchState.p2ResultsAcknowledged = false
  matchState.roundTransitionInProgress = false
  
  // Select and broadcast next question
  await selectAndBroadcastQuestion(matchId, supabase)
  
  // Optionally broadcast ROUND_STARTED event (using in-memory state instead of DB columns)
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
 * Handle READY_FOR_NEXT_ROUND message
 * - Marks player as ready for next round
 * - Checks if both players are ready
 * - Starts next round if both are ready
 */
async function handleReadyForNextRound(
  matchId: string,
  playerId: string,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] ✅ READY_FOR_NEXT_ROUND from player ${playerId}`)
  
  const matchState = matchStates.get(matchId)
  if (!matchState) {
    console.error(`[${matchId}] ❌ No match state found`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Match state not found'
    } as GameErrorEvent))
    return
  }

  // Determine which player this is
  const isP1 = matchState.p1Id === playerId
  const isP2 = matchState.p2Id === playerId

  if (!isP1 && !isP2) {
    console.error(`[${matchId}] ❌ Player ${playerId} not in match`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'You are not part of this match'
    } as GameErrorEvent))
    return
  }

  // Mark player as ready
  if (isP1) {
    matchState.p1ResultsAcknowledged = true
  } else {
    matchState.p2ResultsAcknowledged = true
  }

  // Check if both players are ready
  const bothReady = matchState.p1ResultsAcknowledged && matchState.p2ResultsAcknowledged

  // Send acknowledgment to this player
  const readyEvent = {
    type: 'READY_FOR_NEXT_ROUND',
    playerId,
    waitingForOpponent: !bothReady
  }
  socket.send(JSON.stringify(readyEvent))

  // Broadcast to opponent if they're waiting
  if (!bothReady) {
    const opponentId = isP1 ? matchState.p2Id : matchState.p1Id
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      matchSockets.forEach((s) => {
        if (s !== socket && s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify(readyEvent))
        }
      })
    }
    console.log(`[${matchId}] ⏳ Waiting for opponent - P1: ${matchState.p1ResultsAcknowledged}, P2: ${matchState.p2ResultsAcknowledged}`)
  } else {
    // Both players ready - start next round
    console.log(`[${matchId}] ✅ Both players ready - starting next round`)
    await handleRoundTransition(matchId, supabase)
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
  try {
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
      console.error(`[${matchId || 'unknown'}] Auth error:`, userError)
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

    let socket: WebSocket
    let response: Response
    try {
      const upgradeResult = Deno.upgradeWebSocket(req)
      socket = upgradeResult.socket
      response = upgradeResult.response
    } catch (upgradeError) {
      console.error(`[${matchId}] Failed to upgrade WebSocket:`, upgradeError)
      return new Response('WebSocket upgrade failed', { 
        status: 500,
        headers: corsHeaders 
      })
    }

  // Track socket
  if (!sockets.has(matchId)) {
    sockets.set(matchId, new Set())
  }
  sockets.get(matchId)!.add(socket)
  socketMeta.set(socket, { matchId, userId: user.id })

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
    try {
      console.log(`[${matchId}] 📨 Raw message received:`, event.data)
      const message = JSON.parse(event.data)
      console.log(`[${matchId}] 📨 Parsed message:`, message)

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
      } else if (message.type === 'SUBMIT_SEGMENT_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_SEGMENT_ANSWER from user ${user.id}`)
        const seg = (message.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
        await handleSegmentAnswer(matchId, user.id, message.stepIndex, seg, message.answerIndex, socket, supabase)
      } else if (message.type === 'SUBMIT_STEP_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_STEP_ANSWER from user ${user.id}`)
        // Backwards compatibility: infer current segment from progress table (main/sub)
        let inferred: 'main' | 'sub' = 'main'
        try {
          const ctx = await getDbRoundContext(matchId, supabase)
          if (ctx?.round?.id) {
            const { data: progressRow } = await supabase
              .from('match_round_player_progress_v1')
              .select('current_segment')
              .eq('match_id', matchId)
              .eq('round_id', ctx.round.id)
              .eq('player_id', user.id)
              .maybeSingle()
            if ((progressRow as any)?.current_segment === 'sub') inferred = 'sub'
          }
        } catch (_err) {
          // ignore - default to main
        }
        await handleSegmentAnswer(matchId, user.id, message.stepIndex, inferred, message.answerIndex, socket, supabase)
      } else if (message.type === 'SUBMIT_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_ANSWER from user ${user.id}`)
        // Check if we're in step phase - if so, route to step handler
        const state = gameStates.get(matchId)
        if (state && state.currentPhase === 'steps') {
          // Infer current segment from DB progress, then submit as that segment
          let stepIdx = state.currentStepIndex
          let seg: 'main' | 'sub' = 'main'
          try {
            const ctx = await getDbRoundContext(matchId, supabase)
            if (ctx?.round?.id) {
              const { data: progressRow } = await supabase
                .from('match_round_player_progress_v1')
                .select('current_step_index, current_segment')
                .eq('match_id', matchId)
                .eq('round_id', ctx.round.id)
                .eq('player_id', user.id)
                .maybeSingle()
              if (progressRow) {
                stepIdx = (progressRow as any).current_step_index ?? stepIdx
                seg = (String((progressRow as any).current_segment) === 'sub' ? 'sub' : 'main') as any
              }
              await handleSegmentAnswer(matchId, user.id, stepIdx, seg, message.answer, socket, supabase)
            }
          } catch (_err) {
            // Fallback: treat as main
            await handleSegmentAnswer(matchId, user.id, stepIdx, 'main', message.answer, socket, supabase)
          }
        } else {
          // V2: Always use handleSubmitAnswerV2 (migrations must be deployed first)
          await handleSubmitAnswerV2(matchId, user.id, message.answer, socket, supabase)
        }
      } else if (message.type === 'READY_FOR_NEXT_ROUND') {
        console.log(`[${matchId}] Processing READY_FOR_NEXT_ROUND from user ${user.id}`)
        await handleReadyForNextRound(matchId, user.id, socket, supabase)
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
      socketMeta.delete(socket)
      if (matchSockets.size === 0) {
        sockets.delete(matchId)
        // Cleanup game state when all sockets disconnected
        cleanupGameState(matchId)
      }
    }
  }

  socket.onerror = (error) => {
    console.error(`[${matchId}] WebSocket error:`, error)
    console.error(`[${matchId}] WebSocket error details:`, {
      type: error?.type,
      target: error?.target,
      error: String(error)
    })
  }

  return response
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(`Internal server error: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
      headers: corsHeaders
    })
  }
})

