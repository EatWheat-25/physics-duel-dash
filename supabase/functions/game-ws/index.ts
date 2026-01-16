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

interface RoundStartEvent {
  type: 'ROUND_START'
  matchId: string
  roundId: string
  roundIndex: number
  phase: 'thinking' | 'main_question'
  question: {
    id: string
    title: string
    subject: string
    chapter: string
    level: string
    difficulty: string
    questionText: string
    stem?: string
    imageUrl?: string
    graph?: any
    totalMarks: number
    steps: Array<{
      id: string
      question: string
      prompt?: string
      options: string[]
      correctAnswer: number
      marks: number
      explanation?: string
    }>
    topicTags?: string[]
    rankTier?: string
  }
  thinkingEndsAt?: string
  mainQuestionEndsAt?: string
  mainQuestionTimerSeconds?: number
  totalSteps?: number
}

interface QuestionReceivedEvent {
  type: 'QUESTION_RECEIVED'
  question: any // Raw question object from questions_v2
  timer_end_at: string // ISO timestamp when timer expires (derived from steps[0].timeLimitSeconds when available)
}

interface AnswerReceivedEvent {
  type: 'ANSWER_RECEIVED'
  player: 'player1' | 'player2'
  waiting_for_opponent: boolean
}

interface PhaseChangeEvent {
  type: 'PHASE_CHANGE'
  matchId: string
  phase: 'steps'
  stepIndex: number
  segment: 'main' | 'sub'
  subStepIndex: number
  totalSteps: number
  stepEndsAt: string
  // Optional: indicates whether step progression is per-player (async) or match-synchronized (shared)
  progressMode?: 'async' | 'shared'
  currentStep: {
    id: string
    prompt: string
    options: string[]
    correctAnswer: number
    marks: number
  }
}

interface StepAnswerReceivedEvent {
  type: 'STEP_ANSWER_RECEIVED'
  stepIndex: number
  segment: 'main' | 'sub'
  subStepIndex: number
  playerId: string
  waitingForOpponent: boolean
}

interface AllStepsCompleteWaitingEvent {
  type: 'ALL_STEPS_COMPLETE_WAITING'
  p1Complete: boolean
  p2Complete: boolean
}

interface ResultsReceivedEvent {
  type: 'RESULTS_RECEIVED'
  player1_answer: number | null
  player2_answer: number | null
  correct_answer: number
  player1_correct: boolean
  player2_correct: boolean
  round_winner: string | null
  p1Score?: number
  p2Score?: number
  stepResults?: Array<{
    stepIndex: number
    correctAnswer: number
    p1AnswerIndex: number | null
    p2AnswerIndex: number | null
    p1Marks: number
    p2Marks: number
  }>
  roundNumber?: number
  targetRoundsToWin?: number
  playerRoundWins?: { [playerId: string]: number }
  matchOver?: boolean
  matchWinnerId?: string | null
}

interface MatchFinishedEvent {
  type: 'MATCH_FINISHED'
  winner_id: string | null
  total_rounds: number
}

interface RoundStartedEvent {
  type: 'ROUND_STARTED'
  round_number: number
  last_round_winner: string | null
  consecutive_wins_count: number
}

const PROTOCOL_VERSION = 2
const ENABLE_WS_FASTPATH = false

type RoundPhase = 'main' | 'steps' | 'results' | 'done'

interface PlayerSnapshot {
  id: string | null
  answered: boolean
  completed: boolean
  currentStepIndex: number | null
  currentSegment: 'main' | 'sub' | null
  currentSubStepIndex: number | null
  segmentEndsAt: string | null
}

interface StateSnapshotEvent {
  type: 'STATE_SNAPSHOT'
  protocolVersion: number
  serverTime: string
  matchId: string
  roundId: string | null
  roundNumber: number
  targetRoundsToWin: number
  phase: RoundPhase
  phaseSeq: number
  stateVersion?: number
  endsAt: string | null
  question: any | null
  totalSteps: number
  players: {
    p1: PlayerSnapshot | null
    p2: PlayerSnapshot | null
  }
  playerRoundWins: { [playerId: string]: number }
  resultsPayload?: any | null
  resultsVersion?: number | null
  matchOver: boolean
  matchWinnerId: string | null
}

interface PhaseUpdateEvent {
  type: 'PHASE_UPDATE'
  protocolVersion: number
  serverTime: string
  matchId: string
  roundId: string
  phase: RoundPhase
  phaseSeq: number
  endsAt: string | null
}

// Track sockets locally (for broadcasting) - each instance only tracks its own sockets
const sockets = new Map<string, Set<WebSocket>>() // matchId -> Set<WebSocket>

// Track timeouts per match (for cleanup)
const matchTimeouts = new Map<string, number>() // matchId -> timeoutId

// Track async per-player progress sweeps (DB-driven timeouts) per match (per Edge instance)
const asyncProgressSweepIntervals = new Map<string, number>() // matchId -> intervalId
const lastAsyncProgressKeys = new Map<string, Map<string, string>>() // matchId -> (playerId -> key)
const multiStepResultsComputeInProgress = new Set<string>() // `${matchId}:${roundId}`

// Phase scheduler (non-authoritative tick loop)
const phaseSchedulers = new Map<string, number>() // matchId -> intervalId

// Track game state for multi-step questions
interface GameState {
  currentPhase: 'question' | 'main_question' | 'steps' | 'result'
  // When set to 'async', step progression is per-player via DB progress rows.
  // Undefined means legacy/shared in-memory progression.
  progressMode?: 'async' | 'shared'
  currentStepIndex: number
  currentSegment: 'main' | 'sub'
  currentSubStepIndex: number
  mainQuestionTimer: number | null // timeout ID
  segmentTimer: number | null // timeout ID for the CURRENT (stepIndex, segment, subStepIndex)
  mainQuestionEndsAt: string | null
  stepEndsAt: string | null
  // Main answers: playerId -> stepIndex -> answerIndex (null = timeout/no answer)
  playerStepAnswers: Map<string, Map<number, number | null>>
  // Sub answers: playerId -> stepIndex -> subStepIndex -> answerIndex (null = timeout/no answer)
  playerSubStepAnswers: Map<string, Map<number, Map<number, number | null>>>
  currentQuestion: any | null
  p1Id: string | null
  p2Id: string | null
  eliminatedPlayers: Set<string> // playerIds eliminated for this round
  roundNumber: number
  targetRoundsToWin: number
  playerRoundWins: Map<string, number> // playerId -> round wins
  p1AllStepsComplete: boolean
  p2AllStepsComplete: boolean
}

const gameStates = new Map<string, GameState>() // matchId -> GameState

// Track match-level state (round wins, etc.) for all matches
interface MatchState {
  roundNumber: number
  targetRoundsToWin: number
  playerRoundWins: Map<string, number> // playerId -> round wins
  p1Id: string | null
  p2Id: string | null
  p1ResultsAcknowledged: boolean
  p2ResultsAcknowledged: boolean
  roundTransitionInProgress: boolean
}

const matchStates = new Map<string, MatchState>() // matchId -> MatchState

/**
 * Broadcast message to all sockets for a match
 */
function broadcastToMatch(matchId: string, event: any): void {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) {
    console.warn(`[${matchId}] ⚠️ No sockets found for match - cannot broadcast ${event.type}`)
    return
  }

  let sentCount = 0
  matchSockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event))
        sentCount++
      } catch (error) {
        console.error(`[${matchId}] ❌ Error broadcasting ${event.type}:`, error)
      }
    }
  })

  console.log(`[${matchId}] 📊 Broadcast ${event.type} to ${sentCount}/${matchSockets.size} sockets`)
}

function progressKeyFromRow(row: any): string {
  const stepIndex = Number(row?.current_step_index ?? row?.currentStepIndex ?? row?.current_step ?? -999)
  const segment = (row?.current_segment === 'sub' || row?.currentSegment === 'sub') ? 'sub' : 'main'
  const subIdx = segment === 'sub'
    ? Number(row?.current_sub_step_index ?? row?.currentSubStepIndex ?? row?.subStepIndex ?? 0)
    : 0
  const endsAtRaw = row?.segment_ends_at ?? row?.segmentEndsAt ?? row?.stepEndsAt ?? ''
  const completedAtRaw = row?.completed_at ?? row?.completedAt ?? ''
  const endsAt = endsAtRaw ? (() => { try { return new Date(endsAtRaw).toISOString() } catch { return String(endsAtRaw) } })() : ''
  const completedAt = completedAtRaw ? (() => { try { return new Date(completedAtRaw).toISOString() } catch { return String(completedAtRaw) } })() : ''
  return `${stepIndex}|${segment}|${subIdx}|${endsAt}|${completedAt}`
}

function setLastAsyncProgressKey(matchId: string, playerId: string, key: string): void {
  if (!lastAsyncProgressKeys.has(matchId)) lastAsyncProgressKeys.set(matchId, new Map())
  lastAsyncProgressKeys.get(matchId)!.set(playerId, key)
}

function clearAsyncProgressSweep(matchId: string): void {
  const intervalId = asyncProgressSweepIntervals.get(matchId)
  if (intervalId) {
    clearInterval(intervalId)
    asyncProgressSweepIntervals.delete(matchId)
  }
  lastAsyncProgressKeys.delete(matchId)
}

function ensureAsyncProgressSweep(matchId: string, supabase: any): void {
  if (asyncProgressSweepIntervals.has(matchId)) return

  const intervalId = setInterval(() => {
    // Fire-and-forget: keep the loop alive even if one tick errors
    runAsyncProgressSweepTick(matchId, supabase).catch((err) => {
      console.error(`[${matchId}] ❌ Async progress sweep tick error:`, err)
    })
  }, 1000) as unknown as number

  asyncProgressSweepIntervals.set(matchId, intervalId)
  console.log(`[${matchId}] 🕒 Started async progress sweep (1s)`)
}

async function runAsyncProgressSweepTick(
  matchId: string,
  supabase: any
): Promise<void> {
  const matchSockets = sockets.get(matchId)

  // Stop sweep if match no longer active on this instance
  if (!matchSockets || matchSockets.size === 0) {
    clearAsyncProgressSweep(matchId)
    return
  }

  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select('current_round_id, player1_id, player2_id')
    .eq('id', matchId)
    .single()

  if (matchError || !matchRow?.current_round_id) return
  const roundId = matchRow.current_round_id as string

  const { data: roundRow, error: roundError } = await supabase
    .from('match_rounds')
    .select('id, phase, status, question_id')
    .eq('id', roundId)
    .single()
  if (roundError || !roundRow) return
  const roundPhase = (roundRow.phase ?? roundRow.status ?? 'main') as string
  if (roundPhase !== 'steps') {
    clearAsyncProgressSweep(matchId)
    return
  }

  // Advance any overdue segments (idempotent + serialized by advisory locks in SQL)
  {
    // PostgREST cannot disambiguate overloaded functions unless we include all parameters.
    // Prefer the (p_match_id, p_round_id, p_force) signature; fallback to legacy 2-arg if needed.
    const { error: err3 } = await supabase.rpc('auto_advance_overdue_segments_v1', {
      p_match_id: matchId,
      p_round_id: roundId,
      p_force: false
    })
    if (err3) {
      // Fallback: older deployments may only have the 2-arg version
      const { error: err2 } = await supabase.rpc('auto_advance_overdue_segments_v1', {
        p_match_id: matchId,
        p_round_id: roundId
      })
      if (err2) {
        console.warn(`[${matchId}] ⚠️ auto_advance_overdue_segments_v1 error:`, err3, err2)
      }
    }
  }

  const playerIds = [matchRow.player1_id, matchRow.player2_id].filter(Boolean) as string[]
  if (playerIds.length === 0) return

  const { data: progressRows, error: progressRowsError } = await supabase
    .from('match_round_player_progress_v1')
    .select('*')
    .eq('match_id', matchId)
    .eq('round_id', roundId)
    .in('player_id', playerIds)

  if (progressRowsError || !Array.isArray(progressRows)) return

  let steps: any[] = []
  if (roundRow.question_id) {
    const { data: q } = await supabase
      .from('questions_v2')
      .select('steps')
      .eq('id', roundRow.question_id)
      .single()
    steps = normalizeSteps(q?.steps)
  }
  const hasSteps = steps.length > 0
  let progressChanged = false

  // Completion state (for waiting UI). We broadcast this when it changes.
  const byPlayer = new Map<string, any>()
  progressRows.forEach((row: any) => byPlayer.set(row.player_id, row))
  const p1Complete = !!(matchRow.player1_id && byPlayer.get(matchRow.player1_id)?.completed_at)
  const p2Complete = !!(matchRow.player2_id && byPlayer.get(matchRow.player2_id)?.completed_at)

  // Push per-player PHASE_CHANGE updates when progress changes
  for (const row of progressRows) {
    const pid = row.player_id as string
    const key = progressKeyFromRow(row)
    const prevKey = lastAsyncProgressKeys.get(matchId)?.get(pid)
    if (key === prevKey) continue
    setLastAsyncProgressKey(matchId, pid, key)
    progressChanged = true

    // If player finished, waiting UI is driven by ALL_STEPS_COMPLETE_WAITING
    if (row.completed_at) continue

    if (!hasSteps) continue

    const stepIndex = Number(row.current_step_index ?? 0)
    const seg = (row.current_segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
    const subIdx = seg === 'sub' ? Number(row.current_sub_step_index ?? 0) : 0
    const stepEndsAt = row.segment_ends_at ? String(row.segment_ends_at) : new Date().toISOString()

    if (!Number.isFinite(stepIndex) || stepIndex < 0 || stepIndex >= steps.length) continue
    const mainStep = steps[stepIndex]
    const subSteps = normalizeSubSteps(mainStep)
    const segStep = seg === 'main' ? mainStep : subSteps[subIdx]
    if (!segStep) continue

    const phaseChangeEvent: PhaseChangeEvent = {
      type: 'PHASE_CHANGE',
      matchId,
      phase: 'steps',
      stepIndex,
      segment: seg,
      subStepIndex: subIdx,
      totalSteps: steps.length,
      stepEndsAt,
      progressMode: 'async',
      currentStep: {
        id: segStep?.id || '',
        prompt: coercePrompt(segStep),
        options: coerceOptions(segStep),
        correctAnswer: coerceCorrectAnswerIndex(segStep),
        marks: mainStep?.marks || 0
      }
    }

    sendToPlayer(matchId, pid, phaseChangeEvent)
  }

  // If completion changed (or one player completed), broadcast waiting status so UI can show the correct end-of-steps screen.
  // We key off completion booleans only (not per-player step position).
  const completionKey = `${p1Complete}|${p2Complete}`
  const prevCompletionKey = lastAsyncProgressKeys.get(matchId)?.get('__completion__')
  if (completionKey !== prevCompletionKey) {
    setLastAsyncProgressKey(matchId, '__completion__', completionKey)
    const waitingEvent: AllStepsCompleteWaitingEvent = {
      type: 'ALL_STEPS_COMPLETE_WAITING',
      p1Complete,
      p2Complete
    }
    if (matchRow.player1_id) sendToPlayer(matchId, matchRow.player1_id, waitingEvent)
    if (matchRow.player2_id) sendToPlayer(matchId, matchRow.player2_id, waitingEvent)
    progressChanged = true

    // If both players are complete, compute results immediately (idempotent).
    if (p1Complete && p2Complete) {
      await computeAndBroadcastMultiStepResultsV3(matchId, roundId, supabase)
    }
  }

  if (progressChanged) {
    await broadcastSnapshotToMatch(matchId, supabase)
  }
}

async function computeAndBroadcastMultiStepResultsV3(
  matchId: string,
  roundId: string,
  supabase: any
): Promise<void> {
  const key = `${matchId}:${roundId}`
  if (multiStepResultsComputeInProgress.has(key)) return
  multiStepResultsComputeInProgress.add(key)

  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('compute_multi_step_results_v3', {
      p_match_id: matchId,
      p_round_id: roundId
    })

    if (rpcError) {
      console.error(`[${matchId}] ❌ Error calling compute_multi_step_results_v3:`, rpcError)
      return
    }

    if (!rpcResult?.success) {
      console.error(`[${matchId}] ❌ compute_multi_step_results_v3 returned error:`, rpcResult?.error)
      return
    }

    const payload = rpcResult.results_payload
    if (!payload) {
      console.error(`[${matchId}] ❌ compute_multi_step_results_v3 did not return results_payload`)
      return
    }

    await attemptPhaseAdvance(matchId, supabase, { forceSnapshot: true })

    const gameState = gameStates.get(matchId)
    if (gameState) {
      gameState.currentPhase = 'result'
    }

    // Stop async sweep during results
    clearAsyncProgressSweep(matchId)

    const matchOver = !!payload.match_over
    const matchWinnerId = payload.match_winner_id ?? null

    if (matchOver) {
      console.log(`[${matchId}] 🏁 Match finished - Winner: ${matchWinnerId}`)
      matchStates.delete(matchId)
      setTimeout(() => {
        cleanupGameState(matchId)
      }, 5000)
    } else {
      console.log(`[${matchId}] ⏳ Waiting for both players to acknowledge results before starting next round`)
    }
  } finally {
    multiStepResultsComputeInProgress.delete(key)
  }
}

