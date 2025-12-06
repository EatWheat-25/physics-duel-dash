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

interface QuestionReceivedEvent {
  type: 'QUESTION_RECEIVED'
  question: any
}

// Track connected players per match
const connectedPlayers = new Map<string, Set<string>>() // matchId -> Set<playerId>
const sockets = new Map<string, Set<WebSocket>>() // matchId -> Set<WebSocket>

/**
 * Fetch random True/False question from questions_v2
 * Filters by step data (2 options = True/False pattern)
 */
async function fetchRandomQuestion(
  supabase: ReturnType<typeof createClient>
): Promise<any | null> {
  // Query questions_v2 ONLY (hard-enforced)
  const { data, error } = await supabase
    .from('questions_v2')
    .select('*')
    .limit(50)
  
  if (error || !data) {
    console.error('[fetchRandomQuestion] Error fetching questions:', error)
    return null
  }
  
  // Filter for True/False questions by step data
  const isTF = (q: any) => {
    const firstStep = q?.steps?.[0]
    if (!firstStep) return false
    
    // Check if type is 'true_false'
    if (firstStep.type === 'true_false') return true
    
    // OR check if exactly 2 options (True/False pattern)
    if (Array.isArray(firstStep.options) && firstStep.options.length === 2) {
      return true
    }
    
    return false
  }
  
  const pool = (data ?? []).filter(isTF)
  
  if (pool.length === 0) {
    console.warn('[fetchRandomQuestion] No True/False questions found')
    return null
  }
  
  const randomIndex = Math.floor(Math.random() * pool.length)
  console.log(`[fetchRandomQuestion] Selected question ${randomIndex + 1}/${pool.length}`)
  return pool[randomIndex]
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

  // 2. Track connected player
  if (!connectedPlayers.has(matchId)) {
    connectedPlayers.set(matchId, new Set())
  }
  connectedPlayers.get(matchId)!.add(playerId)

  // 3. Determine if player is player1 or player2
  const isPlayer1 = match.player1_id === playerId
  const playerRole = isPlayer1 ? 'player1' : 'player2'

  // 4. Send connection confirmation
  socket.send(JSON.stringify({
    type: 'CONNECTED',
    player: playerRole,
    matchId: matchId
  } as ConnectedEvent))

  console.log(`[${matchId}] ✅ Player ${playerRole} (${playerId}) connected`)

  // 5. Always notify BOTH_CONNECTED (per-instance) because instances don't share memory
  const sendBothConnected = () => {
    const matchSockets = sockets.get(matchId)
    const bothConnectedMessage: BothConnectedEvent = {
      type: 'BOTH_CONNECTED',
      matchId
    }
    let sentCount = 0
    if (matchSockets) {
      matchSockets.forEach(s => {
        if (s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify(bothConnectedMessage))
          sentCount++
        }
      })
    }
    // Always send to the current socket too (covers cross-instance case)
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(bothConnectedMessage))
      sentCount++
    }
    console.log(`[${matchId}] 📤 BOTH_CONNECTED sent to ${sentCount} socket(s) (per-instance broadcast)`)
  }

  // Send BOTH_CONNECTED regardless of whether the other player is on this instance
  sendBothConnected()

  // 6. If question already assigned, fetch and send it to this socket
  if (match.question_id) {
    console.log(`[${matchId}] Question already set (${match.question_id}), sending to this socket`)
    const { data: existingQuestion, error: existingQuestionError } = await supabase
      .from('questions_v2')
      .select('*')
      .eq('id', match.question_id)
      .maybeSingle()

    if (!existingQuestionError && existingQuestion) {
      const questionMessage: QuestionReceivedEvent = {
        type: 'QUESTION_RECEIVED',
        question: existingQuestion
      }
      socket.send(JSON.stringify(questionMessage))
      const matchSockets = sockets.get(matchId)
      if (matchSockets) {
        matchSockets.forEach(s => {
          if (s !== socket && s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(questionMessage))
          }
        })
      }
      console.log(`[${matchId}] 📤 Re-sent existing question ${match.question_id} to socket(s)`)
    } else {
      console.warn(`[${matchId}] ⚠️ Question id set but fetch failed`, existingQuestionError)
    }
    return
  }

  // 7. If no question yet, fetch and attempt to claim/send
  const question = await fetchRandomQuestion(supabase)

  if (!question) {
    const errorMessage: GameErrorEvent = {
      type: 'GAME_ERROR',
      message: 'No True/False questions available'
    }
    socket.send(JSON.stringify(errorMessage))
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      matchSockets.forEach(s => {
        if (s !== socket && s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify(errorMessage))
        }
      })
    }
    return
  }

  const { data: lock, error: lockErr } = await supabase
    .from('matches')
    .update({
      question_sent_at: new Date().toISOString(),
      question_id: question.id,
    })
    .eq('id', matchId)
    .is('question_id', null)
    .select('id')
    .maybeSingle()

  if (!lock || lockErr) {
    console.log(`[${matchId}] Question already claimed by another worker, skipping send`)
    // Another instance likely sent it; fetch and send to this socket
    const { data: existingQuestion, error: existingQuestionError } = await supabase
      .from('questions_v2')
      .select('*')
      .eq('id', match.question_id ?? question.id)
      .maybeSingle()
    if (!existingQuestionError && existingQuestion) {
      const questionMessage: QuestionReceivedEvent = {
        type: 'QUESTION_RECEIVED',
        question: existingQuestion
      }
      socket.send(JSON.stringify(questionMessage))
    }
    return
  }

  // We own the lock, broadcast question to all sockets in this instance and the current socket
  const questionMessage: QuestionReceivedEvent = {
    type: 'QUESTION_RECEIVED',
    question
  }

  socket.send(JSON.stringify(questionMessage))
  const matchSockets = sockets.get(matchId)
  if (matchSockets) {
    matchSockets.forEach(s => {
      if (s !== socket && s.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify(questionMessage))
      }
    })
  }

  console.log(`[${matchId}] ✅ Question ${question.id} sent to socket(s) (per-instance broadcast)`)
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
    // Send initial connection confirmation (client will send JOIN_MATCH after this)
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established'
    }))
  }

  socket.onmessage = async (event) => {
    try {
      console.log(`[${matchId}] 📨 Raw message received:`, event.data)
      const message = JSON.parse(event.data)
      console.log(`[${matchId}] 📨 Parsed message:`, message)

      if (message.type === 'JOIN_MATCH') {
        console.log(`[${matchId}] Processing JOIN_MATCH from user ${user.id}`)
        await handleJoinMatch(matchId, user.id, socket, supabase)
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

  socket.onclose = () => {
    console.log(`[${matchId}] WebSocket closed for user ${user.id}`)
    
    // Remove from connected players
    const connectedSet = connectedPlayers.get(matchId)
    if (connectedSet) {
      connectedSet.delete(user.id)
      if (connectedSet.size === 0) {
        connectedPlayers.delete(matchId)
      }
    }
    
    // Remove from sockets
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

