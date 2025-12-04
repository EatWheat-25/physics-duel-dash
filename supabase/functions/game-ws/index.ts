import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Game WebSocket - Stage 2.5 Runtime Flow
 * 
 * Handles full match lifecycle:
 * - Match start via start_match RPC
 * - Round creation and question picking
 * - Answer submission via submit_round_answer RPC
 * - Round evaluation via evaluate_round RPC
 * - Match completion via finish_match RPC
 */

// Database question type (matches public.questions table)
type DbQuestion = {
  id: string
  subject: string
  level: string
  question_text: string | null
  text: string | null
  title: string | null
  steps: any
}

type StepOption = {
  answer_index: number
  text: string
}

type Step = {
  step_index: number
  prompt: string
  options: StepOption[]
  // keep extras for later scoring/explanations if you want
  marks?: number
  explanation?: string
  correct_answer_index?: number | null
}

type StepBasedQuestion = {
  id: string
  subject: string
  level: string
  text: string
  version: 1
  steps: Step[]
}

/**
 * Map database question row to StepBasedQuestion format
 * This matches what the frontend expects
 */
function mapDbQuestionToStepBased(row: DbQuestion): StepBasedQuestion {
  const rawSteps = (row.steps ?? []) as any[]

  const steps: Step[] = rawSteps.map((step, index) => {
    const opts = (step.options ?? []) as string[]

    return {
      step_index: index,
      prompt: step.question ?? row.question_text ?? row.text ?? row.title ?? '',
      options: opts.map((optText, i) => ({
        answer_index: i,
        text: optText,
      })),
      marks: step.marks ?? 1,
      explanation: step.explanation ?? null,
      correct_answer_index:
        typeof step.correctAnswer === 'number' ? step.correctAnswer : null,
    }
  })

  return {
    id: row.id,
    subject: row.subject,
    level: row.level,
    text: row.question_text ?? row.text ?? row.title ?? '',
    version: 1,
    steps,
  }
}

// Message types
interface MatchStartMsg {
  type: 'MATCH_START'
  matchId: string
  roundId: string
  roundNumber: number
}

interface RoundStartMsg {
  type: 'ROUND_START'
  matchId: string
  roundId: string
  roundNumber: number
  question: any // StepBasedQuestion format (mapped via questionMapper)
}

interface RoundResultMsg {
  type: 'ROUND_RESULT'
  matchId: string
  roundId: string
  roundNumber: number
  roundWinnerId: string | null
  player1RoundScore: number
  player2RoundScore: number
  matchContinues: boolean
  matchWinnerId: string | null
}

interface MatchFinishedMsg {
  type: 'MATCH_FINISHED'
  matchId: string
  winnerId: string | null
  player1FinalScore: number
  player2FinalScore: number
  totalRounds: number
}

interface GameErrorEvent {
  type: 'GAME_ERROR'
  message: string
  code?: string
}

interface SubmitRoundAnswerMsg {
  type: 'SUBMIT_ROUND_ANSWER'
  matchId: string
  roundId: string
  payload: {
    version: number
    steps: Array<{ step_index: number; answer_index: number; response_time_ms: number }>
  }
}

// Simple in-memory socket tracking
const sockets = new Map<string, Set<WebSocket>>()

/**
 * Broadcast message to all sockets in a match room
 */
function broadcastToMatch(matchId: string, msg: any): void {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets) {
    console.warn(`[${matchId}] No sockets found for match`)
    return
  }
  
  const msgStr = JSON.stringify(msg)
  let sent = 0
  for (const socket of matchSockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(msgStr)
      sent++
    }
  }
  console.log(`[${matchId}] 📤 Broadcast ${msg.type} to ${sent}/${matchSockets.size} sockets`)
}

/**
 * Pick a question for a match, avoiding duplicates
 * TODO: Implement real scoring logic in submit_round_answer RPC
 * TODO: Add proper timeout handling (round_deadline enforcement)
 * TODO: Add reconnection logic for dropped WebSocket connections
 */
