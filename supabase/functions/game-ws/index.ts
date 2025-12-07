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
  question: any // Raw DB format from questions_v2 - client will map it
}

// Track sockets locally (for broadcasting) - each instance only tracks its own sockets
const sockets = new Map<string, Set<WebSocket>>() // matchId -> Set<WebSocket>

/**
 * Check if both players are connected using DATABASE (works across instances)
 * and broadcast BOTH_CONNECTED to all local sockets if so
 */
/**
 * Broadcast question to all sockets for a match (uses matchSockets snapshot)
 */
function broadcastQuestion(
  matchId: string,
  question: any,
  sockets: Map<string, Set<WebSocket>>
): void {
  // Get snapshot of sockets for this match (in-memory, no per-client fetch)
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) {
    console.warn(`[${matchId}] ⚠️  No sockets found for match - cannot broadcast QUESTION_RECEIVED`)
    return
  }
  
  // Send raw DB format - client will map it
  const message: QuestionReceivedEvent = {
    type: 'QUESTION_RECEIVED',
    question: question  // Raw DB format from questions_v2
  }
  
  let sentCount = 0
  matchSockets.forEach((socket, index) => {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message))
        sentCount++
        console.log(`[${matchId}] ✅ Sent QUESTION_RECEIVED to socket ${index + 1}`)
      } catch (error) {
        console.error(`[${matchId}] ❌ Error sending QUESTION_RECEIVED to socket ${index + 1}:`, error)
      }
    }
  })
  
  console.log(`[${matchId}] 📊 QUESTION_RECEIVED sent to ${sentCount}/${matchSockets.size} sockets`)
}

/**
 * Atomically claim and broadcast a True/False question for a match
 * Ensures both players always see the same question
 */
async function startGameRound(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🎮 Starting game round with atomic question claim...`)
  
  try {
    // Step 1: Check if question already assigned
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('question_id, question_sent_at')  // Include question_sent_at for logging/debugging
      .eq('id', matchId)
      .single()
    
    if (matchError) {
      console.error(`[${matchId}] ❌ Error fetching match:`, matchError)
      throw matchError
    }
    
    if (match?.question_id) {
      // Question already assigned - fetch and broadcast it
      console.log(`[${matchId}] 📋 Question already assigned: ${match.question_id} (sent at: ${match.question_sent_at})`)
      
      const { data: question, error: questionError } = await supabase
        .from('questions_v2')
        .select('*')
        .eq('id', match.question_id)
        .single()
      
      if (questionError || !question) {
        console.error(`[${matchId}] ❌ Error fetching existing question:`, questionError)
        throw new Error(`Failed to fetch existing question ${match.question_id}`)
      }
      
      // Broadcast existing question (raw DB format)
      broadcastQuestion(matchId, question, sockets)
      console.log(`[${matchId}] ✅ Broadcasted existing question`)
      return
    }
    
    // No question assigned - try to claim one
    console.log(`[${matchId}] 🔍 No question assigned - attempting atomic claim...`)
    
    // Step 2: Fetch TF questions
    const { data: questions, error: questionError } = await supabase
      .from('questions_v2')
      .select('*')
      .limit(50)
    
    if (questionError) {
      console.error(`[${matchId}] ❌ Error fetching questions:`, questionError)
      throw questionError
    }
    
    if (!questions || questions.length === 0) {
      console.error(`[${matchId}] ❌ No questions found in questions_v2`)
      throw new Error('No questions available')
    }
    
    // Filter for True/False: steps[0].type === 'true_false' OR steps[0].options.length === 2
    // Supabase JSONB usually returns object/array already - only parse if string
    const tfQuestions = questions.filter((q: any) => {
      try {
        let steps = q.steps
        // Only parse if it's a string (rare case)
        if (typeof steps === 'string') {
          steps = JSON.parse(steps)
        }
        // If still not an array, skip this question
        if (!Array.isArray(steps) || steps.length === 0) {
          return false
        }
        const firstStep = steps[0]
        if (!firstStep) {
          return false
        }
        return firstStep && (
          firstStep.type === 'true_false' || 
          (Array.isArray(firstStep.options) && firstStep.options.length === 2)
        )
      } catch (err) {
        // One bad row shouldn't nuke the whole send - skip this question
        console.error(`[${matchId}] ❌ Error parsing steps for question ${q.id}:`, err)
        return false
      }
    })
    
    console.log(`[${matchId}] 📊 Found ${tfQuestions.length} True/False questions out of ${questions.length} total`)
    
    if (tfQuestions.length === 0) {
      throw new Error('No True/False questions available')
    }
    
    // Pick random
    const randomIndex = Math.floor(Math.random() * tfQuestions.length)
    const selectedQuestion = tfQuestions[randomIndex]
    console.log(`[${matchId}] 🎲 Selected question: ${selectedQuestion.id} - "${selectedQuestion.title}"`)
    
    // Step 3: Atomic claim (ONLY broadcast if we win the lock)
    const { data: lock, error: lockError } = await supabase
      .from('matches')
      .update({
        question_sent_at: new Date().toISOString(),
        question_id: selectedQuestion.id
      })
      .eq('id', matchId)
      .is('question_id', null)  // CRITICAL: Only update if null
      .select('id, question_id')  // Minimal select
      .maybeSingle()
    
    if (lockError) {
      console.error(`[${matchId}] ❌ Error during atomic claim:`, lockError)
      throw lockError
    }
    
    if (!lock) {
      // Lost race - MUST re-read match.question_id and use that question
      console.log(`[${matchId}] ⚠️  Lost lock race - re-reading match.question_id`)
      const { data: matchAfterRace, error: reReadError } = await supabase
        .from('matches')
        .select('question_id, question_sent_at')  // Include for logging
        .eq('id', matchId)
        .single()
      
      if (reReadError || !matchAfterRace) {
        console.error(`[${matchId}] ❌ Error re-reading match after race:`, reReadError)
        throw new Error('Failed to claim question and failed to re-read match')
      }
      
      if (matchAfterRace.question_id) {
        // Fetch the question that the winner selected
        const { data: question, error: fetchError } = await supabase
          .from('questions_v2')
          .select('*')
          .eq('id', matchAfterRace.question_id)
          .single()
        
        if (fetchError || !question) {
          console.error(`[${matchId}] ❌ Error fetching question after race:`, fetchError)
          throw new Error(`Failed to fetch question ${matchAfterRace.question_id} after race`)
        }
        
        // Broadcast the question that won the race
        broadcastQuestion(matchId, question, sockets)
        console.log(`[${matchId}] ✅ Broadcasted question from race winner`)
      } else {
        throw new Error('Failed to claim question and no question found after race')
      }
    } else {
      // Won lock - broadcast the question we selected
      console.log(`[${matchId}] ✅ Won lock - broadcasting selected question`)
      broadcastQuestion(matchId, selectedQuestion, sockets)
    }
    
    console.log(`[${matchId}] ✅ Game round started successfully!`)
  } catch (error) {
    console.error(`[${matchId}] ❌ Error starting game round:`, error)
    
    // Send error to all sockets
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      const errorEvent: GameErrorEvent = {
        type: 'GAME_ERROR',
        message: 'Failed to start game round'
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
        console.log(`[${matchId}] 🎮 Both players connected - starting game round...`)
        await startGameRound(matchId, supabase)
        
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