/**
 * Send an event to all sockets for a specific player in a match (supports multi-tab).
 * Falls back to the provided socket if metadata isn't available.
 */
function sendToPlayer(
  matchId: string,
  playerId: string,
  event: any,
  fallbackSocket?: WebSocket
): void {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) return

  let sentCount = 0
  matchSockets.forEach((s) => {
    const metaPlayerId = (s as any)?._playerId as string | undefined
    if (s.readyState === WebSocket.OPEN && metaPlayerId === playerId) {
      try {
        s.send(JSON.stringify(event))
        sentCount++
      } catch (err) {
        console.error(`[${matchId}] ❌ Error sending ${event.type} to player ${playerId}:`, err)
      }
    }
  })

  if (sentCount === 0 && fallbackSocket && fallbackSocket.readyState === WebSocket.OPEN) {
    try {
      fallbackSocket.send(JSON.stringify(event))
      sentCount = 1
    } catch (err) {
      console.error(`[${matchId}] ❌ Error sending ${event.type} via fallback socket to player ${playerId}:`, err)
    }
  }

  console.log(`[${matchId}] 📤 Sent ${event.type} to player ${playerId}: ${sentCount} socket(s)`)
}

async function buildStateSnapshot(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<StateSnapshotEvent | null> {
  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select(
      [
        'id',
        'status',
        'winner_id',
        'current_round_id',
        'current_round_number',
        'target_rounds_to_win',
        'player1_id',
        'player2_id',
        'player1_answered_at',
        'player2_answered_at',
        'player1_round_wins',
        'player2_round_wins',
        'results_payload',
        'results_round_id',
        'results_version'
      ].join(',')
    )
    .eq('id', matchId)
    .single()

  if (matchError || !matchRow) {
    console.warn(`[${matchId}] ⚠️ Failed to load match snapshot`, matchError)
    return null
  }

  let roundRow: any = null
  if (matchRow.current_round_id) {
    const { data: roundData, error: roundError } = await supabase
      .from('match_rounds')
      .select('id, question_id, phase, phase_seq, state_version, ends_at, status')
      .eq('id', matchRow.current_round_id)
      .single()

    if (!roundError && roundData) {
      roundRow = roundData
    }
  }

  let question: any | null = null
  let totalSteps = 0
  if (roundRow?.question_id) {
    const { data: q, error: qError } = await supabase
      .from('questions_v2')
      .select('*')
      .eq('id', roundRow.question_id)
      .single()
    if (!qError && q) {
      question = q
      try {
        const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
        totalSteps = Array.isArray(steps) ? steps.length : 0
      } catch {
        totalSteps = 0
      }
    }
  }

  const playerRoundWins: { [playerId: string]: number } = {}
  if (matchRow.player1_id) playerRoundWins[matchRow.player1_id] = Number(matchRow.player1_round_wins || 0)
  if (matchRow.player2_id) playerRoundWins[matchRow.player2_id] = Number(matchRow.player2_round_wins || 0)

  const phase: RoundPhase = (roundRow?.phase ?? roundRow?.status ?? 'main') as RoundPhase
  const phaseSeq = Number.isFinite(roundRow?.phase_seq) ? Number(roundRow.phase_seq) : 0
  const stateVersion = Number.isFinite(roundRow?.state_version) ? Number(roundRow.state_version) : 0
  const endsAt = roundRow?.ends_at ? String(roundRow.ends_at) : null

  const players: { p1: PlayerSnapshot | null; p2: PlayerSnapshot | null } = {
    p1: matchRow.player1_id
      ? {
          id: matchRow.player1_id,
          answered: !!matchRow.player1_answered_at,
          completed: false,
          currentStepIndex: null,
          currentSegment: null,
          currentSubStepIndex: null,
          segmentEndsAt: null
        }
      : null,
    p2: matchRow.player2_id
      ? {
          id: matchRow.player2_id,
          answered: !!matchRow.player2_answered_at,
          completed: false,
          currentStepIndex: null,
          currentSegment: null,
          currentSubStepIndex: null,
          segmentEndsAt: null
        }
      : null
  }

  if (phase === 'steps' && roundRow?.id) {
    const { data: progressRows } = await supabase
      .from('match_round_player_progress_v1')
      .select('player_id, current_step_index, current_segment, current_sub_step_index, segment_ends_at, completed_at')
      .eq('match_id', matchId)
      .eq('round_id', roundRow.id)

    ;(progressRows ?? []).forEach((row: any) => {
      const next: PlayerSnapshot = {
        id: row.player_id,
        answered: false,
        completed: !!row.completed_at,
        currentStepIndex: Number.isFinite(row.current_step_index) ? Number(row.current_step_index) : 0,
        currentSegment: row.current_segment === 'sub' ? 'sub' : 'main',
        currentSubStepIndex: Number.isFinite(row.current_sub_step_index)
          ? Number(row.current_sub_step_index)
          : 0,
        segmentEndsAt: row.segment_ends_at ? String(row.segment_ends_at) : null
      }
      if (players.p1?.id === row.player_id) players.p1 = next
      if (players.p2?.id === row.player_id) players.p2 = next
    })
  }

  const resultsPayload =
    matchRow.results_payload && matchRow.results_round_id === matchRow.current_round_id
      ? matchRow.results_payload
      : null

  const matchOver = !!matchRow.winner_id || matchRow.status === 'finished' || matchRow.status === 'completed'
  const matchWinnerId = matchRow.winner_id ?? null

  return {
    type: 'STATE_SNAPSHOT',
    protocolVersion: PROTOCOL_VERSION,
    serverTime: new Date().toISOString(),
    matchId,
    roundId: roundRow?.id ?? null,
    roundNumber: Number(matchRow.current_round_number || 0),
    targetRoundsToWin: Number(matchRow.target_rounds_to_win || 0),
    phase,
    phaseSeq,
    stateVersion,
    endsAt,
    question,
    totalSteps,
    players,
    playerRoundWins,
    resultsPayload,
    resultsVersion: matchRow.results_version ?? null,
    matchOver,
    matchWinnerId
  }
}

async function sendSnapshotToSocket(
  matchId: string,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const snapshot = await buildStateSnapshot(matchId, supabase)
  if (!snapshot) return
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(snapshot))
}

async function broadcastSnapshotToMatch(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) return
  const snapshot = await buildStateSnapshot(matchId, supabase)
  if (!snapshot) return
  matchSockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(snapshot))
      } catch (err) {
        console.error(`[${matchId}] ❌ Error sending STATE_SNAPSHOT:`, err)
      }
    }
  })
}

async function attemptPhaseAdvance(
  matchId: string,
  supabase: ReturnType<typeof createClient>,
  options?: { forceSnapshot?: boolean }
): Promise<void> {
  const { data: matchRow } = await supabase
    .from('matches')
    .select('id, winner_id, current_round_id, status')
    .eq('id', matchId)
    .single()

  if (!matchRow?.current_round_id) return

  const { data: roundRow } = await supabase
    .from('match_rounds')
    .select('id, phase, phase_seq, ends_at')
    .eq('id', matchRow.current_round_id)
    .single()

  if (!roundRow) return

  const { data: advanceResult, error: advanceError } = await supabase.rpc('advance_round_phase_v1', {
    p_match_id: matchId,
    p_round_id: roundRow.id,
    p_expected_phase_seq: roundRow.phase_seq,
    p_client_seen_at: new Date().toISOString()
  })

  if (advanceError) {
    console.warn(`[${matchId}] ⚠️ advance_round_phase_v1 error`, advanceError)
    return
  }

  if (advanceResult?.advanced) {
    const updateEvent: PhaseUpdateEvent = {
      type: 'PHASE_UPDATE',
      protocolVersion: PROTOCOL_VERSION,
      serverTime: new Date().toISOString(),
      matchId,
      roundId: roundRow.id,
      phase: advanceResult.phase,
      phaseSeq: advanceResult.phase_seq,
      endsAt: advanceResult.ends_at ?? null
    }
    broadcastToMatch(matchId, updateEvent)
    await broadcastSnapshotToMatch(matchId, supabase)

    if (advanceResult.phase === 'steps') {
      ensureAsyncProgressSweep(matchId, supabase)
    }

    if (advanceResult.phase === 'done') {
      if (!matchRow.winner_id && matchRow.status === 'in_progress') {
        await selectAndBroadcastQuestion(matchId, supabase)
      }
    }
    return
  }

  if (advanceResult?.error === 'phase_seq_mismatch') {
    await broadcastSnapshotToMatch(matchId, supabase)
    return
  }

  if (options?.forceSnapshot) {
    await broadcastSnapshotToMatch(matchId, supabase)
  }
}

function ensurePhaseScheduler(matchId: string, supabase: ReturnType<typeof createClient>): void {
  if (phaseSchedulers.has(matchId)) return
  const intervalId = setInterval(() => {
    attemptPhaseAdvance(matchId, supabase).catch((err) => {
      console.warn(`[${matchId}] ⚠️ Phase scheduler tick failed:`, err)
    })
  }, 1000) as unknown as number
  phaseSchedulers.set(matchId, intervalId)
}

function clearPhaseScheduler(matchId: string): void {
  const intervalId = phaseSchedulers.get(matchId)
  if (intervalId) {
    clearInterval(intervalId)
    phaseSchedulers.delete(matchId)
  }
}

/**
 * Check if both players are connected using DATABASE (works across instances)
 * and broadcast BOTH_CONNECTED to all local sockets if so
 */
/**
 * Broadcast a question to all connected players in a match
 * Handles both multi-step and single-step questions
 */
