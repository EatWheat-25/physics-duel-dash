import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { z } from 'npm:zod@3.23.8'

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
  questionsPerMatch: number
}

// Validation schemas
const ReadyMessageSchema = z.object({
  type: z.literal('ready')
})

const AnswerSubmitSchema = z.object({
  type: z.literal('answer_submit'),
  question_id: z.string().uuid(),
  step_id: z.string().min(1).max(100),
  answer: z.number().int().min(0).max(10)
})

const QuestionCompleteSchema = z.object({
  type: z.literal('question_complete')
})

const ClientMessageSchema = z.discriminatedUnion('type', [
  ReadyMessageSchema,
  AnswerSubmitSchema,
  QuestionCompleteSchema
])

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
      questionsPerMatch: 5
    })
  }

  const game = games.get(matchId)!

  // Assign socket
  if (isP1) {
    game.p1Socket = socket
  } else {
    game.p2Socket = socket
  }

  // Helper to fetch next question from database
  async function fetchNextQuestion() {
    try {
      const { data, error } = await supabase.rpc('pick_next_question_v2', {
        p_match_id: matchId
      })

      if (error) {
        console.error('Error fetching question:', error)
        return null
      }

      if (!data || data.length === 0) {
        console.error('No questions available for match')
        return null
      }

      return data[0]
    } catch (error) {
      console.error('Exception fetching question:', error)
      return null
    }
  }

  // Send connection confirmation
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'connected', player: isP1 ? 'p1' : 'p2' }))
  }

  socket.onmessage = async (event) => {
    try {
      const rawMessage = JSON.parse(event.data)
      
      // Validate message
      const validation = ClientMessageSchema.safeParse(rawMessage)
      if (!validation.success) {
        console.error('Invalid message format:', validation.error)
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format',
          details: validation.error.issues 
        }))
        return
      }
      
      const message = validation.data
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

            // Fetch first question from database using RPC
            const questionData = await fetchNextQuestion()

            if (!questionData) {
              const errorMsg = { type: 'error', message: 'Failed to load questions' }
              game.p1Socket?.send(JSON.stringify(errorMsg))
              game.p2Socket?.send(JSON.stringify(errorMsg))
              return
            }

            const startMsg = { 
              type: 'game_start',
              question: questionData.question,
              ordinal: questionData.ordinal,
              total_questions: game.questionsPerMatch
            }
            game.p1Socket?.send(JSON.stringify(startMsg))
            game.p2Socket?.send(JSON.stringify(startMsg))
          }
          break
        }

        case 'answer_submit': {
          const { question_id, step_id, answer } = message

          // Grade answer server-side via RPC
          const { data: gradeResult, error: gradeError } = await supabase.rpc('submit_answer', {
            p_match_id: matchId,
            p_question_id: question_id,
            p_step_id: step_id,
            p_answer: answer
          })

          if (gradeError) {
            console.error('Error grading answer:', gradeError)
            socket.send(JSON.stringify({ type: 'error', message: 'Failed to grade answer' }))
            return
          }

          // Update score based on server-graded result
          const marksEarned = gradeResult?.marks_earned || 0
          if (isP1) {
            game.p1Score += marksEarned
          } else {
            game.p2Score += marksEarned
          }

          // Broadcast answer result to submitter
          const answerResultMsg = {
            type: 'answer_result',
            player: isP1 ? 'p1' : 'p2',
            is_correct: gradeResult?.is_correct,
            marks_earned: marksEarned,
            explanation: gradeResult?.explanation
          }
          socket.send(JSON.stringify(answerResultMsg))

          // Broadcast score update to both players
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

          // Check if match is over
          if (game.currentQuestion >= game.questionsPerMatch) {
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
          } else {
            // Fetch next question
            const questionData = await fetchNextQuestion()

            if (!questionData) {
              const errorMsg = { type: 'error', message: 'Failed to load next question' }
              game.p1Socket?.send(JSON.stringify(errorMsg))
              game.p2Socket?.send(JSON.stringify(errorMsg))
              return
            }

            const nextQuestionMsg = {
              type: 'next_question',
              question: questionData.question,
              ordinal: questionData.ordinal,
              total_questions: game.questionsPerMatch
            }
            game.p1Socket?.send(JSON.stringify(nextQuestionMsg))
            game.p2Socket?.send(JSON.stringify(nextQuestionMsg))
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
