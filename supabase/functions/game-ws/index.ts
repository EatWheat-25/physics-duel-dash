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

  // 5. Check if both players are connected
  const connectedSet = connectedPlayers.get(matchId)!
  const bothConnected = connectedSet.has(match.player1_id) && connectedSet.has(match.player2_id)

  console.log(`[${matchId}] Connection check: player1=${connectedSet.has(match.player1_id)}, player2=${connectedSet.has(match.player2_id)}, bothConnected=${bothConnected}`)

  if (bothConnected) {
    console.log(`[${matchId}] ✅ Both players connected! Sending BOTH_CONNECTED to all sockets...`)
    
    // 0. Early return check: if question already sent, bail immediately
    // This saves pointless fetch + logs
    if (match.question_id) {
      console.log(`[${matchId}] Question already sent (question_id: ${match.question_id}), skipping`)
      // Still send BOTH_CONNECTED event
      const matchSockets = sockets.get(matchId)
      if (matchSockets) {
        const bothConnectedMessage: BothConnectedEvent = {
          type: 'BOTH_CONNECTED',
          matchId: matchId
        }
        matchSockets.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(bothConnectedMessage))
            console.log(`[${matchId}] 📤 Sent BOTH_CONNECTED to socket (question already sent)`)
          }
        })
        console.log(`[${matchId}] 📤 Broadcasted BOTH_CONNECTED to ${matchSockets.size} socket(s) (question already sent)`)
      }
      return
    }
    
    // 1. Fetch question
    const question = await fetchRandomQuestion(supabase)
    
    if (!question) {
      // Send error to both players
      const errorMessage: GameErrorEvent = {
        type: 'GAME_ERROR',
        message: 'No True/False questions available'
      }
      const matchSockets = sockets.get(matchId)
      if (matchSockets) {
        matchSockets.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(errorMessage))
          }
        })
      }
      // Still send BOTH_CONNECTED even if no question
      const bothConnectedMessage: BothConnectedEvent = {
        type: 'BOTH_CONNECTED',
        matchId: matchId
      }
      if (matchSockets) {
        matchSockets.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(bothConnectedMessage))
          }
        })
        console.log(`[${matchId}] 📤 Broadcasted BOTH_CONNECTED (no question available)`)
      }
      return
    }
    
    // 2. Claim send-rights with atomic conditional update
    const { data: lock, error: lockErr } = await supabase
      .from('matches')
      .update({
        question_sent_at: new Date().toISOString(),
        question_id: question.id,
      })
      .eq('id', matchId)
      .is('question_id', null)   // ATOMIC GUARD: only update if NULL
      .select('id')
      .maybeSingle()
    
    // 3. Only broadcast if we won the lock
    if (!lock || lockErr) {
      console.log(`[${matchId}] Question already claimed by another worker, skipping send`)
      // Still send BOTH_CONNECTED event
      const matchSockets = sockets.get(matchId)
      if (matchSockets) {
        const bothConnectedMessage: BothConnectedEvent = {
          type: 'BOTH_CONNECTED',
          matchId: matchId
        }
        matchSockets.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(bothConnectedMessage))
            console.log(`[${matchId}] 📤 Sent BOTH_CONNECTED to socket (lock failed)`)
          }
        })
        console.log(`[${matchId}] 📤 Broadcasted BOTH_CONNECTED to ${matchSockets.size} socket(s) (lock failed)`)
      }
      return
    }
    
    // 4. ✅ Only now broadcast (we successfully claimed)
    const questionMessage: QuestionReceivedEvent = {
      type: 'QUESTION_RECEIVED',
      question: question
    }
    
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      matchSockets.forEach(s => {
        if (s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify(questionMessage))
        }
      })
      console.log(`[${matchId}] 📤 Broadcasted QUESTION_RECEIVED to ${matchSockets.size} socket(s)`)
    }
    
    // Also send BOTH_CONNECTED event
    const bothConnectedMessage: BothConnectedEvent = {
      type: 'BOTH_CONNECTED',
      matchId: matchId
    }
    if (matchSockets) {
      matchSockets.forEach(s => {
        if (s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify(bothConnectedMessage))
          console.log(`[${matchId}] 📤 Sent BOTH_CONNECTED to socket (question sent)`)
        }
      })
      console.log(`[${matchId}] 📤 Broadcasted BOTH_CONNECTED to ${matchSockets.size} socket(s) (question sent)`)
    }
    
    console.log(`[${matchId}] ✅ Question ${question.id} sent to both players`)
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