async function broadcastQuestion(
  matchId: string,
  questionDb: any,
  supabase: ReturnType<typeof createClient>,
  roundId?: string
): Promise<void> {
  const matchSockets = sockets.get(matchId)
  if (!matchSockets || matchSockets.size === 0) {
    console.warn(`[${matchId}] ⚠️ [WS] No sockets found for match - cannot broadcast question`)
    return
  }
  
  console.log(`[${matchId}] ✅ [WS] Found ${matchSockets.size} socket(s) for match`)

  // Parse steps to check if multi-step
  let steps: any[] = []
  try {
    steps = Array.isArray(questionDb.steps) ? questionDb.steps : JSON.parse(questionDb.steps ?? '[]')
  } catch {
    steps = []
  }

  const isMultiStep = Array.isArray(steps) && steps.length >= 2

  // Get match players + target rounds for game state
  const { data: matchData } = await supabase
    .from('matches')
    .select('player1_id, player2_id, target_rounds_to_win')
    .eq('id', matchId)
    .single()

  if (isMultiStep) {
    // Multi-step question flow
    console.log(`[${matchId}] 📚 Multi-step question detected (${steps.length} steps)`)
    
    // Get or initialize match-level state
    let matchState = matchStates.get(matchId)
    if (!matchState) {
      // First round - initialize match state
      matchState = {
        roundNumber: 1,
        targetRoundsToWin: matchData?.target_rounds_to_win || 3,
        playerRoundWins: new Map(),
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null,
        p1ResultsAcknowledged: false,
        p2ResultsAcknowledged: false,
        roundTransitionInProgress: false
      }
      matchStates.set(matchId, matchState)
    } else {
      // New round - increment round number and reset readiness
      matchState.roundNumber = (matchState.roundNumber || 0) + 1
      matchState.p1ResultsAcknowledged = false
      matchState.p2ResultsAcknowledged = false
      matchState.roundTransitionInProgress = false
    }

    // Initialize or reset game state for this round
    let gameState = gameStates.get(matchId)
    if (!gameState) {
      gameState = {
        currentPhase: 'main_question',
        currentStepIndex: 0,
        currentSegment: 'main',
        currentSubStepIndex: 0,
        mainQuestionTimer: null,
        segmentTimer: null,
        mainQuestionEndsAt: null,
        stepEndsAt: null,
        playerStepAnswers: new Map(),
        playerSubStepAnswers: new Map(),
        currentQuestion: questionDb,
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null,
        eliminatedPlayers: new Set(),
        roundNumber: matchState.roundNumber,
        targetRoundsToWin: matchState.targetRoundsToWin,
        playerRoundWins: new Map(matchState.playerRoundWins), // Copy match-level wins
        p1AllStepsComplete: false,
        p2AllStepsComplete: false
      }
      gameStates.set(matchId, gameState)
    } else {
      // New round - reset per-round state but keep match state
      gameState.currentPhase = 'main_question'
      gameState.currentStepIndex = 0
      gameState.currentSegment = 'main'
      gameState.currentSubStepIndex = 0
      gameState.mainQuestionTimer = null
      if (gameState.segmentTimer) {
        clearTimeout(gameState.segmentTimer)
      }
      gameState.segmentTimer = null
      gameState.mainQuestionEndsAt = null
      gameState.stepEndsAt = null
      gameState.playerStepAnswers.clear()
      gameState.playerSubStepAnswers.clear()
      gameState.currentQuestion = questionDb
      gameState.eliminatedPlayers.clear()
      gameState.roundNumber = matchState.roundNumber
      gameState.targetRoundsToWin = matchState.targetRoundsToWin
      gameState.playerRoundWins = new Map(matchState.playerRoundWins) // Sync with match state
      gameState.p1AllStepsComplete = false
      gameState.p2AllStepsComplete = false
    }

    // Read main question timer from metadata or default to 180 seconds (clamped 5–600)
    const rawMainTimer = (questionDb as any)?.main_question_timer_seconds
    let mainQuestionTimerSeconds =
      typeof rawMainTimer === 'number' && Number.isFinite(rawMainTimer)
        ? rawMainTimer
        : Number.parseInt(String(rawMainTimer ?? 180), 10)

    if (!Number.isFinite(mainQuestionTimerSeconds)) {
      mainQuestionTimerSeconds = 180
    }

    mainQuestionTimerSeconds = Math.floor(mainQuestionTimerSeconds)

    if (mainQuestionTimerSeconds < 5 || mainQuestionTimerSeconds > 600) {
      console.warn(
        `[${matchId}] ⚠️ main_question_timer_seconds out of range (${rawMainTimer}). Clamping to 5–600.`
      )
      mainQuestionTimerSeconds = Math.max(5, Math.min(600, mainQuestionTimerSeconds))
    }
    const mainQuestionEndsAt = new Date(Date.now() + mainQuestionTimerSeconds * 1000).toISOString()
    gameState.mainQuestionEndsAt = mainQuestionEndsAt

    // Get round number from match state
    const currentMatchState = matchStates.get(matchId)
    const currentRoundNumber = currentMatchState?.roundNumber || 1

    const roundStartEvent: RoundStartEvent = {
      type: 'ROUND_START',
      matchId,
      // Use canonical match_rounds.id if provided; fallback to matchId only if absent
      roundId: roundId ?? matchId,
      roundIndex: currentRoundNumber - 1, // roundIndex is 0-based
      phase: 'main_question',
      question: {
        id: questionDb.id,
        title: questionDb.title,
        subject: questionDb.subject,
        chapter: questionDb.chapter,
        level: questionDb.level,
        difficulty: questionDb.difficulty,
        questionText: questionDb.question_text || questionDb.stem || '',
        stem: questionDb.question_text || questionDb.stem || questionDb.title,
        imageUrl: questionDb.image_url || undefined,
        graph: questionDb.graph || undefined,
        totalMarks: questionDb.total_marks || 0,
        steps: steps.map((s: any) => ({
          id: s.id || '',
          question: s.prompt || s.question || '',
          prompt: s.prompt || s.question || '',
          options: Array.isArray(s.options) ? s.options : [],
          correctAnswer: s.correct_answer?.correctIndex ?? s.correctAnswer ?? 0,
          marks: s.marks || 0,
          explanation: s.explanation || undefined
        })),
        topicTags: questionDb.topic_tags || [],
        rankTier: questionDb.rank_tier || undefined
      },
      mainQuestionEndsAt,
      mainQuestionTimerSeconds,
      totalSteps: steps.length
    }

    console.log(`[${matchId}] 📤 [WS] Broadcasting multi-step ROUND_START`, {
      questionId: questionDb.id,
      totalSteps: steps.length
    })
    broadcastToMatch(matchId, roundStartEvent)
    console.log(`[${matchId}] ✅ [WS] ROUND_START broadcast completed`)

    // Start main question timer
    const mainTimerId = setTimeout(() => {
      transitionToSteps(matchId, supabase)
    }, mainQuestionTimerSeconds * 1000) as unknown as number
    
    gameState.mainQuestionTimer = mainTimerId
    console.log(`[${matchId}] ⏰ Started main question timer (${mainQuestionTimerSeconds}s)`)
  } else {
    // Single-step question - use existing flow
    console.log(`[${matchId}] 📝 Single-step question - using existing flow`)
    
    // Initialize or get match state for single-step questions
    // Don't increment round number here - it will be incremented after results
    let matchState = matchStates.get(matchId)
    if (!matchState) {
      // First round - initialize match state
      matchState = {
        roundNumber: 1,
        targetRoundsToWin: matchData?.target_rounds_to_win || 3,
        playerRoundWins: new Map(),
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null,
        p1ResultsAcknowledged: false,
        p2ResultsAcknowledged: false,
        roundTransitionInProgress: false
      }
      matchStates.set(matchId, matchState)
    }
    
    // Clear any existing game state (multi-step state)
    cleanupGameState(matchId)

    // Timeout for answer submission (single-step): prefer per-step timer if present
    const DEFAULT_TIMEOUT_SECONDS = 60

    const firstStep = Array.isArray(steps) ? steps[0] : null
    const stepSecondsRaw = firstStep?.timeLimitSeconds ?? firstStep?.time_limit_seconds
    const stepSeconds = Number(stepSecondsRaw)

    const TIMEOUT_SECONDS =
      Number.isFinite(stepSeconds) && stepSeconds > 0
        ? Math.floor(stepSeconds)
        : DEFAULT_TIMEOUT_SECONDS
    
    // Calculate timer end time (from TIMEOUT_SECONDS)
    const timerEndAt = new Date(Date.now() + TIMEOUT_SECONDS * 1000).toISOString()
    
    const questionReceivedEvent: QuestionReceivedEvent = {
      type: 'QUESTION_RECEIVED',
      question: questionDb, // Send raw DB object
      timer_end_at: timerEndAt
    }
    
    console.log(`[${matchId}] 📤 [WS] Broadcasting single-step question`, {
      questionId: questionDb.id,
      timer_end_at: timerEndAt
    })
    
    let sentCount = 0
    matchSockets.forEach((socket, index) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(questionReceivedEvent))
          sentCount++
          console.log(`[${matchId}] ✅ Sent QUESTION_RECEIVED to socket ${index + 1}`)
        } catch (error) {
          console.error(`[${matchId}] ❌ Error sending QUESTION_RECEIVED to socket ${index + 1}:`, error)
        }
      }
    })
    
    console.log(`[${matchId}] 📊 [WS] QUESTION_RECEIVED sent to ${sentCount}/${matchSockets.size} sockets`)
    console.log(`[${matchId}] ✅ [WS] QUESTION_RECEIVED broadcast completed`)
    
    // Update match status
    await supabase
      .from('matches')
      .update({ status: 'in_progress' })
      .eq('id', matchId)
      .neq('status', 'in_progress')

    console.log(`[${matchId}] ✅ Question selection and broadcast completed!`)

    // Start timeout for answer submission (single-step)
    const timeoutId = setTimeout(async () => {
      console.log(`[${matchId}] ⏰ Timeout triggered after ${TIMEOUT_SECONDS}s`)
      
      const { data: match } = await supabase
        .from('matches')
        .select('player1_answer, player2_answer, results_computed_at')
        .eq('id', matchId)
        .single()
      
      if (!match) {
        console.error(`[${matchId}] ❌ Match not found during timeout`)
        matchTimeouts.delete(matchId)
        return
      }
      
      // If results not computed and one player hasn't answered
      if (!match.results_computed_at && 
          (match.player1_answer == null || match.player2_answer == null)) {
        console.log(`[${matchId}] ⏰ Applying timeout - marking unanswered player as wrong`)
        
        // Try force_timeout_stage3 first (Stage 3), fallback to force_timeout_stage2 (Stage 2)
        let timeoutError = null
        let timeoutResult = null
        
        const { data: stage3Result, error: stage3Error } = await supabase.rpc('force_timeout_stage3', {
          p_match_id: matchId
        })
        
        if (stage3Error) {
          // Check if RPC function doesn't exist (Stage 3 migration not applied)
          if (stage3Error.code === '42883' || stage3Error.message?.includes('does not exist') || stage3Error.message?.includes('function')) {
            console.log(`[${matchId}] ⚠️ force_timeout_stage3 not found - falling back to force_timeout_stage2`)
            const { data: stage2Result, error: stage2Error } = await supabase.rpc('force_timeout_stage2', {
              p_match_id: matchId
            })
            timeoutError = stage2Error
            timeoutResult = stage2Result
          } else {
            timeoutError = stage3Error
            timeoutResult = stage3Result
          }
        } else {
          timeoutResult = stage3Result
        }
        
        if (timeoutError) {
          console.error(`[${matchId}] ❌ Error applying timeout:`, timeoutError)
          matchTimeouts.delete(matchId)
          return
        }
        
        // Fetch and broadcast results after timeout
        const { data: matchResults } = await supabase
          .from('matches')
          .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner')
          .eq('id', matchId)
          .single()
        
        if (matchResults && ENABLE_WS_FASTPATH) {
          const resultsEvent: ResultsReceivedEvent = {
            type: 'RESULTS_RECEIVED',
            player1_answer: matchResults.player1_answer,
            player2_answer: matchResults.player2_answer,
            correct_answer: matchResults.correct_answer,
            player1_correct: matchResults.player1_correct,
            player2_correct: matchResults.player2_correct,
            round_winner: matchResults.round_winner
          }
          broadcastToMatch(matchId, resultsEvent)
        }
      }
      
      matchTimeouts.delete(matchId)
    }, TIMEOUT_SECONDS * 1000) as unknown as number
    
    matchTimeouts.set(matchId, timeoutId)
    console.log(`[${matchId}] ⏰ Started timeout timer (${TIMEOUT_SECONDS}s)`)
  }
}

/**
 * Atomic question selection and broadcast for Stage 1
 * 
 * Ensures both players see the same question by:
 * 1. Checking in-memory GameState.currentQuestion first (idempotent)
 * 2. Checking if question_id already exists (idempotency)
 * 3. Atomically claiming a question using UPDATE ... WHERE question_id IS NULL
 * 4. Filtering for True/False questions (2 options)
 * 5. Broadcasting QUESTION_RECEIVED with raw question object
 */
