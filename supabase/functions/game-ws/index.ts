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

// Track connected players per match
const connectedPlayers = new Map<string, Set<string>>() // matchId -> Set<playerId>
const sockets = new Map<string, Set<WebSocket>>() // matchId -> Set<WebSocket>

/**
 * Check if both players are connected and broadcast BOTH_CONNECTED if so
 */
async function checkAndBroadcastBothConnected(
  matchId: string,
  match: any,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const connectedSet = connectedPlayers.get(matchId)
  if (!connectedSet) {
    return
  }

  const bothConnected = connectedSet.has(match.player1_id) && connectedSet.has(match.player2_id)
  
  console.log(`[${matchId}] Checking both connected status:`)
  console.log(`  - Player1 (${match.player1_id}): ${connectedSet.has(match.player1_id) ? '✅' : '❌'}`)
  console.log(`  - Player2 (${match.player2_id}): ${connectedSet.has(match.player2_id) ? '✅' : '❌'}`)
  console.log(`  - Both connected: ${bothConnected ? '✅ YES' : '❌ NO'}`)

  if (bothConnected) {
    console.log(`[${matchId}] ✅ Both players connected! Broadcasting BOTH_CONNECTED...`)
    
    const matchSockets = sockets.get(matchId)
    if (matchSockets && matchSockets.size > 0) {
      const bothConnectedMessage: BothConnectedEvent = {
        type: 'BOTH_CONNECTED',
        matchId: matchId
      }
      let sentCount = 0
      matchSockets.forEach(s => {
        if (s.readyState === WebSocket.OPEN) {
          s.send(JSON.stringify(bothConnectedMessage))
          sentCount++
          console.log(`[${matchId}] 📤 Sent BOTH_CONNECTED to socket (readyState: ${s.readyState})`)
        } else {
          console.warn(`[${matchId}] ⚠️  Socket not ready (readyState: ${s.readyState}), skipping`)
        }
      })
      console.log(`[${matchId}] 📤 Broadcasted BOTH_CONNECTED to ${sentCount}/${matchSockets.size} socket(s)`)
    } else {
      console.error(`[${matchId}] ❌ No sockets found for match! sockets map:`, matchSockets)
    }
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

  // 5. Check if both players are connected and broadcast if so
  await checkAndBroadcastBothConnected(matchId, match, supabase)
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
    
    // Check if both players might already be connected (edge case)
    // This will be handled properly in handleJoinMatch, but we log it here
    const connectedSet = connectedPlayers.get(matchId)
    if (connectedSet) {
      console.log(`[${matchId}] Currently connected players: ${connectedSet.size}`)
    }
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

