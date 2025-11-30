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

  const loadActiveRound = async () => {
    const { data } = await supabase
      .from('match_rounds')
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data
  }

  const fetchQuestion = async (questionId: string): Promise<Question> => {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (!data) {
      console.error(`[${matchId}] ❌ Question ${questionId} not found, using fallback`)
      return FALLBACK_QUESTION
    }

    return {
      id: data.id,
      text: data.text,
      steps: data.steps as Question['steps'],
      created_at: data.created_at
    }
  }

  const sendRoundStart = (question: Question) => {
    const roundStartEvent: RoundStartEvent = {
      type: 'ROUND_START',
      match_id: matchId,
      question
    }
    console.log(`[${matchId}] 📤 Sending ROUND_START with question: ${question.id}`)
    socket.send(JSON.stringify(roundStartEvent))
  }

  let activeRound = await loadActiveRound()
  if (activeRound) {
    console.log(`[${matchId}] ✅ Using existing round ${activeRound.id}`)
    const question = await fetchQuestion(activeRound.question_id)
    sendRoundStart(question)
    return
  }

  console.log(`[${matchId}] No existing round, selecting question`)
  const { data: randomQuestion, error: randomError } = await supabase
    .from('questions')
    .select('*')
    .order('random()')
    .limit(1)
    .maybeSingle()

  if (randomError || !randomQuestion) {
    console.warn(`[${matchId}] ⚠️ Could not fetch random question, using fallback`)
    sendRoundStart(FALLBACK_QUESTION)
    return
  }

  const canonicalQuestion: Question = {
    id: randomQuestion.id,
    text: randomQuestion.text,
    steps: randomQuestion.steps as Question['steps'],
    created_at: randomQuestion.created_at
  }

  const { error: insertError } = await supabase
    .from('match_rounds')
    .insert({
      match_id: matchId,
      question_id: canonicalQuestion.id,
      status: 'active'
    })

  if (!insertError) {
    console.log(`[${matchId}] ✅ Created match_round for question ${canonicalQuestion.id}`)
    sendRoundStart(canonicalQuestion)
    return
  }

  console.error(`[${matchId}] ❌ Error inserting match_round:`, insertError)

  activeRound = await loadActiveRound()
  if (activeRound) {
    console.log(`[${matchId}] ♻️ Reusing round created concurrently (${activeRound.id})`)
    const question = await fetchQuestion(activeRound.question_id)
    sendRoundStart(question)
    return
  }

  console.warn(`[${matchId}] ⚠️ Active round still missing, sending fallback question`)
  sendRoundStart(canonicalQuestion || FALLBACK_QUESTION)
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