async function selectAndBroadcastQuestion(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🔒 [WS] selectAndBroadcastQuestion called`)
  
  try {
    // Get match with current_round_id for clearing old results
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('subject, mode, status, winner_id, question_id, question_sent_at, current_round_id, current_round_number, target_rounds_to_win')
      .eq('id', matchId)
      .single()

    if (matchError) {
      console.error(`[${matchId}] ❌ Error fetching match:`, matchError)
      throw matchError
    }

    // Safety checks
    if (!match || match.status !== 'in_progress' || match.winner_id) {
      console.warn(`[${matchId}] ⚠️ [WS] Match not ready for question selection (status: ${match?.status}, winner: ${match?.winner_id})`)
      return
    }
    
    console.log(`[${matchId}] ✅ [WS] Match is ready (status: ${match.status}, winner: ${match.winner_id || 'none'})`)

    // ===== CRITICAL SEQUENCE: Clear old results first =====
    const previousRoundId = match.current_round_id
    if (previousRoundId) {
      console.log(`[${matchId}] 🧹 Clearing old results for round ${previousRoundId}`)
      const { data: clearResult, error: clearError } = await supabase.rpc('clear_round_results', {
        p_match_id: matchId,
        p_expected_round_id: previousRoundId
      })
      
      if (clearError) {
        console.error(`[${matchId}] ❌ Error clearing round results:`, clearError)
        // Continue anyway - clear might have already been done
      } else if (!clearResult?.success && clearResult?.reason !== 'nothing_to_clear') {
        console.warn(`[${matchId}] ⚠️ Clear round results returned:`, clearResult)
      }
    }

    // Calculate new round number
    const newRoundNumber = (match.current_round_number || 0) + 1
    // If we detect an already-active round created by another instance, we should reuse its round_number
    let roundNumberForUpdate = newRoundNumber

    // Select question (reuse existing logic)
    let questionDb: any = null

    if (match.question_id) {
      // Question already assigned, fetch it
      console.log(`[${matchId}] ✅ Question already assigned: ${match.question_id}`)
      const { data: q, error: fetchError } = await supabase
        .from('questions_v2')
        .select('*')
        .eq('id', match.question_id)
        .single()

      if (fetchError || !q) {
        console.error(`[${matchId}] ❌ Failed to fetch existing question:`, fetchError)
        throw new Error(`Failed to fetch question ${match.question_id}`)
      }
      questionDb = q
      console.log(`[${matchId}] ✅ Fetched existing question: ${questionDb.id} - "${questionDb.title}"`)
    } else {
      // No question assigned, try to claim one atomically with tiered filtering
      console.log(`[${matchId}] 🔍 No question assigned, fetching questions with tiered filtering...`)

      // Avoid repeats within the same match: collect question_ids already used by prior rounds.
      // This is DB-backed so it works across Edge instances.
      const usedQuestionIds = new Set<string>()
      try {
        const { data: usedRows, error: usedErr } = await supabase
          .from('match_rounds')
          .select('question_id')
          .eq('match_id', matchId)

        if (usedErr) {
          console.warn(`[${matchId}] ⚠️ Could not query used match_rounds.question_id list:`, usedErr)
        } else {
          ;(usedRows ?? []).forEach((r: any) => {
            const qid = r?.question_id
            if (typeof qid === 'string' && qid.length > 0) usedQuestionIds.add(qid)
          })
        }
      } catch (err) {
        console.warn(`[${matchId}] ⚠️ Error while collecting usedQuestionIds:`, err)
      }

      const subject = match.subject ?? null
      const level = match.mode ?? null // mode = level (A1/A2)

      // Tiered fetching with early filtering
      const fetchTier = async (filters: { subject?: boolean; level?: boolean }) => {
        let q = supabase
          .from('questions_v2')
          .select('*')
          .eq('is_enabled', true)
          // Prefer newest questions so recently added/edited questions actually show up in-game.
          // Important: nullsFirst=false ensures rows missing updated_at don't float to the top.
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(200)
        
        if (filters.subject && subject) q = q.eq('subject', subject)
        if (filters.level && level) q = q.eq('level', level)
        
        const { data, error } = await q
        
        if (error) {
          console.warn(`[${matchId}] ⚠️ Tier fetch error:`, error)
          return []
        }
        
        return (data ?? []).filter((q: any) => {
          try {
            const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
            return Array.isArray(steps) && steps.length > 0
          } catch {
            return false
          }
        })
      }

      // Filter for valid questions (True/False or MCQ)
      const isValidQuestion = (q: any) => {
        try {
          const steps = Array.isArray(q.steps) ? q.steps : JSON.parse(q.steps ?? '[]')
          if (!Array.isArray(steps) || steps.length === 0) return false
          
          const first = steps[0]
          const opts = first?.options ?? []
          
          // Accept True/False questions (2 options) or MCQ questions (4 options)
          // Filter out invalid questions (0, 1, or >4 options)
          const optionCount = Array.isArray(opts) ? opts.filter((opt: any) => opt && opt.trim()).length : 0
          return optionCount === 2 || optionCount === 4 || first?.type === 'true_false' || first?.type === 'mcq'
        } catch {
          return false
        }
      }

      // Fetch in tiers with proper priority (only fall back if the stricter tier is empty).
      // This also keeps the selection pool small, increasing the chance of new questions appearing.
      const tier1 = (await fetchTier({ subject: true, level: true })).filter(isValidQuestion)
      const tier2 = tier1.length === 0 ? (await fetchTier({ subject: true, level: false })).filter(isValidQuestion) : []
      const tier3 = tier1.length === 0 && tier2.length === 0 ? (await fetchTier({ subject: false, level: true })).filter(isValidQuestion) : []
      const tier4 = tier1.length === 0 && tier2.length === 0 && tier3.length === 0
        ? (await fetchTier({ subject: false, level: false })).filter(isValidQuestion)
        : []

      const questionPool = tier1.length > 0 ? tier1 : tier2.length > 0 ? tier2 : tier3.length > 0 ? tier3 : tier4

      if (questionPool.length === 0) {
        console.error(`[${matchId}] ❌ No valid questions available (need True/False or MCQ questions)`)
        throw new Error('No valid questions available')
      }

      // Avoid repeats within the same match (fallback to repeats if pool exhausted, per product requirement).
      const unusedPool = usedQuestionIds.size > 0
        ? questionPool.filter((q: any) => !usedQuestionIds.has(String(q?.id ?? '')))
        : questionPool

      const selectionPool = unusedPool.length > 0 ? unusedPool : questionPool

      if (unusedPool.length === 0 && usedQuestionIds.size > 0) {
        console.warn(
          `[${matchId}] ⚠️ Unused question pool exhausted (used=${usedQuestionIds.size}, pool=${questionPool.length}). Falling back to allowing repeats.`
        )
      } else {
        console.log(
          `[${matchId}] ✅ No-repeat selection active (used=${usedQuestionIds.size}, pool=${questionPool.length}, unused=${unusedPool.length}).`
        )
      }

      // Bias toward newer questions: pick randomly from the newest N (still randomized, but boosts recency).
      const RECENT_POOL_MAX = 50
      const recentPool = selectionPool.slice(0, Math.min(RECENT_POOL_MAX, selectionPool.length))
      const selectedQuestion = recentPool[Math.floor(Math.random() * recentPool.length)]
      console.log(`[${matchId}] 🎯 Selected question: ${selectedQuestion.id} - "${selectedQuestion.title}"`)

      // Atomic claim: UPDATE only if question_id IS NULL
      const { data: lock, error: lockError } = await supabase
        .from('matches')
        .update({
          question_sent_at: new Date().toISOString(),
          question_id: selectedQuestion.id,
        })
        .eq('id', matchId)
        .is('question_id', null)
        .select('id, question_id')
        .maybeSingle()

      if (lockError) {
        console.error(`[${matchId}] ❌ Lock error:`, lockError)
        throw lockError
      }

      if (!lock) {
        // Lost race condition
        console.log(`[${matchId}] ⚠️ Lost atomic lock, re-reading question_id...`)
        
        const { data: matchAfterRace } = await supabase
          .from('matches')
          .select('question_id, question_sent_at')
          .eq('id', matchId)
          .single()

        if (!matchAfterRace?.question_id) {
          throw new Error('Failed to claim question and no question found after race')
        }

        const { data: qAfterRace } = await supabase
          .from('questions_v2')
          .select('*')
          .eq('id', matchAfterRace.question_id)
          .single()

        if (!qAfterRace) {
          throw new Error(`Failed to fetch question ${matchAfterRace.question_id} after race`)
        }

        questionDb = qAfterRace
        console.log(`[${matchId}] ✅ Using question claimed by other instance: ${questionDb.id}`)
      } else {
        questionDb = selectedQuestion
        console.log(`[${matchId}] ✅ Won atomic lock, claimed question: ${questionDb.id}`)
      }
    }

    // ===== Create or reuse match_rounds row with question_id (idempotent across Edge instances) =====
    let newRound: any = null

    // IDEMPOTENCY: another instance may have already created an active round (status main/steps)
    const { data: existingRound, error: existingRoundError } = await supabase
      .from('match_rounds')
      .select('id, question_id, round_number, status, phase, phase_seq, ends_at')
      .eq('match_id', matchId)
      .in('status', ['main', 'steps', 'results'])
      .maybeSingle()

    if (existingRoundError) {
      // This shouldn't normally happen; log and continue with insert path
      console.warn(`[${matchId}] ⚠️ Error checking existing round:`, existingRoundError)
    }

    const reusedExistingRound = !!existingRound
    const existingRoundPhase = existingRound?.phase
    const existingRoundPhaseSeq = existingRound?.phase_seq
    if (existingRound) {
      console.log(`[${matchId}] ✅ Round already exists: ${existingRound.id}, reusing...`)
      newRound = { id: existingRound.id }
      if (typeof existingRound.round_number === 'number') {
        roundNumberForUpdate = existingRound.round_number
      }

      // Treat existing round as authoritative if question_id differs (keep both clients in sync)
      if (existingRound.question_id && existingRound.question_id !== questionDb.id) {
        console.warn(
          `[${matchId}] ⚠️ Existing round has different question_id (${existingRound.question_id}); re-fetching question to stay consistent`
        )
        const { data: existingQuestion, error: existingQuestionError } = await supabase
          .from('questions_v2')
          .select('*')
          .eq('id', existingRound.question_id)
          .single()

        if (existingQuestionError || !existingQuestion) {
          console.error(`[${matchId}] ❌ Failed to fetch existing round question:`, existingQuestionError)
        } else {
          questionDb = existingQuestion
        }
      }
    } else {
      // ===== Create new match_rounds row with question_id (single source of truth) =====
      const { data: insertedRound, error: roundError } = await supabase
        .from('match_rounds')
        .insert({
          match_id: matchId,
          question_id: questionDb.id, // Single source of truth for question
          round_number: newRoundNumber,
          status: 'main' // For simple questions, will transition to 'results' when computed
        })
        .select('id')
        .single()

      if (roundError || !insertedRound) {
        // Handle unique constraint violation gracefully (another instance created the round)
        if (
          roundError?.code === '23505' ||
          roundError?.message?.includes('unique') ||
          roundError?.message?.includes('duplicate')
        ) {
          console.log(
            `[${matchId}] ⚠️ Round insert hit unique constraint; another instance created it. Fetching existing...`
          )

          const { data: fetchedRound, error: fetchedRoundError } = await supabase
            .from('match_rounds')
            .select('id, question_id, round_number, status, phase, phase_seq, ends_at')
            .eq('match_id', matchId)
            .in('status', ['main', 'steps', 'results'])
            .maybeSingle()

          if (fetchedRoundError) {
            console.error(`[${matchId}] ❌ Error fetching existing round after constraint violation:`, fetchedRoundError)
            throw fetchedRoundError
          }

          if (!fetchedRound) {
            console.error(`[${matchId}] ❌ Failed to find round after constraint violation`)
            throw new Error('Failed to create or find match_rounds row')
          }

          console.log(`[${matchId}] ✅ Found round created by other instance: ${fetchedRound.id}`)
          newRound = { id: fetchedRound.id }
          if (typeof fetchedRound.round_number === 'number') {
            roundNumberForUpdate = fetchedRound.round_number
          }

          // Align questionDb with the fetched round if needed
          if (fetchedRound.question_id && fetchedRound.question_id !== questionDb.id) {
            const { data: fetchedQuestion, error: fetchedQuestionError } = await supabase
              .from('questions_v2')
              .select('*')
              .eq('id', fetchedRound.question_id)
              .single()

            if (fetchedQuestionError || !fetchedQuestion) {
              console.error(`[${matchId}] ❌ Failed to fetch question for existing round:`, fetchedQuestionError)
            } else {
              questionDb = fetchedQuestion
            }
          }
        } else {
          console.error(`[${matchId}] ❌ Failed to create match_rounds row:`, roundError)
          throw roundError || new Error('Failed to create match_rounds row')
        }
      } else {
        newRound = insertedRound
        console.log(`[${matchId}] ✅ Created match_rounds row: ${newRound.id} for round ${roundNumberForUpdate}`)
      }
    }

    if (!newRound?.id) {
      throw new Error('Failed to obtain round ID')
    }

    // ===== Update matches with current_round_id and current_round_number =====
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        current_round_id: newRound.id,
        current_round_number: roundNumberForUpdate,
        // Keep question_id for backwards compatibility, but we read from match_rounds.question_id
        question_id: questionDb.id
      })
      .eq('id', matchId)

    if (updateError) {
      console.error(`[${matchId}] ❌ Failed to update matches with round info:`, updateError)
      throw updateError
    }

    console.log(`[${matchId}] ✅ Updated matches.current_round_id = ${newRound.id}, current_round_number = ${roundNumberForUpdate}`)

    // After obtaining questionDb, set it in gameState for idempotency
    const existingGameState = gameStates.get(matchId)
    if (existingGameState) {
      existingGameState.currentQuestion = questionDb
      existingGameState.roundNumber = roundNumberForUpdate
    } else {
      // Get match players for game state initialization
      const { data: matchData } = await supabase
        .from('matches')
        .select('player1_id, player2_id')
        .eq('id', matchId)
        .single()
      
      const newGameState: GameState = {
        currentPhase: 'question',
        currentStepIndex: 0,
        currentSegment: 'main',
        currentSubStepIndex: 0,
        mainQuestionTimer: null,
        segmentTimer: null,
        mainQuestionEndsAt: null,
        stepEndsAt: null,
        playerStepAnswers: new Map(),
        playerSubStepAnswers: new Map(),
        currentQuestion: questionDb,
        p1Id: matchData?.player1_id || null,
        p2Id: matchData?.player2_id || null,
        eliminatedPlayers: new Set(),
        roundNumber: roundNumberForUpdate,
        targetRoundsToWin: match.target_rounds_to_win || 3,
        playerRoundWins: new Map(),
        p1AllStepsComplete: false,
        p2AllStepsComplete: false
      }
      gameStates.set(matchId, newGameState)
    }
    
    // Initialize phase/timer for the round if this is a fresh round (or missing phase fields).
    const shouldInitPhase = !reusedExistingRound || !existingRoundPhase || !Number.isFinite(existingRoundPhaseSeq)
    if (shouldInitPhase) {
      let steps: any[] = []
      try {
        steps = Array.isArray(questionDb.steps) ? questionDb.steps : JSON.parse(questionDb.steps ?? '[]')
      } catch {
        steps = []
      }
      const firstStep = Array.isArray(steps) ? steps[0] : null
      const fallbackMainSeconds = Array.isArray(steps) && steps.length > 1 ? 15 : 60
      const rawMainTimer = (questionDb as any)?.main_question_timer_seconds
      const stepSecondsRaw = firstStep?.timeLimitSeconds ?? firstStep?.time_limit_seconds
      let mainSeconds =
        (Number.isFinite(Number(rawMainTimer)) ? Number(rawMainTimer) : Number(stepSecondsRaw)) ||
        fallbackMainSeconds
      if (!Number.isFinite(mainSeconds)) mainSeconds = fallbackMainSeconds
      mainSeconds = Math.max(5, Math.min(600, Math.floor(mainSeconds)))

      const mainQuestionEndsAt = new Date(Date.now() + mainSeconds * 1000).toISOString()
      await supabase
        .from('match_rounds')
        .update({
          phase: 'main',
          phase_seq: 0,
          phase_started_at: new Date().toISOString(),
          ends_at: mainQuestionEndsAt,
          main_question_ends_at: mainQuestionEndsAt,
          status: 'main',
          current_step_index: 0,
          step_ends_at: null
        })
        .eq('id', newRound.id)
    }

    console.log(`[${matchId}] ✅ Selected new question from DB: ${questionDb.id}`)
    await broadcastSnapshotToMatch(matchId, supabase)
  } catch (error) {
    console.error(`[${matchId}] ❌ Error in atomic question selection:`, error)
    
    // Send error to all sockets
    const matchSockets = sockets.get(matchId)
    if (matchSockets) {
      const errorEvent: GameErrorEvent = {
        type: 'GAME_ERROR',
        message: 'Failed to select question'
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
 * Cleanup game state for a match
 */
function cleanupGameState(matchId: string): void {
  // Clear any async progress sweep interval for this match (per-instance)
  clearAsyncProgressSweep(matchId)
  clearPhaseScheduler(matchId)

  const state = gameStates.get(matchId)
  if (state) {
    if (state.mainQuestionTimer) {
      clearTimeout(state.mainQuestionTimer)
    }
    if (state.segmentTimer) {
      clearTimeout(state.segmentTimer)
    }
    gameStates.delete(matchId)
  }
  // Also cleanup match state if match is over
  matchStates.delete(matchId)
}

// ============================================================================
// Multi-step helpers (steps + nested subSteps)
// ============================================================================
function normalizeSteps(rawSteps: any): any[] {
  try {
    if (Array.isArray(rawSteps)) return rawSteps
    if (typeof rawSteps === 'string') {
      const parsed = JSON.parse(rawSteps)
      return Array.isArray(parsed) ? parsed : []
    }
    return []
  } catch {
    return []
  }
}

function normalizeSubSteps(step: any): any[] {
  if (!step || typeof step !== 'object') return []
  const raw =
    step.subSteps ??
    step.sub_steps ??
    null

  if (Array.isArray(raw)) return raw

  const legacy = step.subStep ?? step.sub_step ?? null
  if (legacy && typeof legacy === 'object') return [legacy]
  return []
}

function coerceTimeLimitSeconds(raw: any, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function coerceCorrectAnswerIndex(step: any): number {
  const raw = step?.correct_answer?.correctIndex ?? step?.correctAnswer ?? step?.correct_answer
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return 0

  // Variable MCQ options: allow up to 6 options (0-5). Prefer clamping to the
  // actual option array length when available.
  const opts = step?.options
  const hardMax = 5
  const maxIndex = Array.isArray(opts)
    ? Math.max(0, Math.min(hardMax, opts.length - 1))
    : hardMax

  return n <= maxIndex ? n : 0
}

function coercePrompt(step: any): string {
  const p = step?.prompt ?? step?.question ?? ''
  return typeof p === 'string' ? p : String(p ?? '')
}

function coerceOptions(step: any): string[] {
  const opts = step?.options
  if (!Array.isArray(opts)) return []
  return opts.map((o: any) => (o ?? '').toString())
}

/**
 * Transition from main question phase to steps phase
 */
async function transitionToSteps(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const state = gameStates.get(matchId)
  if (!state || state.currentPhase !== 'main_question') {
    console.warn(`[${matchId}] ⚠️ Cannot transition to steps - invalid state`)
    return
  }

  // Clear main question timer
  if (state.mainQuestionTimer) {
    clearTimeout(state.mainQuestionTimer)
    state.mainQuestionTimer = null
  }

  state.currentPhase = 'steps'
  state.currentStepIndex = 0
  state.currentSegment = 'main'
  state.currentSubStepIndex = 0
  // Reset eliminated players for new round (should already be clear, but ensure it)
  state.eliminatedPlayers.clear()
  // Reset step completion flags
  state.p1AllStepsComplete = false
  state.p2AllStepsComplete = false

  const steps = Array.isArray(state.currentQuestion.steps) 
    ? state.currentQuestion.steps 
    : JSON.parse(state.currentQuestion.steps ?? '[]')
  
  if (steps.length === 0) {
    console.error(`[${matchId}] ❌ No steps found`)
    return
  }

  const currentStep = steps[0]
  const stepSecondsRaw = currentStep?.timeLimitSeconds ?? currentStep?.time_limit_seconds
  const stepSeconds = (typeof stepSecondsRaw === 'number' && stepSecondsRaw > 0) ? stepSecondsRaw : 15
  const stepEndsAt = new Date(Date.now() + stepSeconds * 1000).toISOString()
  state.stepEndsAt = stepEndsAt

  // Prefer DB-driven per-player async step progression if available.
  // This is what enables "answer → advance immediately" without waiting for the opponent/timer.
  try {
    const { data: matchRow, error: matchError } = await supabase
      .from('matches')
      .select('current_round_id, player1_id, player2_id')
      .eq('id', matchId)
      .single()

    if (!matchError && matchRow?.current_round_id) {
      const roundId = matchRow.current_round_id as string

      const { error: initError } = await supabase.rpc('init_round_progress_v1', {
        p_match_id: matchId,
        p_round_id: roundId
      })

      if (!initError) {
        // If init placed players in main-question sentinel (-1), advance them into step 0 now.
        const playerIds = [matchRow.player1_id, matchRow.player2_id].filter(Boolean) as string[]
        if (playerIds.length > 0) {
          const { error: progressUpdateError } = await supabase
            .from('match_round_player_progress_v1')
            .update({
              current_step_index: 0,
              current_segment: 'main',
              segment_ends_at: stepEndsAt,
              updated_at: new Date().toISOString()
            })
            .eq('match_id', matchId)
            .eq('round_id', roundId)
            .in('player_id', playerIds)
            .lt('current_step_index', 0)

          if (progressUpdateError) {
            console.warn(`[${matchId}] ⚠️ Failed to advance progress from main-question sentinel:`, progressUpdateError)
          }
        }

        state.progressMode = 'async'
        ensureAsyncProgressSweep(matchId, supabase)

        const asyncPhaseChangeEvent: PhaseChangeEvent = {
          type: 'PHASE_CHANGE',
          matchId,
          phase: 'steps',
          stepIndex: 0,
          segment: 'main',
          subStepIndex: 0,
          totalSteps: steps.length,
          stepEndsAt,
          progressMode: 'async',
          currentStep: {
            id: currentStep.id || '',
            prompt: currentStep.prompt || currentStep.question || '',
            options: Array.isArray(currentStep.options) ? currentStep.options : [],
            correctAnswer: currentStep.correct_answer?.correctIndex ?? currentStep.correctAnswer ?? 0,
            marks: currentStep.marks || 0
          }
        }

        // Step 0 is shared at the start; broadcast is fine. Subsequent segments are per-player.
        broadcastToMatch(matchId, asyncPhaseChangeEvent)

        // Prime dedupe keys (avoid immediate sweep re-sending step 0)
        const initialKey = `0|main|0|${new Date(stepEndsAt).toISOString()}|`
        if (matchRow.player1_id) setLastAsyncProgressKey(matchId, matchRow.player1_id, initialKey)
        if (matchRow.player2_id) setLastAsyncProgressKey(matchId, matchRow.player2_id, initialKey)
        setLastAsyncProgressKey(matchId, '__completion__', 'false|false')
        return
      } else {
        console.warn(`[${matchId}] ⚠️ init_round_progress_v1 not available; falling back to legacy shared step progression`, initError)
      }
    } else if (matchError) {
      console.warn(`[${matchId}] ⚠️ Could not query matches.current_round_id for async progression`, matchError)
    }
  } catch (err) {
    console.warn(`[${matchId}] ⚠️ Async step init error; falling back to legacy`, err)
  }

  const phaseChangeEvent: PhaseChangeEvent = {
    type: 'PHASE_CHANGE',
    matchId,
    phase: 'steps',
    stepIndex: 0,
    segment: 'main',
    subStepIndex: 0,
    totalSteps: steps.length,
    stepEndsAt,
    currentStep: {
      id: currentStep.id || '',
      prompt: currentStep.prompt || currentStep.question || '',
      options: Array.isArray(currentStep.options) ? currentStep.options : [],
      correctAnswer: currentStep.correct_answer?.correctIndex ?? currentStep.correctAnswer ?? 0,
      marks: currentStep.marks || 0
    }
  }

  broadcastToMatch(matchId, phaseChangeEvent)

  // Start segment timer
  if (state.segmentTimer) {
    clearTimeout(state.segmentTimer)
  }
  const segmentTimerId = setTimeout(() => {
    checkStepTimeout(matchId, 0, 'main', 0, supabase)
  }, stepSeconds * 1000) as unknown as number
  state.segmentTimer = segmentTimerId
  console.log(`[${matchId}] ⏰ Started step 0 main timer (${stepSeconds}s)`)
}

/**
 * Check for segment timeout (main or sub) and advance the match state.
 * Timeout is treated as "no answer" (null) for that segment.
 */
async function checkStepTimeout(
  matchId: string,
  stepIndex: number,
  segment: 'main' | 'sub',
  subStepIndex: number,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const state = gameStates.get(matchId)
  if (!state || state.currentPhase !== 'steps') {
    return
  }
  if (
    state.currentStepIndex !== stepIndex ||
    state.currentSegment !== segment ||
    state.currentSubStepIndex !== subStepIndex
  ) {
    // Stale timeout from an older segment
    return
  }

  const steps = normalizeSteps(state.currentQuestion.steps)
  const currentStep = steps[stepIndex]
  const subSteps = normalizeSubSteps(currentStep)

  const roundIndex = Math.max(0, (state.roundNumber || 1) - 1)

  const ensureMaps = (playerId: string) => {
    if (!state.playerStepAnswers.has(playerId)) state.playerStepAnswers.set(playerId, new Map())
    if (!state.playerSubStepAnswers.has(playerId)) state.playerSubStepAnswers.set(playerId, new Map())
  }

  const hasMain = (playerId: string) => (state.playerStepAnswers.get(playerId) || new Map()).has(stepIndex)
  const hasSub = (playerId: string) => {
    const perPlayer = state.playerSubStepAnswers.get(playerId)
    const perStep = perPlayer?.get(stepIndex)
    return !!perStep?.has(subStepIndex)
  }

  const players = [state.p1Id, state.p2Id].filter(Boolean) as string[]
  for (const pid of players) {
    ensureMaps(pid)

    const alreadyAnswered = segment === 'main' ? hasMain(pid) : hasSub(pid)
    if (alreadyAnswered) continue

    // Record timeout as null answer (incorrect)
    if (segment === 'main') {
      state.playerStepAnswers.get(pid)!.set(stepIndex, null)
    } else {
      const perPlayer = state.playerSubStepAnswers.get(pid)!
      if (!perPlayer.has(stepIndex)) perPlayer.set(stepIndex, new Map())
      perPlayer.get(stepIndex)!.set(subStepIndex, null)
    }

    // Persist (best-effort) for cross-instance visibility
    try {
      supabase
        .from('match_step_answers_v2')
        .upsert({
          match_id: matchId,
          round_index: roundIndex,
          question_id: state.currentQuestion?.id ?? '',
          player_id: pid,
          step_index: stepIndex,
          segment: segment,
          sub_step_index: segment === 'sub' ? subStepIndex : 0,
          selected_option: null,
          is_correct: false,
          response_time_ms: 0
        }, {
          onConflict: 'match_id,round_index,player_id,question_id,step_index,segment,sub_step_index'
        })
        .then(({ error }) => {
          if (error) {
            console.error(`[${matchId}] ❌ [TIMEOUT] DB upsert error for step ${stepIndex} ${segment}${segment === 'sub' ? `#${subStepIndex}` : ''}:`, error)
          }
        })
        .catch(() => {})
    } catch {
      // ignore
    }
  }

  // Advance to next segment/step (or results)
  await moveToNextStep(matchId, supabase, null)
}

/**
 * Move to next step or calculate results
 * @param playerId - Optional player ID who triggered this (for completion tracking)
 */
async function moveToNextStep(
  matchId: string,
  supabase: ReturnType<typeof createClient>,
  playerId: string | null = null
): Promise<void> {
  const state = gameStates.get(matchId)
  if (!state || state.currentPhase !== 'steps') {
    console.warn(`[${matchId}] ⚠️ Cannot move to next step - invalid state`)
    return
  }

  // Clear current segment timer
  if (state.segmentTimer) {
    clearTimeout(state.segmentTimer)
    state.segmentTimer = null
  }

  const steps = normalizeSteps(state.currentQuestion.steps)
  if (steps.length === 0) {
    console.error(`[${matchId}] ❌ No steps found during moveToNextStep`)
    return
  }

  const currentMainStep = steps[state.currentStepIndex]
  const currentSubSteps = normalizeSubSteps(currentMainStep)

  let nextStepIndex = state.currentStepIndex
  let nextSegment: 'main' | 'sub' = 'main'
  let nextSubStepIndex = 0

  if (state.currentSegment === 'main') {
    if (currentSubSteps.length > 0) {
      nextSegment = 'sub'
      nextSubStepIndex = 0
    } else {
      nextStepIndex = state.currentStepIndex + 1
      nextSegment = 'main'
      nextSubStepIndex = 0
    }
  } else {
    // segment === 'sub'
    if (currentSubSteps.length > 0 && (state.currentSubStepIndex + 1) < currentSubSteps.length) {
      nextSegment = 'sub'
      nextSubStepIndex = state.currentSubStepIndex + 1
    } else {
      nextStepIndex = state.currentStepIndex + 1
      nextSegment = 'main'
      nextSubStepIndex = 0
    }
  }

  // Completed all steps/segments
  if (nextStepIndex >= steps.length) {
    console.log(`[${matchId}] ✅ All steps complete - calculating results`)
    await calculateStepResults(matchId, supabase)
    return
  }

  // Update state to new segment
  state.currentStepIndex = nextStepIndex
  state.currentSegment = nextSegment
  state.currentSubStepIndex = nextSubStepIndex

  const mainStep = steps[nextStepIndex]
  const subSteps = normalizeSubSteps(mainStep)
  const segmentStep = nextSegment === 'main' ? mainStep : subSteps[nextSubStepIndex]

  const seconds = nextSegment === 'main'
    ? coerceTimeLimitSeconds(segmentStep?.timeLimitSeconds ?? segmentStep?.time_limit_seconds, 15)
    : coerceTimeLimitSeconds(segmentStep?.timeLimitSeconds ?? segmentStep?.time_limit_seconds, 5)

  const stepEndsAt = new Date(Date.now() + seconds * 1000).toISOString()
  state.stepEndsAt = stepEndsAt

  const phaseChangeEvent: PhaseChangeEvent = {
    type: 'PHASE_CHANGE',
    matchId,
    phase: 'steps',
    stepIndex: nextStepIndex,
    segment: nextSegment,
    subStepIndex: nextSubStepIndex,
    totalSteps: steps.length,
    stepEndsAt,
    currentStep: {
      id: segmentStep?.id || '',
      prompt: coercePrompt(segmentStep),
      options: coerceOptions(segmentStep),
      correctAnswer: coerceCorrectAnswerIndex(segmentStep),
      // Show the main step marks (sub-steps don't award marks themselves)
      marks: mainStep?.marks || 0
    }
  }

  broadcastToMatch(matchId, phaseChangeEvent)

  // Start timer for next segment
  const timerId = setTimeout(() => {
    checkStepTimeout(matchId, nextStepIndex, nextSegment, nextSubStepIndex, supabase)
  }, seconds * 1000) as unknown as number

  state.segmentTimer = timerId
  console.log(`[${matchId}] ⏰ Started step ${nextStepIndex} ${nextSegment}${nextSegment === 'sub' ? `#${nextSubStepIndex}` : ''} timer (${seconds}s)`)
}

/**
 * Calculate results for all steps
 */
async function calculateStepResults(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] *** calculateStepResults CALLED ***`)
  const state = gameStates.get(matchId)
  if (!state) {
    console.error(`[${matchId}] *** ERROR: Cannot calculate results - no game state ***`)
    return
  }

  // Clear current segment timer
  if (state.segmentTimer) {
    clearTimeout(state.segmentTimer)
    state.segmentTimer = null
  }

  const steps = normalizeSteps(state.currentQuestion.steps)
  
  const p1Answers = state.playerStepAnswers.get(state.p1Id || '') || new Map()
  const p2Answers = state.playerStepAnswers.get(state.p2Id || '') || new Map()
  const p1SubAnswers = state.playerSubStepAnswers.get(state.p1Id || '') || new Map()
  const p2SubAnswers = state.playerSubStepAnswers.get(state.p2Id || '') || new Map()

  console.log(`[${matchId}] 🔍 calculateStepResults: p1Id=${state.p1Id}, p2Id=${state.p2Id}`)
  console.log(`[${matchId}] 🔍 calculateStepResults: p1Answers.size=${p1Answers.size}, p2Answers.size=${p2Answers.size}`)
  console.log(`[${matchId}] 🔍 calculateStepResults: p1Answers keys=[${Array.from(p1Answers.keys()).join(', ')}], p2Answers keys=[${Array.from(p2Answers.keys()).join(', ')}]`)
  console.log(`[${matchId}] 🔍 calculateStepResults: all stored player IDs=[${Array.from(state.playerStepAnswers.keys()).join(', ')}]`)

  // Format step results for RPC call
  const stepResultsArray: any[] = []

  steps.forEach((step: any, index: number) => {
    const mainCorrectAnswer = coerceCorrectAnswerIndex(step)
    const marks = Number(step?.marks ?? 0) || 0

    const p1MainAnswer = (p1Answers.get(index) ?? null) as number | null
    const p2MainAnswer = (p2Answers.get(index) ?? null) as number | null

    const p1MainCorrect = p1MainAnswer !== null && p1MainAnswer === mainCorrectAnswer
    const p2MainCorrect = p2MainAnswer !== null && p2MainAnswer === mainCorrectAnswer

    const subSteps = normalizeSubSteps(step)
    const hasSubSteps = subSteps.length > 0

    const subCorrectAnswers: number[] = []
    const p1SubAnswerIndices: Array<number | null> = []
    const p2SubAnswerIndices: Array<number | null> = []

    let p1AllSubCorrect = true
    let p2AllSubCorrect = true

    for (let j = 0; j < subSteps.length; j++) {
      const sub = subSteps[j]
      const subCorrect = coerceCorrectAnswerIndex(sub)
      subCorrectAnswers.push(subCorrect)

      const p1Sub = (p1SubAnswers.get(index)?.get(j) ?? null) as number | null
      const p2Sub = (p2SubAnswers.get(index)?.get(j) ?? null) as number | null

      p1SubAnswerIndices.push(p1Sub)
      p2SubAnswerIndices.push(p2Sub)

      if (p1Sub === null || p1Sub !== subCorrect) p1AllSubCorrect = false
      if (p2Sub === null || p2Sub !== subCorrect) p2AllSubCorrect = false
    }

    const p1PartCorrect = p1MainCorrect && (!hasSubSteps || p1AllSubCorrect)
    const p2PartCorrect = p2MainCorrect && (!hasSubSteps || p2AllSubCorrect)

    const p1StepMarks = p1PartCorrect ? marks : 0
    const p2StepMarks = p2PartCorrect ? marks : 0

    stepResultsArray.push({
      stepIndex: index,
      marks,
      hasSubSteps,
      totalSubSteps: subSteps.length,

      mainCorrectAnswer,
      subCorrectAnswers,

      p1MainAnswerIndex: p1MainAnswer,
      p2MainAnswerIndex: p2MainAnswer,
      p1SubAnswerIndices,
      p2SubAnswerIndices,

      p1PartCorrect,
      p2PartCorrect,
      p1StepAwarded: p1StepMarks,
      p2StepAwarded: p2StepMarks,

      // Legacy v2 fields (compute_multi_step_results_v2 sums these)
      correctAnswer: mainCorrectAnswer,
      p1AnswerIndex: p1MainAnswer,
      p2AnswerIndex: p2MainAnswer,
      p1Marks: p1StepMarks,
      p2Marks: p2StepMarks
    })
  })

  // Get current round_id from database
  const { data: matchData, error: matchError } = await supabase
    .from('matches')
    .select('current_round_id')
    .eq('id', matchId)
    .single()

  if (matchError || !matchData?.current_round_id) {
    console.error(`[${matchId}] ❌ Failed to get current_round_id:`, matchError)
    // DO NOT broadcast WS-only results - would break cross-instance sync
    // If we can't get round_id, we can't write to DB → no canonical state → let client timeout/recover
    return
  }

  // V3: DB-driven multi-step results (reads from match_step_answers_v2; supports async segments)
  await computeAndBroadcastMultiStepResultsV3(matchId, matchData.current_round_id, supabase)
  return

  // Call database RPC to compute results and write to database
  console.log(`[${matchId}] 📊 Calling compute_multi_step_results_v2 RPC with ${stepResultsArray.length} steps`)
  const { data: rpcResult, error: rpcError } = await supabase.rpc('compute_multi_step_results_v2', {
    p_match_id: matchId,
    p_round_id: matchData.current_round_id,
    p_step_results: stepResultsArray as any
  })

  if (rpcError) {
    console.error(`[${matchId}] ❌ Error calling compute_multi_step_results_v2:`, rpcError)
    // DO NOT broadcast WS-only results here - would break cross-instance sync
    // If RPC fails, we don't write to DB → no canonical state → let client timeout/recover
    return
  }

  if (!rpcResult?.success) {
    console.error(`[${matchId}] ❌ RPC returned error:`, rpcResult?.error)
    console.error(`[${matchId}] 🔍 DEBUG: RPC FAILED - NO SUCCESS - error=${rpcResult?.error}`)
    return
  }

  // RPC has written results_payload to database
  // Realtime subscription will deliver to both players simultaneously
  // Update in-memory state from RPC result
  const payload = rpcResult.results_payload
  console.log(`[${matchId}] 🔍 DEBUG: RPC SUCCESS - PAYLOAD RECEIVED - hasPayload=${!!payload}, mode=${payload?.mode}, resultsVersion=${rpcResult.results_version}`)
  if (payload) {
    const roundWinner = payload.round_winner
    const matchOver = payload.match_over || false
    const matchWinnerId = payload.match_winner_id || null

    // Update round wins in memory state
    if (roundWinner) {
      const currentWins = state.playerRoundWins.get(roundWinner) || 0
      state.playerRoundWins.set(roundWinner, currentWins + 1)
      
      const matchState = matchStates.get(matchId)
      if (matchState) {
        matchState.playerRoundWins.set(roundWinner, currentWins + 1)
      }
      
      console.log(`[${matchId}] 🏆 Round ${state.roundNumber} won by ${roundWinner} (now has ${currentWins + 1} wins)`)
    }

    // Convert playerRoundWins from payload
    const playerRoundWinsObj: { [playerId: string]: number } = {}
    if (payload.p1?.total !== undefined && payload.p2?.total !== undefined) {
      playerRoundWinsObj[state.p1Id || ''] = payload.p1.total
      playerRoundWinsObj[state.p2Id || ''] = payload.p2.total
    }

    // RPC has written results_payload to database
    // CANONICAL: Realtime UPDATE delivers to all clients on all instances
    // FAST-PATH: Also broadcast via WebSocket for same-instance optimization
    console.log(`[${matchId}] ✅ Results written to DB (results_version=${rpcResult.results_version}) - Realtime delivers to all, WS fast-path for same-instance`)

    // FAST-PATH: Broadcast via WebSocket (only reaches same-instance sockets)
    // If both players are on this instance, they get instant results
    // If players are on different instances, Realtime will deliver shortly after
    const resultsEvent = {
      type: 'RESULTS_RECEIVED',
      results_payload: payload,
      results_version: rpcResult.results_version,
      round_number: payload.round_number || state.roundNumber,
      round_id: payload.round_id || matchData.current_round_id
    }
    if (ENABLE_WS_FASTPATH) {
      console.log(`[${matchId}] ⚡ WS fast-path: Broadcasting to local sockets`)
      if (ENABLE_WS_FASTPATH) {
        broadcastToMatch(matchId, resultsEvent)
      }
    }

    // Initialize readiness tracking for results acknowledgment
    const matchState = matchStates.get(matchId)
    if (matchState) {
      matchState.p1ResultsAcknowledged = false
      matchState.p2ResultsAcknowledged = false
      matchState.roundTransitionInProgress = false
    }

    if (matchOver) {
      // Match finished - cleanup and don't start next round
      console.log(`[${matchId}] 🏁 Match finished - Winner: ${matchWinnerId}`)
      matchStates.delete(matchId)
      setTimeout(() => {
        cleanupGameState(matchId)
      }, 5000) // Give time for UI to show final results
    } else {
      // Don't auto-transition - wait for both players to acknowledge results
      console.log(`[${matchId}] ⏳ Waiting for both players to acknowledge results before starting next round`)
    }
  } else {
    console.error(`[${matchId}] ❌ RPC did not return results_payload`)
  }
}

