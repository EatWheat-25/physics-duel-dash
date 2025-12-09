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
  phase: 'thinking'
  question: {
    id: string
    title: string
    subject: string
    chapter: string
    level: string
    difficulty: string
    questionText: string
    totalMarks: number
    steps: Array<{
      id: string
      question: string
      options: string[]
      correctAnswer: number
      marks: number
      explanation?: string
    }>
    topicTags?: string[]
    rankTier?: string
  }
  thinkingEndsAt: string
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

interface ResultsReceivedEvent {
  type: 'RESULTS_RECEIVED'
  player1_answer: number | null
  player2_answer: number | null
  correct_answer: number
  player1_correct: boolean
  player2_correct: boolean
  round_winner: string | null
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
 * Atomic question selection and broadcast for Stage 1
 * 
 * Ensures both players see the same question by:
 * 1. Checking if question_id already exists (idempotency)
 * 2. Atomically claiming a question using UPDATE ... WHERE question_id IS NULL
 * 3. Filtering for True/False questions (2 options)
 * 4. Broadcasting QUESTION_RECEIVED with raw question object
 */
async function selectAndBroadcastQuestion(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🔒 Starting atomic question selection...`)
  
  try {
    // 1. Get match with safety checks
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('subject, mode, status, winner_id, question_id, question_sent_at')
      .eq('id', matchId)
      .single()

    if (matchError) {
      console.error(`[${matchId}] ❌ Error fetching match:`, matchError)
      throw matchError
    }

    // Safety checks
    if (!match || match.status !== 'in_progress' || match.winner_id) {
      console.warn(`[${matchId}] ⚠️ Match not ready for question selection (status: ${match?.status}, winner: ${match?.winner_id})`)
      return
    }

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
        
        // Note: is_active column may not exist yet - skip it for now
        // If you add is_active migration later, uncomment: q = q.eq('is_active', true)
        
        if (filters.subject && subject) q = q.eq('subject', subject)
        if (filters.level && level) q = q.eq('level', level)
        
        const { data, error } = await q
        
        if (error) {
          console.warn(`[${matchId}] ⚠️ Tier fetch error:`, error)
          return []
        }
        
        return (data ?? []).filter((q: any) => {
          // Early filter: ensure steps exist and are non-empty
          try {
            const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
            return Array.isArray(steps) && steps.length > 0
          } catch {
            return false
          }
        })
      }

      // Fetch in tiers (most specific to least specific)
      const tiers = [
        await fetchTier({ subject: true, level: true }),   // Tier 1: Match both
        await fetchTier({ subject: true, level: false }),   // Tier 2: Match subject only
        await fetchTier({ subject: false, level: true }),   // Tier 3: Match level only
        await fetchTier({ subject: false, level: false })   // Tier 4: Any question
      ]

      // Filter for True/False questions (keep fallback)
      const isTF = (q: any) => {
        try {
          const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
          const first = steps?.[0]
          const opts = first?.options ?? []
          // Check type field first, then fallback to option count
          return first?.type === 'true_false' || (Array.isArray(opts) && opts.length === 2)
        } catch {
          return false
        }
      }

      // Find first tier with TF questions
      const tfPool = tiers.flatMap(list => list.filter(isTF))

      if (tfPool.length === 0) {
        console.error(`[${matchId}] ❌ No True/False questions available`)
        throw new Error('No True/False questions available')
      }

      // Pick random from TF pool
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
        .is('question_id', null) // Atomic lock: only update if NULL
        .select('id, question_id')
        .maybeSingle()

      if (lockError) {
        console.error(`[${matchId}] ❌ Lock error:`, lockError)
        throw lockError
      }

      if (!lock) {
        // Lost race condition - another instance claimed it first
        console.log(`[${matchId}] ⚠️ Lost atomic lock, re-reading question_id...`)
        
        // Re-fetch the question that was claimed by the winner
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
        // Won the lock
        questionDb = selectedQuestion
        console.log(`[${matchId}] ✅ Won atomic lock, claimed question: ${questionDb.id}`)
      }
    }

    // Broadcast QUESTION_RECEIVED with raw question object
    const matchSockets = sockets.get(matchId)
    if (!matchSockets || matchSockets.size === 0) {
      console.warn(`[${matchId}] ⚠️ No sockets found for match - cannot send QUESTION_RECEIVED`)
      return
    }

    // Timeout for answer submission (60 seconds / 1 minute)
    const TIMEOUT_SECONDS = 60
    
    // Calculate timer end time (60 seconds from now)
    const timerEndAt = new Date(Date.now() + TIMEOUT_SECONDS * 1000).toISOString()
    
    const questionReceivedEvent: QuestionReceivedEvent = {
      type: 'QUESTION_RECEIVED',
      question: questionDb, // Send raw DB object
      timer_end_at: timerEndAt
    }
    
    let sentCount = 0
    matchSockets.forEach((socket, index) => {
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
    
    console.log(`[${matchId}] 📊 QUESTION_RECEIVED sent to ${sentCount}/${matchSockets.size} sockets`)
    
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
  const { data: matchState, error: stateError } = await supabase
    .from('matches')
    .select('winner_id, status, round_number, last_round_winner, consecutive_wins_count')
    .eq('id', matchId)
    .single()
  
  if (stateError || !matchState) {
    console.error(`[${matchId}] ❌ Failed to fetch match state:`, stateError)
    return
  }
  
  // If match finished, broadcast MATCH_FINISHED
  if (matchState.winner_id !== null) {
    console.log(`[${matchId}] 🏆 Match finished - winner: ${matchState.winner_id}`)
    
    const matchFinishedEvent: MatchFinishedEvent = {
      type: 'MATCH_FINISHED',
      winner_id: matchState.winner_id,
      total_rounds: matchState.round_number || 0
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
  
  // Optionally broadcast ROUND_STARTED event
  const { data: updatedMatch } = await supabase
    .from('matches')
    .select('round_number, last_round_winner, consecutive_wins_count')
    .eq('id', matchId)
    .single()
  
  if (updatedMatch) {
    const roundStartedEvent: RoundStartedEvent = {
      type: 'ROUND_STARTED',
      round_number: updatedMatch.round_number || 0,
      last_round_winner: updatedMatch.last_round_winner,
      consecutive_wins_count: updatedMatch.consecutive_wins_count || 0
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
      // NOTE: checkAndBroadcastBothConnected will re-check the database
      // right before broadcasting to catch any disconnects
      const broadcastSuccess = await checkAndBroadcastBothConnected(matchId, match, supabase)
      
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
        console.log(`[${matchId}] 🎮 Both players connected - starting atomic question selection...`)
        await selectAndBroadcastQuestion(matchId, supabase)
        
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
    try {
      console.log(`[${matchId}] 📨 Raw message received:`, event.data)
      const message = JSON.parse(event.data)
      console.log(`[${matchId}] 📨 Parsed message:`, message)

      if (message.type === 'JOIN_MATCH') {
        console.log(`[${matchId}] Processing JOIN_MATCH from user ${user.id}`)
        await handleJoinMatch(matchId, user.id, socket, supabase)
      } else if (message.type === 'SUBMIT_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_ANSWER from user ${user.id}`)
        await handleSubmitAnswer(matchId, user.id, message.answer, socket, supabase)
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
      }
    }
  }

  socket.onerror = (error) => {
    console.error(`[${matchId}] WebSocket error:`, error)
  }

  return response
})

