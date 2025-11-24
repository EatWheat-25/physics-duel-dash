import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { z } from 'npm:zod@3.23.8'

// Dev-friendly durations (in milliseconds)
const WORKING_TIME_MS = 60 * 1000  // 1 minute
const OPTIONS_TIME_MS = 45 * 1000  // 45 seconds (3 options * 15s)
const RESULT_DISPLAY_MS = 3 * 1000  // 3 seconds

// ELO calculation
function calculateElo(winner: number, loser: number, kFactor = 32): { winner: number; loser: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loser - winner) / 400))
  const expectedLoser = 1 / (1 + Math.pow(10, (winner - loser) / 400))

  return {
    winner: Math.round(winner + kFactor * (1 - expectedWinner)),
    loser: Math.round(loser + kFactor * (0 - expectedLoser)),
  }
}

type RoundPhase = 'thinking' | 'choosing' | 'result'

interface GameState {
  matchId: string
  p1Socket: WebSocket | null
  p2Socket: WebSocket | null
  p1Ready: boolean
  p2Ready: boolean
  currentRound: number
  p1Score: number
  p2Score: number
  gameActive: boolean
  roundsPerMatch: number

  // Round-specific state
  currentPhase: RoundPhase
  currentQuestionId: string | null
  currentQuestion: any | null
  currentStepIndex: number  // Track current step in multi-step questions
  thinkingDeadline: number | null  // timestamp (used for WORKING phase)
  choosingDeadline: number | null  // timestamp (used for OPTIONS phase)
  p1Answer: number | null
  p2Answer: number | null

  // New: Early submit tracking
  p1ReadyForOptions: boolean
  p2ReadyForOptions: boolean
}

// Validation schemas
const ReadyMessageSchema = z.object({
  type: z.literal('ready')
})

const AnswerSubmitSchema = z.object({
  type: z.literal('answer_submit'),
  question_id: z.string().uuid(),
  step_id: z.string().min(1),
  answer: z.number().int().min(0).max(3)  // CRITICAL: Allow 0-3 for 4 options (A, B, C, D)
}).strict()  // Reject unknown fields

const ReadyForOptionsSchema = z.object({
  type: z.literal('ready_for_options'),
  matchId: z.string().uuid()
})

const ClientMessageSchema = z.discriminatedUnion('type', [
  ReadyMessageSchema,
  AnswerSubmitSchema,
  ReadyForOptionsSchema
])

const games = new Map<string, GameState>()

// Global heartbeat for checking phase deadlines
setInterval(() => {
  const now = Date.now()

  for (const [matchId, game] of games.entries()) {
    if (!game.gameActive) continue

    // Check thinking deadline
    // Check thinking (WORKING) deadline
    if (game.currentPhase === 'thinking') {
      // Check if time expired OR both players are ready
      const timeExpired = game.thinkingDeadline && now >= game.thinkingDeadline
      const bothReady = game.p1ReadyForOptions && game.p2ReadyForOptions

      if (timeExpired || bothReady) {
        console.log(`[${matchId}] Transitioning to options (Reason: ${timeExpired ? 'Timeout' : 'Both Ready'})`)
        transitionToChoosing(game).catch(err =>
          console.error(`[${matchId}] Error in working->options transition:`, err)
        )
      }
    }

    // Check choosing deadline
    if (game.currentPhase === 'choosing' && game.choosingDeadline && now >= game.choosingDeadline) {
      console.log(`[${matchId}] Choosing time expired, transitioning to result`)
      transitionToResult(game).catch(err =>
        console.error(`[${matchId}] Error in choosing timeout:`, err)
      )
    }
  }
}, 1000) // Check every second

