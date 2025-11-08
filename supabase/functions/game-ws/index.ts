import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

// ELO calculation
function calculateElo(winner: number, loser: number, kFactor = 32): { winner: number; loser: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loser - winner) / 400))
  const expectedLoser = 1 / (1 + Math.pow(10, (winner - loser) / 400))

  return {
    winner: Math.round(winner + kFactor * (1 - expectedWinner)),
    loser: Math.round(loser + kFactor * (0 - expectedLoser)),
  }
}

interface GameState {
  matchId: string
  p1Socket: WebSocket | null
  p2Socket: WebSocket | null
  p1Ready: boolean
  p2Ready: boolean
  currentQuestion: number
  p1Score: number
  p2Score: number
  gameActive: boolean
}

const games = new Map<string, GameState>()

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const matchId = url.searchParams.get('match_id')

  if (!token || !matchId) {
    return new Response('Missing token or match_id', { status: 400 })
  }

  // Verify JWT and get user
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify user is part of this match
  const { data: match, error: matchError } = await supabase
    .from('matches_new')
    .select('*')
    .eq('id', matchId)
    .single()

  if (matchError || !match || (match.p1 !== user.id && match.p2 !== user.id)) {
    return new Response('Invalid match', { status: 403 })
  }

  console.log(`WebSocket connection for user ${user.id} in match ${matchId}`)

  // Upgrade to WebSocket
  const upgrade = req.headers.get('upgrade') || ''
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 426 })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)

  const isP1 = match.p1 === user.id

  // Initialize or get game state
  if (!games.has(matchId)) {
    games.set(matchId, {
      matchId,
      p1Socket: null,
      p2Socket: null,
      p1Ready: false,
      p2Ready: false,
      currentQuestion: 0,
      p1Score: 0,
      p2Score: 0,
      gameActive: false,
    })
  }

  const game = games.get(matchId)!

  // Assign socket
  if (isP1) {
    game.p1Socket = socket
  } else {
    game.p2Socket = socket
  }

  // Send connection confirmation
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'connected', player: isP1 ? 'p1' : 'p2' }))
  }

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data)
      console.log(`Received message from ${user.id}:`, message.type)

      // Log event to match_events
      await supabase.from('match_events').insert({
        match_id: matchId,
        sender: user.id,
        type: message.type,
        payload: message,
      })

      switch (message.type) {
        case 'ready': {
          if (isP1) game.p1Ready = true
          else game.p2Ready = true

          // Notify both players
          const readyMsg = { type: 'player_ready', player: isP1 ? 'p1' : 'p2' }
          game.p1Socket?.send(JSON.stringify(readyMsg))
          game.p2Socket?.send(JSON.stringify(readyMsg))

          // Start game if both ready
          if (game.p1Ready && game.p2Ready && !game.gameActive) {
            game.gameActive = true
            await supabase.from('matches_new').update({ state: 'active' }).eq('id', matchId)

            const startMsg = { type: 'game_start' }
            game.p1Socket?.send(JSON.stringify(startMsg))
            game.p2Socket?.send(JSON.stringify(startMsg))
          }
          break
        }

        case 'answer_submit': {
          const { question_id, answer, marks_earned } = message

          // Update score
          if (isP1) {
            game.p1Score += marks_earned || 0
          } else {
            game.p2Score += marks_earned || 0
          }

          // Broadcast score update
          const scoreMsg = {
            type: 'score_update',
            p1_score: game.p1Score,
            p2_score: game.p2Score,
          }
          game.p1Socket?.send(JSON.stringify(scoreMsg))
          game.p2Socket?.send(JSON.stringify(scoreMsg))

          break
        }

        case 'question_complete': {
          game.currentQuestion++

          // Check if match is over (assuming 5 questions)
          if (game.currentQuestion >= 5) {
            const winnerId = game.p1Score > game.p2Score ? match.p1 : match.p2
            const loserId = winnerId === match.p1 ? match.p2 : match.p1

            // Get current MMRs
            const { data: players } = await supabase
              .from('players')
              .select('id, mmr')
              .in('id', [match.p1, match.p2])

            const winnerOldMmr = players?.find((p) => p.id === winnerId)?.mmr || 1000
            const loserOldMmr = players?.find((p) => p.id === loserId)?.mmr || 1000

            // Calculate new ELO
            const newElos = calculateElo(winnerOldMmr, loserOldMmr)

            // Update players
            await supabase.from('players').update({ mmr: newElos.winner }).eq('id', winnerId)
            await supabase.from('players').update({ mmr: newElos.loser }).eq('id', loserId)

            // Update match
            await supabase
              .from('matches_new')
              .update({
                state: 'ended',
                winner_id: winnerId,
                p1_score: game.p1Score,
                p2_score: game.p2Score,
                ended_at: new Date().toISOString(),
              })
              .eq('id', matchId)

            // Send match end to both players
            const endMsg = {
              type: 'match_end',
              winner_id: winnerId,
              final_scores: { p1: game.p1Score, p2: game.p2Score },
              mmr_changes: {
                [winnerId]: { old: winnerOldMmr, new: newElos.winner },
                [loserId]: { old: loserOldMmr, new: newElos.loser },
              },
            }

            game.p1Socket?.send(JSON.stringify(endMsg))
            game.p2Socket?.send(JSON.stringify(endMsg))

            // Clean up
            game.p1Socket?.close()
            game.p2Socket?.close()
            games.delete(matchId)
          }
          break
        }
      }
    } catch (error) {
      console.error('Error handling message:', error)
      socket.send(JSON.stringify({ type: 'error', message: (error as Error).message }))
    }
  }

  socket.onclose = () => {
    console.log(`WebSocket closed for user ${user.id}`)
    // Clean up if both disconnected
    if (game.p1Socket === socket) game.p1Socket = null
    if (game.p2Socket === socket) game.p2Socket = null

    if (!game.p1Socket && !game.p2Socket) {
      games.delete(matchId)
    }
  }

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  return response
})