async function pickQuestionForMatch(
  matchId: string,
  subject: string,
  mode: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ raw: DbQuestion; mapped: StepBasedQuestion } | null> {
  // Get already used question IDs for this match
  const { data: usedRounds } = await supabase
    .from('match_rounds')
    .select('question_id')
    .eq('match_id', matchId)
  
  const usedQuestionIds = new Set((usedRounds || []).map(r => r.question_id))
  
  // Try to find unused question matching subject and level
  let { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('subject', subject)
    .eq('level', mode)
  
  // Filter out used questions
  const unusedQuestions = (questions || []).filter(q => !usedQuestionIds.has(q.id))
  let question: DbQuestion | null = unusedQuestions.length > 0 ? unusedQuestions[0] as DbQuestion : null
  
  // Fallback: any question for that subject/level (allow reuse)
  if (!question) {
    const { data: fallbackQuestion } = await supabase
      .from('questions')
      .select('*')
      .eq('subject', subject)
      .eq('level', mode)
      .limit(1)
      .maybeSingle()
    
    question = fallbackQuestion as DbQuestion | null
  }
  
  if (!question) {
    console.error(`[${matchId}] No question found for subject=${subject}, level=${mode}`)
    return null
  }
  
  // Map to StepBasedQuestion format using helper
  const mapped = mapDbQuestionToStepBased(question)
  
  return { raw: question, mapped }
}

/**
 * Create a new round for a match
 */
async function createRound(
  match: any,
  previousRoundNumber: number,
  supabase: ReturnType<typeof createClient>
): Promise<{ roundId: string; roundNumber: number; question: any } | null> {
  const questionData = await pickQuestionForMatch(
    match.id,
    match.subject || 'math',
    match.mode || 'A2',
    supabase
  )
  
  if (!questionData) {
    console.error(`[${match.id}] Failed to pick question for round ${previousRoundNumber + 1}`)
    return null
  }
  
  const roundNumber = previousRoundNumber + 1
  
  const { data: round, error } = await supabase
    .from('match_rounds')
    .insert({
      match_id: match.id,
      question_id: questionData.raw.id,
      round_number: roundNumber,
      status: 'active'
    })
    .select()
    .single()
  
  if (error || !round) {
    console.error(`[${match.id}] Failed to create round:`, error)
    return null
  }
  
  console.log(`[${match.id}] ✅ Created round ${roundNumber} with question ${questionData.raw.id}`)
  
  return {
    roundId: round.id,
    roundNumber,
    question: questionData.mapped
  }
}

/**
 * Check if both players answered and evaluate round if ready
 * TODO: Add round timeout auto-evaluation (currently only evaluates when both answered)
 * TODO: Add proper timeout handling (round_deadline enforcement)
 */
async function checkAndEvaluateRound(
  matchId: string,
  roundId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // Check if both players answered
  const { data: round } = await supabase
    .from('match_rounds')
    .select('player1_answered_at, player2_answered_at, round_number')
    .eq('id', roundId)
    .single()
  
  if (!round) {
    console.error(`[${matchId}] Round ${roundId} not found`)
    return
  }
  
  if (!round.player1_answered_at || !round.player2_answered_at) {
    // Not ready yet
    return
  }
  
  console.log(`[${matchId}] Both players answered round ${round.round_number}, evaluating...`)
  
  // Call evaluate_round RPC
  const { data: evalResult, error: evalError } = await supabase.rpc('evaluate_round', {
    p_match_id: matchId,
    p_round_id: roundId
  })
  
  if (evalError) {
    console.error(`[${matchId}] Error evaluating round:`, evalError)
    broadcastToMatch(matchId, {
      type: 'GAME_ERROR',
      message: 'Failed to evaluate round',
      code: 'EVAL_ERROR'
    } as GameErrorEvent)
    return
  }
  
  // Broadcast ROUND_RESULT
  const roundResultMsg: RoundResultMsg = {
    type: 'ROUND_RESULT',
    matchId,
    roundId,
    roundNumber: round.round_number,
    roundWinnerId: evalResult.round_winner_id,
    player1RoundScore: evalResult.player1_round_score,
    player2RoundScore: evalResult.player2_round_score,
    matchContinues: evalResult.match_continues,
    matchWinnerId: evalResult.match_winner_id
  }
  
  // Log before broadcast to debug
  const matchSockets = sockets.get(matchId)
  const socketStates = matchSockets ? Array.from(matchSockets).map(s => {
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
    return states[s.readyState] || s.readyState
  }) : []
  const openSockets = matchSockets ? Array.from(matchSockets).filter(s => s.readyState === WebSocket.OPEN).length : 0
  
  console.log(`[${matchId}] 📊 Broadcasting ROUND_RESULT for round ${round.round_number}:`, {
    roundWinnerId: evalResult.round_winner_id,
    player1Score: evalResult.player1_round_score,
    player2Score: evalResult.player2_round_score,
    matchContinues: evalResult.match_continues,
    socketsInMatch: matchSockets?.size || 0,
    socketStates: socketStates.join(', '),
    openSockets
  })
  
  // Broadcast to all open sockets
  broadcastToMatch(matchId, roundResultMsg)
  
  // If we have fewer than 2 open sockets, retry broadcast after a short delay
  // This handles the case where the second player's socket might not be ready yet
  if (openSockets < 2) {
    console.warn(`[${matchId}] ⚠️ Only ${openSockets} open socket(s), retrying broadcast after 200ms...`)
    setTimeout(() => {
      const retrySockets = sockets.get(matchId)
      const retryOpen = retrySockets ? Array.from(retrySockets).filter(s => s.readyState === WebSocket.OPEN).length : 0
      console.log(`[${matchId}] 🔄 Retry broadcast: ${retryOpen} open socket(s)`)
      if (retryOpen > 0) {
        broadcastToMatch(matchId, roundResultMsg)
      }
    }, 200)
  }
  
  console.log(`[${matchId}] ✅ ROUND_RESULT broadcast completed`)
  
  if (!evalResult.match_continues) {
    // Match finished
    const { data: finishResult, error: finishError } = await supabase.rpc('finish_match', {
      p_match_id: matchId
    })
    
    if (finishError) {
      console.error(`[${matchId}] Error finishing match:`, finishError)
    } else {
      const matchFinishedMsg: MatchFinishedMsg = {
        type: 'MATCH_FINISHED',
        matchId,
        winnerId: finishResult.winner_id,
        player1FinalScore: finishResult.player1_final_score,
        player2FinalScore: finishResult.player2_final_score,
        totalRounds: finishResult.total_rounds
      }
      broadcastToMatch(matchId, matchFinishedMsg)
    }
  } else {
    // Match continues - create next round
    // Double-check match is still in_progress before creating next round
    const { data: updatedMatch } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()
    
    if (updatedMatch && updatedMatch.status === 'in_progress') {
      const nextRound = await createRound(updatedMatch, round.round_number, supabase)
      if (nextRound) {
        const roundStartMsg: RoundStartMsg = {
          type: 'ROUND_START',
          matchId,
          roundId: nextRound.roundId,
          roundNumber: nextRound.roundNumber,
          question: nextRound.question
        }
        broadcastToMatch(matchId, roundStartMsg)
      }
    } else {
      console.warn(`[${matchId}] Match is not in_progress (status: ${updatedMatch?.status}), not creating next round`)
      // If match finished but MATCH_FINISHED wasn't sent, send it now
      if (updatedMatch && updatedMatch.status === 'finished') {
        const matchFinishedMsg: MatchFinishedMsg = {
          type: 'MATCH_FINISHED',
          matchId,
          winnerId: updatedMatch.winner_id,
          player1FinalScore: updatedMatch.player1_score,
          player2FinalScore: updatedMatch.player2_score,
          totalRounds: updatedMatch.current_round_number
        }
        broadcastToMatch(matchId, matchFinishedMsg)
      }
    }
  }
}

/**
 * Handle JOIN_MATCH message
 * - Validates match and player
 * - Calls start_match if status is 'pending'
 * - Creates first round if needed
 * - Broadcasts MATCH_START and ROUND_START
 */
async function handleJoinMatch(
  matchId: string,
  playerId: string,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] JOIN_MATCH from player ${playerId}`)

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

  // If match is pending, start it
  if (match.status === 'pending') {
    console.log(`[${matchId}] Match is pending, calling start_match...`)
    const { data: startedMatchRows, error: startError } = await supabase.rpc('start_match', {
      p_match_id: matchId,
      p_player_id: playerId
    })
    
    if (startError) {
      console.error(`[${matchId}] Error starting match:`, startError)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Failed to start match'
      } as GameErrorEvent))
      return
    }
    
    // Update match reference (start_match returns SETOF matches)
    if (startedMatchRows && startedMatchRows.length > 0) {
      Object.assign(match, startedMatchRows[0])
    }
  }

  // Check for existing active round
  const { data: activeRound } = await supabase
    .from('match_rounds')
    .select('*')
    .eq('match_id', matchId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (activeRound) {
    // Round already exists, fetch the question for this round
    const { data: questionRow, error: qError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', activeRound.question_id)
      .single<DbQuestion>()
    
    if (qError || !questionRow) {
      console.error(`[${matchId}] Failed to fetch question for round:`, qError)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Failed to load question'
      } as GameErrorEvent))
      return
    }
    
    // Map to StepBasedQuestion format using helper
    const mapped = mapDbQuestionToStepBased(questionRow)
    
    const roundStartMsg: RoundStartMsg = {
      type: 'ROUND_START',
      matchId,
      roundId: activeRound.id,
      roundNumber: activeRound.round_number,
      question: mapped
    }
    socket.send(JSON.stringify(roundStartMsg))
    return
  }

  // No active round - create first round
  const firstRound = await createRound(match, 0, supabase)
  if (!firstRound) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Failed to create first round'
    } as GameErrorEvent))
    return
  }

  // Broadcast MATCH_START then ROUND_START
  const matchStartMsg: MatchStartMsg = {
    type: 'MATCH_START',
    matchId,
    roundId: firstRound.roundId,
    roundNumber: firstRound.roundNumber
  }
  broadcastToMatch(matchId, matchStartMsg)

  const roundStartMsg: RoundStartMsg = {
    type: 'ROUND_START',
    matchId,
    roundId: firstRound.roundId,
    roundNumber: firstRound.roundNumber,
    question: firstRound.question
  }
  broadcastToMatch(matchId, roundStartMsg)
}

/**
 * Handle SUBMIT_ROUND_ANSWER message
 * TODO: Add proper timeout handling (round_deadline enforcement)
 * TODO: Add reconnection logic for dropped WebSocket connections
 */
async function handleSubmitRoundAnswer(
  matchId: string,
  roundId: string,
  playerId: string,
  payload: any,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] SUBMIT_ROUND_ANSWER from player ${playerId} for round ${roundId}`)
  console.log(`[${matchId}] Payload:`, JSON.stringify(payload, null, 2))

  // Call submit_round_answer RPC
  const { data: result, error } = await supabase.rpc('submit_round_answer', {
    p_match_id: matchId,
    p_round_id: roundId,
    p_player_id: playerId,
    p_payload: payload
  })

  if (error) {
    console.error(`[${matchId}] Error submitting answer:`, error)
    broadcastToMatch(matchId, {
      type: 'GAME_ERROR',
      message: error.message || 'Failed to submit answer',
      code: 'SUBMIT_ERROR'
    } as GameErrorEvent)
    return
  }

  // Handle idempotent duplicate gracefully
  if (result?.already_answered) {
    console.log(`[${matchId}] Player ${playerId} already answered round ${roundId}, returning existing result (idempotent)`)
    // Don't send GAME_ERROR, just continue to checkAndEvaluateRound
    // This allows the round evaluation to proceed normally
  } else {
    console.log(`[${matchId}] ✅ Answer submitted successfully, result:`, result)
  }

  // Check if both players answered and evaluate if ready
  // Use setTimeout to ensure this happens after the current message handler completes
  // This gives time for socket state to stabilize, especially for the second player
  setTimeout(async () => {
    await checkAndEvaluateRound(matchId, roundId, supabase)
  }, 50) // Small delay to ensure socket registration is complete
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

  socket.onopen = () => {
    console.log(`[${matchId}] WebSocket opened for user ${user.id}`)
    // Send connection confirmation
    socket.send(JSON.stringify({ type: 'connected', player: 'p1' }))
  }

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data)
      console.log(`[${matchId}] 📨 Received message:`, message.type)

      if (message.type === 'JOIN_MATCH') {
        await handleJoinMatch(matchId, user.id, socket, supabase)
      } else if (message.type === 'SUBMIT_ROUND_ANSWER') {
        const submitMsg = message as SubmitRoundAnswerMsg
        await handleSubmitRoundAnswer(
          matchId,
          submitMsg.roundId,
          user.id,
          submitMsg.payload,
          supabase
        )
      } else {
        console.warn(`[${matchId}] Unknown message type: ${message.type}`)
        socket.send(JSON.stringify({
          type: 'GAME_ERROR',
          message: `Unknown message type: ${message.type}`
        } as GameErrorEvent))
      }
    } catch (error) {
      console.error(`[${matchId}] Error handling message:`, error)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Error processing message'
      } as GameErrorEvent))
    }
  }

  socket.onclose = () => {
    console.log(`[${matchId}] WebSocket closed for user ${user.id}`)
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
