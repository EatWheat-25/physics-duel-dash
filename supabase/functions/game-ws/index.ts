import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Simple Game WebSocket
 * 
 * Idempotent question assignment: each match gets exactly one question.
 * Uses match_rounds table to track question assignment.
 */

// Types matching schema.ts
interface Question {
  id: string
  text: string
  steps: {
    type: 'mcq'
    options: string[]
    answer: number
  }
  created_at: string
}

interface RoundStartEvent {
  type: 'ROUND_START'
  match_id: string
  question: Question
}

interface GameErrorEvent {
  type: 'GAME_ERROR'
  message: string
}

// Hardcoded fallback question
const FALLBACK_QUESTION: Question = {
  id: '00000000-0000-0000-0000-000000000000',
  text: 'What is the formula for kinetic energy?',
  steps: {
    type: 'mcq',
    options: ['E = mc²', 'E = ½mv²', 'E = mgh', 'E = Fd'],
    answer: 1
  },
  created_at: new Date().toISOString()
}

// Simple in-memory socket tracking (just for connection management)
const sockets = new Map<string, Set<WebSocket>>()

/**
 * Handle SUBMIT_ROUND_ANSWER message
 * - Validates match, round, and player
 * - Calls submit_round_answer RPC
 * - If both players answered, calls evaluate_round
 * - Broadcasts ROUND_RESULT to all connected sockets
 */
async function handleSubmitRoundAnswer(
  matchId: string,
  playerId: string,
  message: any,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] SUBMIT_ROUND_ANSWER from player ${playerId}`)

  const { roundId, payload } = message

  if (!roundId || !payload) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Missing roundId or payload'
    } as GameErrorEvent))
    return
  }

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

  // 2. Call submit_round_answer RPC
  try {
    const { data: submitResult, error: submitError } = await supabase.rpc(
      'submit_round_answer',
      {
        p_match_id: matchId,
        p_round_id: roundId,
        p_player_id: playerId,
        p_payload: payload
      }
    )

    if (submitError) {
      console.error(`[${matchId}] ❌ Error submitting answer:`, submitError)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: submitError.message || 'Failed to submit answer'
      } as GameErrorEvent))
      return
    }

    console.log(`[${matchId}] ✅ Answer submitted successfully for player ${playerId}`)

    // 3. Check if both players have answered
    const { data: round, error: roundError } = await supabase
      .from('match_rounds')
      .select('player1_answered_at, player2_answered_at, status')
      .eq('id', roundId)
      .single()

    if (roundError || !round) {
      console.error(`[${matchId}] ❌ Error checking round status:`, roundError)
      return
    }

    const bothAnswered = round.player1_answered_at && round.player2_answered_at

    if (bothAnswered && round.status === 'active') {
      console.log(`[${matchId}] ✅ Both players answered, evaluating round...`)

      // 4. Call evaluate_round RPC
      const { data: evaluateResult, error: evaluateError } = await supabase.rpc(
        'evaluate_round',
        {
          p_match_id: matchId,
          p_round_id: roundId
        }
      )

      if (evaluateError) {
        console.error(`[${matchId}] ❌ Error evaluating round:`, evaluateError)
        return
      }

      console.log(`[${matchId}] ✅ Round evaluated:`, evaluateResult)

      // 5. Broadcast ROUND_RESULT to all connected sockets
      const roundResultMessage = {
        type: 'ROUND_RESULT',
        roundId: roundId,
        roundNumber: evaluateResult?.round_number || 1,
        roundWinnerId: evaluateResult?.round_winner_id || null,
        player1RoundScore: evaluateResult?.player1_round_score || 0,
        player2RoundScore: evaluateResult?.player2_round_score || 0,
        matchContinues: evaluateResult?.match_continues || false,
        matchWinnerId: evaluateResult?.match_winner_id || null
      }

      // Broadcast to all sockets for this match
      const matchSockets = sockets.get(matchId)
      if (matchSockets) {
        matchSockets.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(roundResultMessage))
          }
        })
        console.log(`[${matchId}] 📤 Broadcasted ROUND_RESULT to ${matchSockets.size} socket(s)`)
      } else {
        // Fallback: send to current socket
        socket.send(JSON.stringify(roundResultMessage))
      }
    } else {
      console.log(`[${matchId}] ⏳ Waiting for opponent to answer...`)
      // Send confirmation to submitting player
      socket.send(JSON.stringify({
        type: 'ANSWER_RECEIVED',
        message: 'Your answer has been received. Waiting for opponent...'
      }))
    }
  } catch (error) {
    console.error(`[${matchId}] ❌ Unexpected error:`, error)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Unexpected error processing answer'
    } as GameErrorEvent))
  }
}

/**
 * Handle JOIN_MATCH message
 * - Validates match and player
 * - Checks match_rounds for existing question
 * - If exists: sends ROUND_START with that question
 * - If not: picks random question, inserts into match_rounds, sends ROUND_START
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

  // 2. Check if match_round already exists
  const { data: existingRound, error: roundError } = await supabase
    .from('match_rounds')
    .select('*')
    .eq('match_id', matchId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let question: Question

  if (roundError) {
    console.error(`[${matchId}] ❌ Error checking match_rounds:`, roundError)
    // Fall through to create new round
  }

  if (existingRound) {
    // 3a. Round exists - fetch the question
    console.log(`[${matchId}] ✅ Found existing round with question_id: ${existingRound.question_id}`)
    
    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', existingRound.question_id)
      .single()

    if (questionError || !questionData) {
      console.error(`[${matchId}] ❌ Question not found:`, questionError)
      // Use fallback
      question = FALLBACK_QUESTION
    } else {
      question = {
        id: questionData.id,
        text: questionData.text,
        steps: questionData.steps as Question['steps'],
        created_at: questionData.created_at
      }
    }
  } else {
    // 3b. No round exists - pick random question and create round
    console.log(`[${matchId}] No existing round, picking new question`)

    // Fetch questions and pick one randomly
    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .limit(50)

    if (questionError || !questions || questions.length === 0) {
      console.warn(`[${matchId}] ⚠️ No questions in DB, using fallback`)
      question = FALLBACK_QUESTION
    } else {
      const randomIndex = Math.floor(Math.random() * questions.length)
      const selectedQuestion = questions[randomIndex]
      question = {
        id: selectedQuestion.id,
        text: selectedQuestion.text,
        steps: selectedQuestion.steps as Question['steps'],
        created_at: selectedQuestion.created_at
      }
      console.log(`[${matchId}] Selected question ${randomIndex + 1}/${questions.length}: ${question.id}`)
    }

    // Insert into match_rounds
    const { error: insertError } = await supabase
      .from('match_rounds')
      .insert({
        match_id: matchId,
        question_id: question.id,
        status: 'active'
      })

    if (insertError) {
      console.error(`[${matchId}] ❌ Error inserting match_round:`, insertError)
      // Still send the question, but log the error
    } else {
      console.log(`[${matchId}] ✅ Created match_round for question ${question.id}`)
    }
  }

  // 4. Send ROUND_START event
  const roundStartEvent: RoundStartEvent = {
    type: 'ROUND_START',
    match_id: matchId,
    question
  }

  console.log(`[${matchId}] 📤 Sending ROUND_START with question: ${question.id}`)
  socket.send(JSON.stringify(roundStartEvent))
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
        await handleSubmitRoundAnswer(matchId, user.id, message, socket, supabase)
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