/**
 * Handle EARLY_ANSWER message (skip main question phase)
 */
async function handleEarlyAnswer(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] ⚡ Early answer received - forcing main phase end`)
  try {
    const { data: matchRow, error: matchError } = await supabase
      .from('matches')
      .select('current_round_id')
      .eq('id', matchId)
      .single()

    if (matchError || !matchRow?.current_round_id) {
      console.warn(`[${matchId}] ⚠️ EARLY_ANSWER could not find current_round_id`, matchError)
    } else {
      const nowIso = new Date().toISOString()
      const { error: roundError } = await supabase
        .from('match_rounds')
        .update({
          ends_at: nowIso,
          main_question_ends_at: nowIso
        })
        .eq('id', matchRow.current_round_id)

      if (roundError) {
        console.warn(`[${matchId}] ⚠️ EARLY_ANSWER failed to update round ends_at`, roundError)
      }
    }
  } catch (err) {
    console.warn(`[${matchId}] ⚠️ EARLY_ANSWER exception while forcing end`, err)
  }

  await attemptPhaseAdvance(matchId, supabase, { forceSnapshot: true })
  await broadcastSnapshotToMatch(matchId, supabase)
}

/**
 * Handle SUBMIT_STEP_ANSWER message
 */
async function handleStepAnswer(
  matchId: string,
  playerId: string,
  stepIndex: number,
  segment: 'main' | 'sub',
  subStepIndex: number,
  answerIndex: number,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // DB-driven async progression: advance THIS player immediately after answering.
  // This avoids "wait for opponent/timer" between parts.
    // Resolve current round id + players
    const { data: matchRow, error: matchError } = await supabase
      .from('matches')
      .select('current_round_id, player1_id, player2_id')
      .eq('id', matchId)
      .single()

    if (matchError || !matchRow?.current_round_id) {
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Match round not available' } as GameErrorEvent))
      return
    }

    const roundId = matchRow.current_round_id as string

    const { data: roundRow } = await supabase
      .from('match_rounds')
      .select('id, question_id, phase, status')
      .eq('id', roundId)
      .single()

    const roundPhase = (roundRow?.phase ?? roundRow?.status ?? 'main') as string
    if (roundPhase !== 'steps') {
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Not in steps phase' } as GameErrorEvent))
      return
    }

    // Ensure progress rows exist (idempotent)
    const { error: initError } = await supabase.rpc('init_round_progress_v1', {
      p_match_id: matchId,
      p_round_id: roundId
    })
    if (initError) {
      console.error(`[${matchId}] ❌ init_round_progress_v1 failed:`, initError)
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Progress system unavailable' } as GameErrorEvent))
      return
    }

    // Load canonical progress for this player
    const { data: progress, error: progressError } = await supabase
      .from('match_round_player_progress_v1')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .maybeSingle()

    if (progressError || !progress) {
      console.error(`[${matchId}] ❌ Failed to load player progress:`, progressError)
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Failed to load progress' } as GameErrorEvent))
      return
    }

    // If player already finished, just re-emit waiting state (with correct p1/p2 flags)
    if (progress.completed_at) {
      const playerIds = [matchRow.player1_id, matchRow.player2_id].filter(Boolean) as string[]
      const { data: rows } = await supabase
        .from('match_round_player_progress_v1')
        .select('player_id, completed_at')
        .eq('match_id', matchId)
        .eq('round_id', roundId)
        .in('player_id', playerIds)

      const byPlayer = new Map<string, any>()
      ;(rows || []).forEach((row: any) => byPlayer.set(row.player_id, row))

      const p1Complete = !!(matchRow.player1_id && byPlayer.get(matchRow.player1_id)?.completed_at)
      const p2Complete = !!(matchRow.player2_id && byPlayer.get(matchRow.player2_id)?.completed_at)

      const waitingEvent: AllStepsCompleteWaitingEvent = {
        type: 'ALL_STEPS_COMPLETE_WAITING',
        p1Complete,
        p2Complete
      }
      sendToPlayer(matchId, playerId, waitingEvent, socket)
      await broadcastSnapshotToMatch(matchId, supabase)
      return
    }

    const canonicalStepIndex = Number(progress.current_step_index ?? 0)
    const canonicalSegment = (progress.current_segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
    const canonicalSubStepIndex = canonicalSegment === 'sub'
      ? Number((progress as any).current_sub_step_index ?? 0)
      : 0

    // If still in main-question sentinel (-1), reject and let the client resync
    if (!Number.isFinite(canonicalStepIndex) || canonicalStepIndex < 0) {
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Not yet in steps - please wait' } as GameErrorEvent))
      return
    }

    // Ensure we have the question payload to compute correctness + build next segment UI
    let steps: any[] = []
    if (roundRow?.question_id) {
      const { data: q } = await supabase
        .from('questions_v2')
        .select('steps')
        .eq('id', roundRow.question_id)
        .single()
      steps = normalizeSteps(q?.steps)
    }
    if (steps.length === 0) {
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Question steps not loaded' } as GameErrorEvent))
      return
    }

    // Out-of-sync protection: return canonical state to the client (do not record an answer)
    if (
      canonicalStepIndex !== stepIndex ||
      canonicalSegment !== segment ||
      canonicalSubStepIndex !== subStepIndex
    ) {
      const mainStep = steps[canonicalStepIndex]
      const subSteps = normalizeSubSteps(mainStep)
      const segmentStep = canonicalSegment === 'main' ? mainStep : subSteps[canonicalSubStepIndex]
      const stepEndsAt = progress.segment_ends_at ? String(progress.segment_ends_at) : new Date().toISOString()

      if (segmentStep) {
        const resyncEvent: PhaseChangeEvent = {
          type: 'PHASE_CHANGE',
          matchId,
          phase: 'steps',
          stepIndex: canonicalStepIndex,
          segment: canonicalSegment,
          subStepIndex: canonicalSubStepIndex,
          totalSteps: steps.length,
          stepEndsAt,
          progressMode: 'async',
          currentStep: {
            id: segmentStep?.id || '',
            prompt: coercePrompt(segmentStep),
            options: coerceOptions(segmentStep),
            correctAnswer: coerceCorrectAnswerIndex(segmentStep),
            marks: mainStep?.marks || 0
          }
        }
        sendToPlayer(matchId, playerId, resyncEvent, socket)
      }
      await broadcastSnapshotToMatch(matchId, supabase)
      return
    }

    // Determine correct answer for this segment
    const mainStep = steps[canonicalStepIndex]
    const subSteps = normalizeSubSteps(mainStep)
    const segmentStep = canonicalSegment === 'main' ? mainStep : subSteps[canonicalSubStepIndex]
    if (!segmentStep) {
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Invalid segment' } as GameErrorEvent))
      return
    }

    const correctAnswer = coerceCorrectAnswerIndex(segmentStep)
    const isCorrect = answerIndex === correctAnswer

    // Atomic: record answer + advance THIS player's progress
    const { data: submitResult, error: submitError } = await supabase.rpc('submit_segment_v1', {
      p_match_id: matchId,
      p_round_id: roundId,
      p_player_id: playerId,
      p_step_index: canonicalStepIndex,
      p_segment: canonicalSegment,
      p_answer_index: answerIndex,
      p_is_correct: isCorrect
    })

    if (submitError) {
      console.error(`[${matchId}] ❌ submit_segment_v1 failed:`, submitError)
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Failed to submit answer' } as GameErrorEvent))
      return
    }

    const r: any = submitResult

    // Out-of-sync response from RPC (canonical is returned)
    if (r?.out_of_sync && r?.canonical) {
      const c = r.canonical
      const cStepIndex = Number(c.stepIndex ?? c.current_step_index ?? canonicalStepIndex)
      const cSegment = (c.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
      const cSubIdx = cSegment === 'sub' ? Number(c.subStepIndex ?? c.current_sub_step_index ?? 0) : 0
      const cEndsAt = c.segmentEndsAt ?? c.segment_ends_at ?? progress.segment_ends_at ?? new Date().toISOString()

      const cMainStep = steps[cStepIndex]
      const cSubSteps = normalizeSubSteps(cMainStep)
      const cSegStep = cSegment === 'main' ? cMainStep : cSubSteps[cSubIdx]

      if (cSegStep) {
        const resyncEvent: PhaseChangeEvent = {
          type: 'PHASE_CHANGE',
          matchId,
          phase: 'steps',
          stepIndex: cStepIndex,
          segment: cSegment,
          subStepIndex: cSubIdx,
          totalSteps: steps.length,
          stepEndsAt: String(cEndsAt),
          progressMode: 'async',
          currentStep: {
            id: cSegStep?.id || '',
            prompt: coercePrompt(cSegStep),
            options: coerceOptions(cSegStep),
            correctAnswer: coerceCorrectAnswerIndex(cSegStep),
            marks: cMainStep?.marks || 0
          }
        }
        sendToPlayer(matchId, playerId, resyncEvent, socket)
      }
      await broadcastSnapshotToMatch(matchId, supabase)
      return
    }

    // Completed all parts for this player
    if (r?.completed === true || r?.already_completed === true) {
      // Determine completion status for both players (for end-of-steps waiting UI)
      const playerIds = [matchRow.player1_id, matchRow.player2_id].filter(Boolean) as string[]
      const { data: rows } = await supabase
        .from('match_round_player_progress_v1')
        .select('player_id, completed_at')
        .eq('match_id', matchId)
        .eq('round_id', roundId)
        .in('player_id', playerIds)

      const byPlayer = new Map<string, any>()
      ;(rows || []).forEach((row: any) => byPlayer.set(row.player_id, row))

      const p1Complete = !!(matchRow.player1_id && byPlayer.get(matchRow.player1_id)?.completed_at)
      const p2Complete = !!(matchRow.player2_id && byPlayer.get(matchRow.player2_id)?.completed_at)

      const waitingEvent: AllStepsCompleteWaitingEvent = {
        type: 'ALL_STEPS_COMPLETE_WAITING',
        p1Complete,
        p2Complete
      }
      // Send to both players so each can render correct waiting state.
      if (matchRow.player1_id) sendToPlayer(matchId, matchRow.player1_id, waitingEvent)
      if (matchRow.player2_id) sendToPlayer(matchId, matchRow.player2_id, waitingEvent)

      // If both finished, compute results immediately (idempotent).
      if (p1Complete && p2Complete) {
        await computeAndBroadcastMultiStepResultsV3(matchId, roundId, supabase)
      }
      return
    }

    // Extract next canonical state from RPC (supports multiple return shapes)
    const nextObj = r?.next ?? r
    const nextStepIndex = Number(nextObj.stepIndex ?? nextObj.current_step_index)
    const nextSegment = (nextObj.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
    const nextSubIdx = nextSegment === 'sub'
      ? Number(nextObj.subStepIndex ?? nextObj.current_sub_step_index ?? 0)
      : 0
    const nextEndsAt = nextObj.segmentEndsAt ?? nextObj.segment_ends_at ?? nextObj.stepEndsAt ?? new Date().toISOString()

    if (!Number.isFinite(nextStepIndex) || nextStepIndex < 0) {
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Invalid next progress state' } as GameErrorEvent))
      return
    }

    const nextMainStep = steps[nextStepIndex]
    const nextSubSteps = normalizeSubSteps(nextMainStep)
    const nextSegStep = nextSegment === 'main' ? nextMainStep : nextSubSteps[nextSubIdx]

    if (!nextSegStep) {
      socket.send(JSON.stringify({ type: 'GAME_ERROR', message: 'Invalid next segment' } as GameErrorEvent))
      return
    }

    const phaseChangeEvent: PhaseChangeEvent = {
      type: 'PHASE_CHANGE',
      matchId,
      phase: 'steps',
      stepIndex: nextStepIndex,
      segment: nextSegment,
      subStepIndex: nextSubIdx,
      totalSteps: steps.length,
      stepEndsAt: String(nextEndsAt),
      progressMode: 'async',
      currentStep: {
        id: nextSegStep?.id || '',
        prompt: coercePrompt(nextSegStep),
        options: coerceOptions(nextSegStep),
        correctAnswer: coerceCorrectAnswerIndex(nextSegStep),
        // Sub-steps don't award marks; show the parent step marks for UI consistency.
        marks: nextMainStep?.marks || 0
      }
    }

    // Prime sweep dedupe with the new canonical state for this player
    try {
      const iso = new Date(String(nextEndsAt)).toISOString()
      setLastAsyncProgressKey(matchId, playerId, `${nextStepIndex}|${nextSegment}|${nextSubIdx}|${iso}|`)
    } catch {
      setLastAsyncProgressKey(matchId, playerId, `${nextStepIndex}|${nextSegment}|${nextSubIdx}|${String(nextEndsAt)}|`)
    }

    sendToPlayer(matchId, playerId, phaseChangeEvent, socket)
    await broadcastSnapshotToMatch(matchId, supabase)
    return
}

/**
 * Handle SUBMIT_ANSWER message
 * - Validates answer
 * - Calls atomic RPC
 * - Broadcasts results when both answered
 * - Clears timeout on early completion
 */
async function handleSubmitAnswer(
  matchId: string,
  playerId: string,
  answer: number,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] SUBMIT_ANSWER from player ${playerId}, answer: ${answer}`)

  // Validate answer index (MCQ can be 2–6 options, so allow 0-5; DB will validate against actual option count)
  if (typeof answer !== 'number' || !Number.isFinite(answer) || !Number.isInteger(answer) || answer < 0 || answer > 5) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid answer: must be an integer 0-5'
    } as GameErrorEvent))
    return
  }

  // Get match to determine player role
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('player1_id, player2_id')
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

  const isP1 = match.player1_id === playerId

  // Call atomic RPC
  const { data: result, error } = await supabase.rpc('submit_answer_stage2', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_answer: answer
  })

  if (error) {
    // Check if RPC function doesn't exist (migration not applied)
    if (error.code === '42883' || error.message?.includes('does not exist') || error.message?.includes('function')) {
      console.error(`[${matchId}] ❌ RPC function submit_answer_stage2 not found - migrations may not be applied`)
      socket.send(JSON.stringify({
        type: 'GAME_ERROR',
        message: 'Answer submission not available - database migrations required'
      } as GameErrorEvent))
      return
    }
    console.error(`[${matchId}] ❌ Error submitting answer:`, error)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: error.message || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  if (!result?.success) {
    console.error(`[${matchId}] ❌ RPC returned error:`, result?.error)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: result?.error || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  // Send confirmation to submitter
  socket.send(JSON.stringify({
    type: 'ANSWER_SUBMITTED',
    both_answered: result.both_answered
  }))

  // If both answered, fetch and broadcast results
  if (result.both_answered) {
    // Clear timeout since both answered early
    const existingTimeout = matchTimeouts.get(matchId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      matchTimeouts.delete(matchId)
      console.log(`[${matchId}] ✅ Cleared timeout - both players answered early`)
    }

    const { data: matchResults } = await supabase
      .from('matches')
      .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner')
      .eq('id', matchId)
      .single()

    if (matchResults) {
      // Get match state (should already be initialized in selectAndBroadcastQuestion)
      const matchState = matchStates.get(matchId)
      if (!matchState) {
        console.error(`[${matchId}] ⚠️ Match state not found for single-step question`)
        // Fallback - create it now
        const { data: matchData } = await supabase
          .from('matches')
          .select('player1_id, player2_id')
          .eq('id', matchId)
          .single()
        const fallbackState: MatchState = {
          roundNumber: 1,
          targetRoundsToWin: matchData?.target_rounds_to_win || 3,
          playerRoundWins: new Map(),
          p1Id: matchData?.player1_id || null,
          p2Id: matchData?.player2_id || null,
          p1ResultsAcknowledged: false,
          p2ResultsAcknowledged: false,
          roundTransitionInProgress: false
        }
        matchStates.set(matchId, fallbackState)
        await handleRoundTransition(matchId, supabase)
        return
      }

      // Update round wins
      const winnerId = matchResults.round_winner
      if (winnerId) {
        const currentWins = matchState.playerRoundWins.get(winnerId) || 0
        matchState.playerRoundWins.set(winnerId, currentWins + 1)
        console.log(`[${matchId}] 🏆 Round ${matchState.roundNumber} won by ${winnerId} (now has ${currentWins + 1} wins)`)
      }
      
      // Increment round number for next round (if match continues)
      const currentRoundNum = matchState.roundNumber

      // Check if match is over
      const p1Wins = matchState.playerRoundWins.get(matchState.p1Id || '') || 0
      const p2Wins = matchState.playerRoundWins.get(matchState.p2Id || '') || 0
      const targetWins = matchState.targetRoundsToWin || 3
      const matchOver = p1Wins >= targetWins || p2Wins >= targetWins
      const matchWinnerId = matchOver ? (p1Wins >= targetWins ? matchState.p1Id : matchState.p2Id) : null

      // Convert playerRoundWins Map to object for JSON serialization
      const playerRoundWinsObj: { [playerId: string]: number } = {}
      matchState.playerRoundWins.forEach((wins, playerId) => {
        playerRoundWinsObj[playerId] = wins
      })

      const resultsEvent: ResultsReceivedEvent = {
        type: 'RESULTS_RECEIVED',
        player1_answer: matchResults.player1_answer,
        player2_answer: matchResults.player2_answer,
        correct_answer: matchResults.correct_answer!,
        player1_correct: matchResults.player1_correct!,
        player2_correct: matchResults.player2_correct!,
        round_winner: matchResults.round_winner,
        roundNumber: currentRoundNum,
        targetRoundsToWin: targetWins,
        playerRoundWins: playerRoundWinsObj,
        matchOver,
        matchWinnerId
      }

      broadcastToMatch(matchId, resultsEvent)
      
      // Initialize readiness tracking for results acknowledgment
      matchState.p1ResultsAcknowledged = false
      matchState.p2ResultsAcknowledged = false
      matchState.roundTransitionInProgress = false

      if (matchOver) {
        // Match finished - cleanup and don't start next round
        console.log(`[${matchId}] 🏁 Match finished - Winner: ${matchWinnerId}`)
        matchStates.delete(matchId)
      } else {
        // Increment round number for next round
        matchState.roundNumber = currentRoundNum + 1
        // Don't auto-transition - wait for both players to acknowledge results
        console.log(`[${matchId}] ⏳ Waiting for both players to acknowledge results before starting next round`)
      }
    }
  } else {
    // Only one answered - broadcast "waiting" to both
    const answerReceivedEvent: AnswerReceivedEvent = {
      type: 'ANSWER_RECEIVED',
      player: isP1 ? 'player1' : 'player2',
      waiting_for_opponent: true
    }

    broadcastToMatch(matchId, answerReceivedEvent)
  }
}

/**
 * Handle SUBMIT_ANSWER message (V2 - DB-driven)
 * - Validates answer
 * - Calls submit_round_answer_v2 RPC (single source of truth)
 * - Broadcasts RESULTS_RECEIVED when both answered
 * - Starts next round if match continues
 * 
 * Key difference: No in-memory state. Everything comes from RPC return value.
 */
async function handleSubmitAnswerV2(
  matchId: string,
  playerId: string,
  answer: number,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] [V2] SUBMIT_ANSWER from player ${playerId}, answer: ${answer}`)

  // Validate answer index (MCQ can be 2–6 options, so allow 0-5; DB will validate against actual option count)
  if (typeof answer !== 'number' || !Number.isFinite(answer) || !Number.isInteger(answer) || answer < 0 || answer > 5) {
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Invalid answer: must be an integer 0-5'
    } as GameErrorEvent))
    return
  }

  // Call v2 RPC (single source of truth)
  const { data, error } = await supabase.rpc('submit_round_answer_v2', {
    p_match_id: matchId,
    p_player_id: playerId,
    p_answer: answer
  })

  if (error) {
    console.error(`[${matchId}] ❌ [V2] Error submitting answer:`, error)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: error.message || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  if (!data?.success) {
    console.error(`[${matchId}] ❌ [V2] RPC returned error:`, data?.error || data?.reason)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: data?.error || data?.reason || 'Failed to submit answer'
    } as GameErrorEvent))
    return
  }

  // Send confirmation to submitter
  socket.send(JSON.stringify({
    type: 'ANSWER_SUBMITTED',
    both_answered: data.both_answered
  }))

  // Realtime will deliver results to all clients (primary mechanism)
  // WebSocket broadcast as fallback in case Realtime is delayed/fails
  if (data.both_answered && data.results_payload) {
    console.log(`[${matchId}] ✅ [V2] Results computed - requesting phase advance`)
    await attemptPhaseAdvance(matchId, supabase, { forceSnapshot: true })
  } else {
    // Only one answered - get match to determine player role for broadcast
    const { data: matchData } = await supabase
      .from('matches')
      .select('player1_id, player2_id')
      .eq('id', matchId)
      .single()
    
    if (matchData) {
      const answerReceivedEvent: AnswerReceivedEvent = {
        type: 'ANSWER_RECEIVED',
        player: matchData.player1_id === playerId ? 'player1' : 'player2',
        waiting_for_opponent: true
      }
      broadcastToMatch(matchId, answerReceivedEvent)
    }
    await attemptPhaseAdvance(matchId, supabase, { forceSnapshot: true })
  }
  await broadcastSnapshotToMatch(matchId, supabase)
}

/**
 * Handle round transition after both players acknowledge results
 * - Checks if both players are ready
 * - Fetches fresh match state from database
 * - If match finished, broadcasts MATCH_FINISHED
 * - If match continues, starts next round
 * - Includes idempotency checks to prevent double-firing
 */
async function handleRoundTransition(
  matchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] 🔄 Checking match state for round transition...`)
  
  const matchState = matchStates.get(matchId)
  if (!matchState) {
    console.error(`[${matchId}] ❌ No match state found for round transition`)
    return
  }

  // Idempotency check: prevent double-firing
  if (matchState.roundTransitionInProgress) {
    console.log(`[${matchId}] ⚠️ Round transition already in progress - skipping`)
    return
  }

  // Check if both players have acknowledged results
  if (!matchState.p1ResultsAcknowledged || !matchState.p2ResultsAcknowledged) {
    console.log(`[${matchId}] ⏳ Not all players ready - P1: ${matchState.p1ResultsAcknowledged}, P2: ${matchState.p2ResultsAcknowledged}`)
    return
  }

  // Mark transition as in progress
  matchState.roundTransitionInProgress = true
  
  // Fetch fresh match state from database (don't use cached state)
  const { data: dbMatchState, error: stateError } = await supabase
    .from('matches')
    .select('winner_id, status')
    .eq('id', matchId)
    .single()
  
  if (stateError || !dbMatchState) {
    console.error(`[${matchId}] ❌ Failed to fetch match state:`, stateError)
    matchState.roundTransitionInProgress = false
    return
  }
  
  // If match finished, broadcast MATCH_FINISHED
  if (dbMatchState.winner_id !== null) {
    console.log(`[${matchId}] 🏆 Match finished - winner: ${dbMatchState.winner_id}`)
    
    const totalRounds = matchState.roundNumber || 0
    
    const matchFinishedEvent: MatchFinishedEvent = {
      type: 'MATCH_FINISHED',
      winner_id: dbMatchState.winner_id,
      total_rounds: totalRounds
    }
    
    broadcastToMatch(matchId, matchFinishedEvent)
    matchStates.delete(matchId)
    return
  }
  
  // Match continues - start next round
  console.log(`[${matchId}] ➡️ Match continues - starting next round...`)
  
  // Clear timeout (if any)
  const existingTimeout = matchTimeouts.get(matchId)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
    matchTimeouts.delete(matchId)
  }
  
  // Call start_next_round_stage3 to clear answer fields
  const { data: resetResult, error: resetError } = await supabase.rpc('start_next_round_stage3', {
    p_match_id: matchId
  })
  
  if (resetError) {
    // Check if RPC function doesn't exist (migration not applied)
    if (resetError.code === '42883' || resetError.message?.includes('does not exist') || resetError.message?.includes('function')) {
      console.warn(`[${matchId}] ⚠️ RPC function start_next_round_stage3 not found - Stage 3 migrations may not be applied`)
      matchState.roundTransitionInProgress = false
      return
    }
    console.error(`[${matchId}] ❌ Error starting next round:`, resetError)
    matchState.roundTransitionInProgress = false
    return
  }
  
  if (!resetResult?.success) {
    console.error(`[${matchId}] ❌ Failed to start next round:`, resetResult?.error)
    matchState.roundTransitionInProgress = false
    return
  }
  
  console.log(`[${matchId}] ✅ Round reset successful - selecting next question...`)
  
  // Reset readiness flags for next round
  matchState.p1ResultsAcknowledged = false
  matchState.p2ResultsAcknowledged = false
  matchState.roundTransitionInProgress = false
  
  // Select and broadcast next question
  await selectAndBroadcastQuestion(matchId, supabase)
  
  // Optionally broadcast ROUND_STARTED event (using in-memory state instead of DB columns)
  if (matchState) {
    const roundStartedEvent: RoundStartedEvent = {
      type: 'ROUND_STARTED',
      round_number: matchState.roundNumber || 0,
      last_round_winner: null, // Not tracked in new system
      consecutive_wins_count: 0 // Not tracked in new system
    }
    
    broadcastToMatch(matchId, roundStartedEvent)
  }
}