async function startRound(game: GameState) {
  const matchId = game.matchId
  console.log(`[${matchId}] Starting round ${game.currentRound}`)

  // Create Supabase client with service role for server operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // DEBUG: Log Supabase URL being used
  console.log(`[${matchId}] Using Supabase URL:`, Deno.env.get('SUPABASE_URL'))

  // DEBUG: First check if questions table has any data
  const { data: questionCheck, error: checkError } = await supabase
    .from('questions')
    .select('id, title, steps')
    .limit(5)

  console.log(`[${matchId}] Question table check:`, {
    count: questionCheck?.length || 0,
    error: checkError?.message,
    sample: questionCheck?.map(q => ({ id: q.id, title: q.title, hasSteps: !!q.steps }))
  })

  // Fetch next question directly (bypassing broken RPC)
  console.log(`[${matchId}] Fetching question directly from DB...`)

  // 1. Get match preferences
  const { data: matchData } = await supabase
    .from('matches_new')
    .select('subject, chapter, rank_tier')
    .eq('id', matchId)
    .single()

  // 2. Get used questions
  const { data: usedQuestions } = await supabase
    .from('match_questions')
    .select('question_id')
    .eq('match_id', matchId)

  const usedIds = usedQuestions?.map(q => q.question_id) || []

  // 3. Query questions
  // Strategy: Try strict match first, then relax
  let query = supabase.from('questions').select('*, question_steps(*)')
  let selectedQuestion: any = null;

  // Apply filters (simplified for robustness)
  if (matchData?.subject) query = query.eq('subject', matchData.subject)

  if (usedIds.length > 0) {
    query = query.not('id', 'in', `(${usedIds.join(',')})`)
  }

  // Fetch a batch to pick random
  const { data: candidates, error: fetchError } = await query.limit(20)

  if (fetchError || !candidates || candidates.length === 0) {
    console.error(`[${matchId}] ❌ Failed to fetch candidates:`, fetchError)
    // Fallback: Fetch ANY question not used
    const { data: fallback, error: fallbackError } = await supabase
      .from('questions')
      .select('*, question_steps(*)')
      .not('id', 'in', `(${usedIds.length > 0 ? usedIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .limit(10)

    if (fallbackError || !fallback || fallback.length === 0) {
      console.error(`[${matchId}] ❌ Failed to fetch fallback questions:`, fallbackError)
      const errorMsg = { type: 'error', message: 'No questions available' }
      game.p1Socket?.send(JSON.stringify(errorMsg))
      game.p2Socket?.send(JSON.stringify(errorMsg))
      return
    }
    // Pick random from fallback
    const randomIndex = Math.floor(Math.random() * fallback.length)
    selectedQuestion = fallback[randomIndex]
  } else {
    // Pick random from candidates
    const randomIndex = Math.floor(Math.random() * candidates.length)
    selectedQuestion = candidates[randomIndex]
  }

  // Format question data to match expected structure
  // The RPC returned { question_id, ordinal, question: { ... } }
  // We need to construct this structure

  // Sort steps by index
  if (selectedQuestion.question_steps && Array.isArray(selectedQuestion.question_steps)) {
    selectedQuestion.question_steps.sort((a: any, b: any) => a.step_index - b.step_index)
  }

  // Map steps to expected format if needed (mapper handles snake_case, but let's be safe)
  const steps = selectedQuestion.question_steps?.map((s: any) => ({
    id: s.id,
    index: s.step_index,
    type: s.step_type,
    title: s.title,
    prompt: s.prompt,
    options: s.options,
    correctAnswer: s.correct_answer?.correctIndex ?? 0,
    timeLimitSeconds: s.time_limit_seconds,
    marks: s.marks,
    explanation: s.explanation
  })) || []

  // Construct the "question" object expected by frontend
  const questionPayload = {
    id: selectedQuestion.id,
    title: selectedQuestion.title,
    subject: selectedQuestion.subject,
    chapter: selectedQuestion.chapter,
    level: selectedQuestion.level,
    difficulty: selectedQuestion.difficulty,
    rankTier: selectedQuestion.rank_tier,
    stem: selectedQuestion.question_text,
    totalMarks: selectedQuestion.total_marks,
    topicTags: selectedQuestion.topic_tags,
    imageUrl: selectedQuestion.image_url,
    steps: steps
  }

  const questionData = {
    question_id: selectedQuestion.id,
    question: questionPayload
  }

  console.log(`[${matchId}] Question loaded (Direct DB):`, {
    id: questionData.question_id,
    title: questionData.question?.title,
    stepsCount: steps.length
  })
  game.currentQuestionId = questionData.question_id
  game.currentQuestion = questionData.question
  game.currentPhase = 'thinking'
  game.currentStepIndex = 0  // Reset to first step for new question
  game.p1Answer = null
  game.p2Answer = null
  game.p1ReadyForOptions = false
  game.p2ReadyForOptions = false

  // Set thinking (WORKING) deadline
  const thinkingEndsAt = new Date(Date.now() + WORKING_TIME_MS)
  game.thinkingDeadline = thinkingEndsAt.getTime()

  // Insert match_question record
  const { error: mqError } = await supabase
    .from('match_questions')
    .insert({
      match_id: matchId,
      question_id: questionData.question_id,
      ordinal: game.currentRound,
      phase: 'thinking',
      thinking_started_at: new Date().toISOString(),
      thinking_ends_at: thinkingEndsAt.toISOString()
    })

  if (mqError) {
    console.error(`[${matchId}] ❌ CRITICAL ERROR inserting match_question:`, mqError)
    throw mqError
  }

  // Create match_round
  const { data: roundData, error: roundError } = await supabase
    .from('match_rounds')
    .insert({
      match_id: matchId,
      question_id: questionData.question_id,
      round_number: game.currentRound,
      status: 'pending'
    })
    .select()
    .single()

  if (roundError) {
    console.error(`[${matchId}] Error creating match_round:`, roundError)
  }

  const roundId = roundData?.id

  // Send ROUND_START event
  const roundStartMsg = {
    type: 'ROUND_START',
    matchId,
    roundId,
    roundIndex: game.currentRound,
    phase: 'thinking',
    question: questionData.question,
    thinkingEndsAt: thinkingEndsAt.toISOString(),
    currentStepIndex: 0  // Always start at step 0
  }

  console.log(`[game-ws] ROUND_START`, {
    matchId,
    roundIndex: game.currentRound,
    thinkingEndsAt: thinkingEndsAt.toISOString(),
    totalSteps: questionData.question.steps?.length || 1,
    questionId: questionData.question_id,
    hasSteps: !!questionData.question.steps,
    stepsIsArray: Array.isArray(questionData.question.steps)
  })
  console.log(`[QA-LOG] [${matchId}] Emitting ROUND_START:`, {
    roundIndex: game.currentRound,
    questionId: questionData.question_id,
    stepsCount: questionData.question.steps?.length || 0,
    firstStepTitle: questionData.question.steps?.[0]?.title
  })
  game.p1Socket?.send(JSON.stringify(roundStartMsg))
  game.p2Socket?.send(JSON.stringify(roundStartMsg))
}

async function transitionToChoosing(game: GameState) {
  const matchId = game.matchId
  console.log(`[${matchId}] Transitioning to CHOOSING phase`)

  if (game.currentPhase !== 'thinking') {
    console.log(`[${matchId}] Already past thinking phase, ignoring`)
    return
  }

  game.currentPhase = 'choosing'

  // Set choosing (OPTIONS) deadline
  const choosingEndsAt = new Date(Date.now() + OPTIONS_TIME_MS)
  game.choosingDeadline = choosingEndsAt.getTime()
  game.thinkingDeadline = null

  // Update DB
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  await supabase
    .from('match_questions')
    .update({
      phase: 'choosing',
      choosing_started_at: new Date().toISOString(),
      choosing_ends_at: choosingEndsAt.toISOString()
    })
    .eq('match_id', matchId)
    .eq('question_id', game.currentQuestionId)

  // Extract all options from current step
  const currentStep = game.currentQuestion.steps?.[game.currentStepIndex]
  if (!currentStep) {
    console.error(`[${matchId}] No step found at index ${game.currentStepIndex}`)
    return
  }
  const options = currentStep.options.map((text: string, idx: number) => ({
    id: idx,
    text,
  }))

  // Send PHASE_CHANGE event
  const phaseChangeMsg = {
    type: 'PHASE_CHANGE',
    matchId,
    roundIndex: game.currentRound,
    phase: 'choosing',
    choosingEndsAt: choosingEndsAt.toISOString(),
    options,
    currentStepIndex: game.currentStepIndex,
    totalSteps: game.currentQuestion.steps?.length || 1
  }

  console.log(`[game-ws] PHASE_CHANGE → choosing`, { matchId, roundIndex: game.currentRound, step: game.currentStepIndex + 1, totalSteps: game.currentQuestion.steps?.length || 1, choosingEndsAt: choosingEndsAt.toISOString(), optionsCount: options.length })
  game.p1Socket?.send(JSON.stringify(phaseChangeMsg))
  game.p2Socket?.send(JSON.stringify(phaseChangeMsg))
}

async function transitionToResult(game: GameState) {
  const matchId = game.matchId
  console.log(`[${matchId}] Transitioning to RESULT phase`)

  if (game.currentPhase !== 'choosing') {
    console.log(`[${matchId}] Not in choosing phase, ignoring`)
    return
  }

  game.currentPhase = 'result'
  game.choosingDeadline = null

  // Update DB
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  await supabase
    .from('match_questions')
    .update({ phase: 'result' })
    .eq('match_id', matchId)
    .eq('question_id', game.currentQuestionId)

  // Get correct answer from current step
  const steps = game.currentQuestion?.steps
  if (!Array.isArray(steps) || steps.length === 0) {
    console.error(`[${matchId}] No steps array found in question`)
    game.p1Socket?.send(JSON.stringify({ type: 'error', message: 'Invalid question structure' }))
    game.p2Socket?.send(JSON.stringify({ type: 'error', message: 'Invalid question structure' }))
    return
  }

  const currentStep = steps[game.currentStepIndex]
  if (!currentStep) {
    console.error(`[${matchId}] Step ${game.currentStepIndex} not found (total steps: ${steps.length})`)
    game.p1Socket?.send(JSON.stringify({ type: 'error', message: 'Step not found' }))
    game.p2Socket?.send(JSON.stringify({ type: 'error', message: 'Step not found' }))
    return
  }

  // Extract correct answer (handle both camelCase and snake_case)
  const correctAnswer = currentStep.correctAnswer ?? currentStep.correct_answer ?? 0
  const marksPerQuestion = currentStep.marks ?? 1

  console.log(`[${matchId}] Grading step ${game.currentStepIndex}:`, {
    correctAnswer,
    marks: marksPerQuestion,
    p1Answer: game.p1Answer,
    p2Answer: game.p2Answer
  })

  // Grade answers (null = no answer submitted)
  const p1IsCorrect = game.p1Answer === correctAnswer
  const p2IsCorrect = game.p2Answer === correctAnswer

  const p1Marks = p1IsCorrect ? marksPerQuestion : 0
  const p2Marks = p2IsCorrect ? marksPerQuestion : 0

  game.p1Score += p1Marks
  game.p2Score += p2Marks

  // Get match data for player IDs
  const { data: match } = await supabase
    .from('matches_new')
    .select('p1, p2')
    .eq('id', matchId)
    .single()

  // Update DB with results
  await supabase
    .from('match_questions')
    .update({
      p1_answer: game.p1Answer,
      p2_answer: game.p2Answer,
      p1_correct: p1IsCorrect,
      p2_correct: p2IsCorrect
    })
    .eq('match_id', matchId)
    .eq('question_id', game.currentQuestionId)

  // Calculate tug-of-war
  const tugOfWar = game.p1Score - game.p2Score

  // Send ROUND_RESULT event
  const roundResultMsg = {
    type: 'ROUND_RESULT',
    matchId,
    roundIndex: game.currentRound,
    questionId: game.currentQuestionId,
    correctOptionId: correctAnswer,
    playerResults: [
      {
        playerId: match?.p1,
        selectedOptionId: game.p1Answer,
        isCorrect: p1IsCorrect
      },
      {
        playerId: match?.p2,
        selectedOptionId: game.p2Answer,
        isCorrect: p2IsCorrect
      }
    ],
    tugOfWar,
    p1Score: game.p1Score,
    p2Score: game.p2Score
  }

  console.log(`[game-ws] ROUND_RESULT`, { matchId, roundIndex: game.currentRound, step: game.currentStepIndex + 1, p1Correct: p1IsCorrect, p2Correct: p2IsCorrect, tugOfWar })
  console.log(`[QA-LOG] [${matchId}] Emitting ROUND_RESULT:`, {
    roundIndex: game.currentRound,
    p1Correct: p1IsCorrect,
    p2Correct: p2IsCorrect,
    tugOfWar
  })
  game.p1Socket?.send(JSON.stringify(roundResultMsg))
  game.p2Socket?.send(JSON.stringify(roundResultMsg))

  // Wait, then check if there are more steps or advance to next round
  setTimeout(() => {
    const totalSteps = game.currentQuestion.steps?.length || 1
    const hasMoreSteps = game.currentStepIndex < totalSteps - 1

    if (hasMoreSteps) {
      // Advance to next step in the same question
      game.currentStepIndex++
      console.log(`[${matchId}] Advancing to step ${game.currentStepIndex + 1} of ${totalSteps}`)

      // Reset for next step
      game.p1Answer = null
      game.p2Answer = null
      game.p1ReadyForOptions = false
      game.p2ReadyForOptions = false
      game.currentPhase = 'thinking'

      // Set new thinking deadline
      const thinkingEndsAt = new Date(Date.now() + WORKING_TIME_MS)
      game.thinkingDeadline = thinkingEndsAt.getTime()

      // Immediately transition to choosing for next step (skip thinking phase for subsequent steps)
      transitionToChoosing(game).catch(err =>
        console.error(`[${matchId}] Error transitioning to next step:`, err)
      )
    } else {
      // All steps complete, advance to next round
      game.currentRound++
      console.log(`[${matchId}] ✅ All steps complete for round ${game.currentRound - 1}`)
      console.log(`[${matchId}] 📊 Score: P1=${game.p1Score}, P2=${game.p2Score}`)
      console.log(`[${matchId}] 🔄 Checking if match should continue: round ${game.currentRound} of ${game.roundsPerMatch}`)

      if (game.currentRound > game.roundsPerMatch) {
        console.log(`[${matchId}] 🏁 Match complete! Ending match.`)
        endMatch(game).catch(err =>
          console.error(`[${matchId}] ❌ Error ending match:`, err)
        )
      } else {
        console.log(`[${matchId}] ▶️ Starting next round (round ${game.currentRound})`)
        startRound(game).catch(err =>
          console.error(`[${matchId}] ❌ Error starting next round:`, err)
        )
      }
    }
  }, RESULT_DISPLAY_MS)
}

async function endMatch(game: GameState) {
  const matchId = game.matchId
  console.log(`[${matchId}] Match ending - Final score: ${game.p1Score} - ${game.p2Score}`)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Get match data
  const { data: match } = await supabase
    .from('matches_new')
    .select('p1, p2')
    .eq('id', matchId)
    .single()

  if (!match) return

  const winnerId = game.p1Score > game.p2Score ? match.p1 :
    game.p2Score > game.p1Score ? match.p2 : null
  const loserId = winnerId ? (winnerId === match.p1 ? match.p2 : match.p1) : null

  // Calculate MMR changes
  let mmrChanges = {}
  if (winnerId && loserId) {
    const { data: players } = await supabase
      .from('players')
      .select('id, mmr')
      .in('id', [match.p1, match.p2])

    const winnerOldMmr = players?.find(p => p.id === winnerId)?.mmr || 1000
    const loserOldMmr = players?.find(p => p.id === loserId)?.mmr || 1000

    const newElos = calculateElo(winnerOldMmr, loserOldMmr)

    await supabase.from('players').update({ mmr: newElos.winner }).eq('id', winnerId)
    await supabase.from('players').update({ mmr: newElos.loser }).eq('id', loserId)

    mmrChanges = {
      [winnerId]: { old: winnerOldMmr, new: newElos.winner },
      [loserId]: { old: loserOldMmr, new: newElos.loser }
    }
  }

  // Update match
  await supabase
    .from('matches_new')
    .update({
      state: 'ended',
      winner_id: winnerId,
      p1_score: game.p1Score,
      p2_score: game.p2Score,
      ended_at: new Date().toISOString()
    })
    .eq('id', matchId)

  // Send MATCH_END event
  const matchEndMsg = {
    type: 'MATCH_END',
    matchId,
    winnerPlayerId: winnerId,
    summary: {
      roundsPlayed: game.currentRound,
      finalScores: {
        p1: game.p1Score,
        p2: game.p2Score
      }
    },
    mmrChanges
  }

  console.log(`[${matchId}] Sending MATCH_END`)
  game.p1Socket?.send(JSON.stringify(matchEndMsg))
  game.p2Socket?.send(JSON.stringify(matchEndMsg))

  // Cleanup
  setTimeout(() => {
    game.p1Socket?.close()
    game.p2Socket?.close()
    games.delete(matchId)
    console.log(`[${matchId}] Game cleaned up`)
  }, 1000)
}

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

  console.log(`[${matchId}] WebSocket connection for user ${user.id}`)

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
      currentRound: 0,
      p1Score: 0,
      p2Score: 0,
      gameActive: false,
      roundsPerMatch: 3,
      currentPhase: 'thinking',
      currentQuestionId: null,
      currentQuestion: null,
      currentStepIndex: 0,  // Initialize step index
      thinkingDeadline: null,
      choosingDeadline: null,
      p1Answer: null,
      p2Answer: null,
      p1ReadyForOptions: false,
      p2ReadyForOptions: false
    })
    console.log(`[QA-LOG] [${matchId}] New game state initialized`)
  }

  const game = games.get(matchId)!

  // Assign socket
  if (isP1) {
    game.p1Socket = socket
  } else {
    game.p2Socket = socket
  }

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'connected', player: isP1 ? 'p1' : 'p2' }))
  }

  socket.onmessage = async (event) => {
    try {
      const rawMessage = JSON.parse(event.data)
      console.log(`[${matchId}] 📨 Received message:`, rawMessage.type, rawMessage)

      const validation = ClientMessageSchema.safeParse(rawMessage)
      if (!validation.success) {
        console.error(`[${matchId}] ❌ Invalid message - validation failed:`, validation.error.errors)
        console.error(`[${matchId}] Raw message was:`, rawMessage)

        // Send error response so client doesn't timeout
        socket.send(JSON.stringify({
          type: 'validation_error',
          message: 'Invalid message format',
          details: validation.error.errors
        }))
        return
      }

      const message = validation.data
      console.log(`[${matchId}] ✅ Message validated successfully:`, message.type)

      switch (message.type) {
        case 'ready': {
          if (isP1) game.p1Ready = true
          else game.p2Ready = true

          console.log(`[${matchId}] ${isP1 ? 'P1' : 'P2'} ready`)

          // Notify both players
          const readyMsg = { type: 'player_ready', player: isP1 ? 'p1' : 'p2' }
          game.p1Socket?.send(JSON.stringify(readyMsg))
          game.p2Socket?.send(JSON.stringify(readyMsg))


          // Start game if both ready
          if (game.p1Ready && game.p2Ready && !game.gameActive) {
            console.log(`[QA-LOG] [${matchId}] ✅ Both players ready, starting match`)
            game.gameActive = true
            game.currentRound = 1  // Initialize to round 1

            const { error: updateError } = await supabase
              .from('matches_new')
              .update({ state: 'active' })
              .eq('id', matchId)

            if (updateError) {
              console.error(`[${matchId}] ❌ Error updating match state:`, updateError)
            }

            console.log(`[${matchId}] 🎮 Starting first round (round ${game.currentRound})`)
            // Start first round
            await startRound(game)
          }
          break
        }

        case 'answer_submit': {
          const { answer } = message

          console.log(`[QA-LOG] [${matchId}] 🎯 ${isP1 ? 'P1' : 'P2'} submitted answer:`, {
            answer,
            currentPhase: game.currentPhase,
            currentStepIndex: game.currentStepIndex,
            totalSteps: game.currentQuestion?.steps?.length || 0
          })

          // Verify we're in choosing phase
          if (game.currentPhase !== 'choosing') {
            console.log(`[${matchId}] ❌ Answer rejected - not in choosing phase (current: ${game.currentPhase})`)
            socket.send(JSON.stringify({ type: 'error', message: 'Not in choosing phase' }))
            return
          }

          // Store answer
          if (isP1) {
            if (game.p1Answer !== null) {
              console.log(`[${matchId}] ⚠️ P1 already answered, ignoring`)
              return
            }
            game.p1Answer = answer
            console.log(`[${matchId}] ✅ P1 answer stored: ${answer}`)
          } else {
            if (game.p2Answer !== null) {
              console.log(`[${matchId}] ⚠️ P2 already answered, ignoring`)
              return
            }
            game.p2Answer = answer
            console.log(`[${matchId}] ✅ P2 answer stored: ${answer}`)
          }

          // If both answered, immediately transition to result
          if (game.p1Answer !== null && game.p2Answer !== null) {
            console.log(`[${matchId}] 🎉 Both players answered, transitioning to result immediately`)
            await transitionToResult(game)
          } else {
            console.log(`[${matchId}] ⏳ Waiting for other player (P1: ${game.p1Answer !== null ? 'answered' : 'waiting'}, P2: ${game.p2Answer !== null ? 'answered' : 'waiting'})`)
          }

          break
        }

        case 'ready_for_options': {
          console.log(`[${matchId}] ${isP1 ? 'P1' : 'P2'} ready for options`)

          if (game.currentPhase !== 'thinking') {
            console.log(`[${matchId}] Ignoring ready_for_options - not in working phase`)
            return
          }

          if (isP1) game.p1ReadyForOptions = true
          else game.p2ReadyForOptions = true

          // Notify other player? (Optional, but good for UI)
          // For now, we rely on the heartbeat to trigger the phase change when both are ready
          break
        }
      }
    } catch (error) {
      console.error(`[${matchId}] Error handling message:`, error)
      socket.send(JSON.stringify({ type: 'error', message: 'Internal error' }))
    }
  }

  socket.onclose = () => {
    console.log(`[${matchId}] WebSocket closed for ${isP1 ? 'P1' : 'P2'}`)
    if (game.p1Socket === socket) game.p1Socket = null
    if (game.p2Socket === socket) game.p2Socket = null

    // Clean up if both disconnected
    if (!game.p1Socket && !game.p2Socket) {
      games.delete(matchId)
      console.log(`[${matchId}] Both players disconnected, cleaning up`)
    }
  }

  socket.onerror = (error) => {
    console.error(`[${matchId}] WebSocket error:`, error)
  }

  return response
})
