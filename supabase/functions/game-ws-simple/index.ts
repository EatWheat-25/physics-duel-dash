import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

/**
 * Simple, Reliable game-ws
 *
 * Responsibilities:
 * 1. Accept WebSocket connections
 * 2. On ROUND_START request, fetch ONE random question from battle_questions
 * 3. Always return a valid Question payload (with fallback)
 * 4. Never crash - always handle errors gracefully
 */

// Fallback question if database is empty or query fails
const FALLBACK_QUESTION = {
  id: '00000000-0000-0000-0000-000000000000',
  text: 'What is the acceleration due to gravity on Earth?',
  steps: {
    type: 'mcq',
    options: ['9.8 m/s²', '10 m/s²', '3 × 10⁸ m/s', '6.67 × 10⁻¹¹ N·m²/kg²'],
    answer: 0
  },
  created_at: new Date().toISOString()
}

interface GameState {
  matchId: string
  player1Socket: WebSocket | null
  player2Socket: WebSocket | null
  connected: boolean
}

const games = new Map<string, GameState>()

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const matchId = url.searchParams.get('match_id')

  if (!token || !matchId) {
    return new Response('Missing token or match_id', { status: 400 })
  }

  // Verify JWT
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify user is in this match
  const { data: match, error: matchError } = await supabase
    .from('battle_matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (matchError || !match || (match.player1_id !== user.id && match.player2_id !== user.id)) {
    return new Response('Invalid match', { status: 403 })
  }

  console.log(`[${matchId}] WebSocket connection from user ${user.id}`)

  // Upgrade to WebSocket
  const upgrade = req.headers.get('upgrade') || ''
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 426 })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)

  const isPlayer1 = match.player1_id === user.id

  // Initialize or get game state
  if (!games.has(matchId)) {
    games.set(matchId, {
      matchId,
      player1Socket: null,
      player2Socket: null,
      connected: false
    })
    console.log(`[${matchId}] Game state initialized`)
  }

  const game = games.get(matchId)!

  // Assign socket
  if (isPlayer1) {
    game.player1Socket = socket
    console.log(`[${matchId}] Player 1 connected`)
  } else {
    game.player2Socket = socket
    console.log(`[${matchId}] Player 2 connected`)
  }

  // Check if both connected
  if (game.player1Socket && game.player2Socket && !game.connected) {
    game.connected = true
    console.log(`[${matchId}] Both players connected, sending ROUND_START`)

    // Fetch question from database
    await sendRoundStart(matchId, game, supabase)
  }

  socket.onopen = () => {
    console.log(`[${matchId}] Socket opened for ${isPlayer1 ? 'P1' : 'P2'}`)
    socket.send(JSON.stringify({ type: 'connected', player: isPlayer1 ? 'player1' : 'player2' }))
  }

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data)
      console.log(`[${matchId}] Message from ${isPlayer1 ? 'P1' : 'P2'}:`, message.type)

      if (message.type === 'request_question') {
        await sendRoundStart(matchId, game, supabase)
      }
    } catch (error) {
      console.error(`[${matchId}] Error handling message:`, error)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Failed to process message'
      }))
    }
  }

  socket.onclose = () => {
    console.log(`[${matchId}] Socket closed for ${isPlayer1 ? 'P1' : 'P2'}`)
    if (isPlayer1) {
      game.player1Socket = null
    } else {
      game.player2Socket = null
    }

    // Cleanup if both disconnected
    if (!game.player1Socket && !game.player2Socket) {
      games.delete(matchId)
      console.log(`[${matchId}] Game cleaned up`)
    }
  }

  socket.onerror = (error) => {
    console.error(`[${matchId}] WebSocket error:`, error)
  }

  return response
})

/**
 * Fetch a random question and send ROUND_START to both players
 */
async function sendRoundStart(
  matchId: string,
  game: GameState,
  supabase: any
) {
  try {
    console.log(`[${matchId}] Fetching question from battle_questions...`)

    // Simple query: get ONE random question
    const { data: questions, error } = await supabase
      .from('battle_questions')
      .select('*')
      .limit(10) // Get 10 to pick random from

    let question = FALLBACK_QUESTION

    if (error) {
      console.error(`[${matchId}] Error fetching questions:`, error)
      console.log(`[${matchId}] Using fallback question`)
    } else if (!questions || questions.length === 0) {
      console.warn(`[${matchId}] No questions in database, using fallback`)
    } else {
      // Pick random question from results
      const randomIndex = Math.floor(Math.random() * questions.length)
      question = questions[randomIndex]
      console.log(`[${matchId}] Selected question: ${question.id}`)
    }

    // Send ROUND_START event to both players
    const roundStartEvent = {
      type: 'ROUND_START',
      match_id: matchId,
      question: {
        id: question.id,
        text: question.text,
        steps: question.steps,
        created_at: question.created_at
      }
    }

    const message = JSON.stringify(roundStartEvent)

    if (game.player1Socket) {
      game.player1Socket.send(message)
      console.log(`[${matchId}] ROUND_START sent to Player 1`)
    }

    if (game.player2Socket) {
      game.player2Socket.send(message)
      console.log(`[${matchId}] ROUND_START sent to Player 2`)
    }

    console.log(`[${matchId}] ✅ ROUND_START complete`)
  } catch (error) {
    console.error(`[${matchId}] Fatal error in sendRoundStart:`, error)

    // Send error to players
    const errorEvent = {
      type: 'GAME_ERROR',
      message: 'Failed to start round'
    }

    const message = JSON.stringify(errorEvent)

    if (game.player1Socket) {
      game.player1Socket.send(message)
    }

    if (game.player2Socket) {
      game.player2Socket.send(message)
    }
  }
}