/**
 * Handle READY_FOR_NEXT_ROUND message
 * - Marks player as ready for next round
 * - Checks if both players are ready
 * - Starts next round if both are ready
 */
async function handleReadyForNextRound(
  matchId: string,
  playerId: string,
  socket: WebSocket,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log(`[${matchId}] ✅ READY_FOR_NEXT_ROUND request from player ${playerId}`)

  // DB-driven: do not rely on in-memory ack state (Edge instances are not shared).
  // Treat this as a "request to advance / ensure current round question is broadcast to this instance".
  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select('id, player1_id, player2_id, status, winner_id, results_computed_at, current_round_id, current_round_number, question_id')
    .eq('id', matchId)
    .single()

  if (matchError || !matchRow) {
    console.error(`[${matchId}] ❌ READY_FOR_NEXT_ROUND: match not found`, matchError)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'Match not found'
    } as GameErrorEvent))
    return
  }

  if (matchRow.player1_id !== playerId && matchRow.player2_id !== playerId) {
    console.error(`[${matchId}] ❌ READY_FOR_NEXT_ROUND: player ${playerId} not in match`)
    socket.send(JSON.stringify({
      type: 'GAME_ERROR',
      message: 'You are not part of this match'
    } as GameErrorEvent))
    return
  }

  // If match is finished, notify and stop.
  if (matchRow.winner_id) {
    const matchFinishedEvent: MatchFinishedEvent = {
      type: 'MATCH_FINISHED',
      winner_id: matchRow.winner_id,
      total_rounds: matchRow.current_round_number || 0
    }
    socket.send(JSON.stringify(matchFinishedEvent))
    return
  }

  if (matchRow.status !== 'in_progress') {
    console.warn(`[${matchId}] ⚠️ READY_FOR_NEXT_ROUND: match not in_progress (status=${matchRow.status})`)
    return
  }

  await attemptPhaseAdvance(matchId, supabase, { forceSnapshot: true })
  await broadcastSnapshotToMatch(matchId, supabase)
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

  // Attach metadata to the socket for per-player messaging (multi-tab safe)
  ;(socket as any)._matchId = matchId
  ;(socket as any)._playerId = playerId
  ;(socket as any)._playerRole = playerRole

  console.log(`[${matchId}] ✅ Player ${playerRole} (${playerId}) connected and confirmed`)

  // Start phase scheduler + send authoritative snapshot
  ensurePhaseScheduler(matchId, supabase)
  await sendSnapshotToSocket(matchId, socket, supabase)

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
      console.log(`[${matchId}] ✅ [WS] Both players connected detected in checkConnection`)
      // NOTE: checkAndBroadcastBothConnected will re-check the database
      // right before broadcasting to catch any disconnects
      const broadcastSuccess = await checkAndBroadcastBothConnected(matchId, match, supabase)
      console.log(`[${matchId}] 📊 [WS] checkAndBroadcastBothConnected returned:`, broadcastSuccess)
      
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
        // First, ensure match status is 'in_progress' (it may still be 'pending')
        console.log(`[${matchId}] 🎮 [WS] BOTH_CONNECTED handler - updating match status to in_progress...`)
        const { error: statusUpdateError } = await supabase
          .from('matches')
          .update({ status: 'in_progress' })
          .eq('id', matchId)
          .neq('status', 'in_progress')
        
        if (statusUpdateError) {
          console.error(`[${matchId}] ❌ [WS] Failed to update match status:`, statusUpdateError)
        } else {
          console.log(`[${matchId}] ✅ [WS] Match status updated to in_progress`)
        }
        
        // selectAndBroadcastQuestion is idempotent - it handles existing questions internally
        console.log(`[${matchId}] 🎮 [WS] BOTH_CONNECTED handler - calling selectAndBroadcastQuestion...`)
        try {
          await selectAndBroadcastQuestion(matchId, supabase)
          console.log(`[${matchId}] ✅ [WS] selectAndBroadcastQuestion completed successfully`)
        } catch (error) {
          console.error(`[${matchId}] ❌ [WS] Error in selectAndBroadcastQuestion:`, error)
          console.error(`[${matchId}] ❌ [WS] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
          // Don't throw - let the game continue, question might already be sent
        }
        
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
  try {
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
      console.error(`[${matchId || 'unknown'}] Auth error:`, userError)
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

    let socket: WebSocket
    let response: Response
    try {
      const upgradeResult = Deno.upgradeWebSocket(req)
      socket = upgradeResult.socket
      response = upgradeResult.response
    } catch (upgradeError) {
      console.error(`[${matchId}] Failed to upgrade WebSocket:`, upgradeError)
      return new Response('WebSocket upgrade failed', { 
        status: 500,
        headers: corsHeaders 
      })
    }

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

  const lastPingAdvanceAt = new Map<string, number>()

  socket.onmessage = async (event) => {
    try {
      console.log(`[${matchId}] 📨 Raw message received:`, event.data)
      const message = JSON.parse(event.data)
      console.log(`[${matchId}] 📨 Parsed message:`, message)

      if (message.type === 'PING') {
        // Lightweight heartbeat - respond with PONG
        try {
          socket.send(JSON.stringify({ type: 'PONG' }))
        } catch (_err) {
          // Ignore send errors for heartbeat
        }
        // Opportunistic phase advancement (throttled) to avoid timer stalls.
        try {
          const now = Date.now()
          const last = lastPingAdvanceAt.get(matchId) ?? 0
          if (now - last >= 2000) {
            lastPingAdvanceAt.set(matchId, now)
            await attemptPhaseAdvance(matchId, supabase)
          }
        } catch (err) {
          console.warn(`[${matchId}] ⚠️ PING phase advance failed:`, err)
        }
      } else if (message.type === 'JOIN_MATCH') {
        console.log(`[${matchId}] Processing JOIN_MATCH from user ${user.id}`)
        await handleJoinMatch(matchId, user.id, socket, supabase)
      } else if (message.type === 'EARLY_ANSWER') {
        console.log(`[${matchId}] Processing EARLY_ANSWER from user ${user.id}`)
        await handleEarlyAnswer(matchId, supabase)
      } else if (message.type === 'SUBMIT_STEP_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_STEP_ANSWER from user ${user.id}`)
        const seg = (message.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
        const subIdx = (typeof message.subStepIndex === 'number' && Number.isFinite(message.subStepIndex))
          ? message.subStepIndex
          : 0
        await handleStepAnswer(matchId, user.id, message.stepIndex, seg, subIdx, message.answerIndex, socket, supabase)
      } else if (message.type === 'SUBMIT_SEGMENT_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_SEGMENT_ANSWER from user ${user.id}`)
        const seg = (message.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
        const stepIdx = (typeof message.stepIndex === 'number' && Number.isFinite(message.stepIndex))
          ? message.stepIndex
          : 0
        const subIdx = (typeof message.subStepIndex === 'number' && Number.isFinite(message.subStepIndex))
          ? message.subStepIndex
          : 0
        const ansIdx = (typeof message.answerIndex === 'number' && Number.isFinite(message.answerIndex))
          ? message.answerIndex
          : (typeof message.answer === 'number' ? message.answer : 0)
        await handleStepAnswer(matchId, user.id, stepIdx, seg, subIdx, ansIdx, socket, supabase)
      } else if (message.type === 'SUBMIT_ANSWER') {
        console.log(`[${matchId}] Processing SUBMIT_ANSWER from user ${user.id}`)
        // DB-authoritative routing: check phase from DB, then route.
        let roundPhase: string | null = null
        try {
          const { data: matchRow } = await supabase
            .from('matches')
            .select('current_round_id')
            .eq('id', matchId)
            .single()

          const roundId = matchRow?.current_round_id as string | undefined
          if (roundId) {
            const { data: roundRow } = await supabase
              .from('match_rounds')
              .select('phase, status')
              .eq('id', roundId)
              .single()
            roundPhase = (roundRow?.phase ?? roundRow?.status ?? null) as string | null
          }
        } catch {
          roundPhase = null
        }

        if (roundPhase === 'steps') {
          try {
            const { data: matchRow } = await supabase
              .from('matches')
              .select('current_round_id')
              .eq('id', matchId)
              .single()

            const roundId = matchRow?.current_round_id as string | undefined
            if (roundId) {
              const { data: progress } = await supabase
                .from('match_round_player_progress_v1')
                .select('*')
                .eq('match_id', matchId)
                .eq('round_id', roundId)
                .eq('player_id', user.id)
                .maybeSingle()

              const pStep = Number(progress?.current_step_index ?? 0)
              const pSeg = ((progress?.current_segment === 'sub') ? 'sub' : 'main') as 'main' | 'sub'
              const pSub = pSeg === 'sub' ? Number((progress as any)?.current_sub_step_index ?? 0) : 0

              await handleStepAnswer(matchId, user.id, pStep, pSeg, pSub, message.answer, socket, supabase)
              return
            }
          } catch {
            // Fall through to submit answer if progress lookup failed.
          }
        }

        // V2: Always use handleSubmitAnswerV2 (migrations must be deployed first)
        await handleSubmitAnswerV2(matchId, user.id, message.answer, socket, supabase)
      } else if (message.type === 'READY_FOR_NEXT_ROUND') {
        console.log(`[${matchId}] Processing READY_FOR_NEXT_ROUND from user ${user.id}`)
        await handleReadyForNextRound(matchId, user.id, socket, supabase)
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
        // Cleanup game state when all sockets disconnected
        cleanupGameState(matchId)
      }
    }
  }

  socket.onerror = (error) => {
    console.error(`[${matchId}] WebSocket error:`, error)
    console.error(`[${matchId}] WebSocket error details:`, {
      type: error?.type,
      target: error?.target,
      error: String(error)
    })
  }

  return response
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(`Internal server error: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
      headers: corsHeaders
    })
  }
})

