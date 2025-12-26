import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'
import type { MatchRow } from '@/types/schema'
import { mapRawToQuestion } from '@/utils/questionMapper'

interface ConnectionState {
  status: 'connecting' | 'connected' | 'both_connected' | 'playing' | 'results' | 'error' | 'match_finished'
  playerRole: 'player1' | 'player2' | null
  errorMessage: string | null
  question: any | null
  answerSubmitted: boolean
  waitingForOpponent: boolean
  resultsAcknowledged: boolean
  waitingForOpponentToAcknowledge: boolean
  allStepsComplete: boolean
  waitingForOpponentToCompleteSteps: boolean
  results: {
    player1_answer: number | null
    player2_answer: number | null
    correct_answer: number
    player1_correct: boolean
    player2_correct: boolean
    round_winner: string | null
    p1Score?: number
    p2Score?: number
    // V2 legacy: per-step results lived under payload.p1.steps
    // V3 (async segments): results live under payload.stepResults and include main/sub segments
    stepResults?: Array<{
      stepIndex: number
      marks?: number
      hasSubStep?: boolean
      mainCorrectAnswer?: number
      subCorrectAnswer?: number | null
      p1MainAnswerIndex?: number | null
      p2MainAnswerIndex?: number | null
      p1SubAnswerIndex?: number | null
      p2SubAnswerIndex?: number | null
      p1PartCorrect?: boolean
      p2PartCorrect?: boolean
      p1StepAwarded?: number
      p2StepAwarded?: number
      // Legacy v2 shape (still supported)
      correctAnswer?: number
      p1AnswerIndex?: number | null
      p2AnswerIndex?: number | null
      p1Marks?: number
      p2Marks?: number
    }>
    p1PartsCorrect?: number
    p2PartsCorrect?: number
    totalParts?: number
  } | null
  // Stage 3: Tug-of-war state (deprecated, kept for compatibility)
  roundNumber: number
  lastRoundWinner: string | null
  consecutiveWinsCount: number
  matchFinished: boolean
  matchWinner: string | null
  totalRounds: number
  // Timer state
  timerEndAt: string | null
  timeRemaining: number | null // seconds remaining
  // Step-based question state
  phase: 'question' | 'main_question' | 'steps' | 'result'
  // Step progression mode: in async mode, the server advances per-player and match_rounds must NOT override.
  stepProgressMode: 'shared' | 'async'
  currentStepIndex: number
  totalSteps: number
  mainQuestionEndsAt: string | null
  stepEndsAt: string | null
  mainQuestionTimeLeft: number | null
  stepTimeLeft: number | null
  subStepTimeLeft: number | null
  currentStep: any | null
  currentSegment: 'main' | 'sub'
  currentSubStepIndex: number
  currentSubStep: any | null
  // UX/debug: track when we auto-advance due to a timer (so it doesn't feel like a random desync)
  lastStepAdvanceReason: 'timeout' | null
  lastStepAdvanceAt: number | null
  // Match-level state (rounds system)
  currentRoundId: string | null
  currentRoundNumber: number
  targetRoundsToWin: number
  playerRoundWins: { [playerId: string]: number }
  matchOver: boolean
  matchWinnerId: string | null
  // Inter-round countdown (results -> next round)
  nextRoundCountdown: number | null
}

interface RoundStartEvent {
  type: 'ROUND_START'
  matchId: string
  roundId: string
  roundIndex: number
  phase: 'thinking' | 'main_question' | 'steps'
  targetRoundsToWin?: number
  question: any
  thinkingEndsAt?: string
  mainQuestionEndsAt?: string
  mainQuestionTimerSeconds?: number
  totalSteps?: number
}

/**
 * Minimal game connection hook
 * 
 * Only handles:
 * - WebSocket connection to game-ws
 * - JOIN_MATCH message
 * - Connection status tracking
 * 
 * @param match - The match row from matchmaking
 * @returns Connection state with status and player role
 */
export function useGame(match: MatchRow | null) {
  const [state, setState] = useState<ConnectionState>({
    status: 'connecting',
    playerRole: null,
    errorMessage: null,
    question: null,
    answerSubmitted: false,
    waitingForOpponent: false,
    resultsAcknowledged: false,
    waitingForOpponentToAcknowledge: false,
    allStepsComplete: false,
    waitingForOpponentToCompleteSteps: false,
    results: null,
    // Stage 3: Tug-of-war state (deprecated, kept for compatibility)
    roundNumber: 0,
    lastRoundWinner: null,
    consecutiveWinsCount: 0,
    matchFinished: false,
    matchWinner: null,
    totalRounds: 0,
    // Timer state
    timerEndAt: null,
    timeRemaining: null,
    // Step-based question state
    phase: 'question',
    stepProgressMode: 'shared',
    currentStepIndex: 0,
    totalSteps: 0,
    mainQuestionEndsAt: null,
    stepEndsAt: null,
    mainQuestionTimeLeft: null,
    stepTimeLeft: null,
    currentStep: null,
    currentSegment: 'main',
    currentSubStepIndex: 0,
    currentSubStep: null,
    subStepTimeLeft: null,
    lastStepAdvanceReason: null,
    lastStepAdvanceAt: null,
    // Match-level state (rounds system)
    currentRoundId: null,
    currentRoundNumber: 1,
    targetRoundsToWin: 3,
    playerRoundWins: {},
    matchOver: false,
    matchWinnerId: null,
    nextRoundCountdown: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const matchIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const lastVisibilityChangeRef = useRef<number>(0)
  const hasConnectedRef = useRef<boolean>(false)
  const pollingTimeoutRef = useRef<number | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)
  const multiStepPollingIntervalRef = useRef<number | null>(null)
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const matchRoundsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const currentRoundIdRef = useRef<string | null>(null)
  const localResultsVersionRef = useRef<number>(0)
  const processedRoundIdsRef = useRef<Set<string>>(new Set())
  const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false)

  // Shared function to apply results from payload (used by both Realtime and WS handlers)
  const applyResults = useCallback((payload: any) => {
    console.log('[useGame] applyResults called with payload:', payload)
    
    // Prevent duplicate processing using round_id
    const roundId = payload.round_id || payload.roundId
    if (roundId && processedRoundIdsRef.current.has(roundId)) {
      console.log('[useGame] Ignoring duplicate results for round_id:', roundId)
      return
    }
    if (roundId) {
      processedRoundIdsRef.current.add(roundId)
    }
    
    // Build results object from payload (handles both simple and multi-step modes)
    const mode = payload.mode || 'simple'
    const stepResults =
      mode === 'steps'
        ? (payload.stepResults ?? payload.p1?.steps ?? payload.p1?.stepResults)
        : undefined

    const results = {
      player1_answer: mode === 'simple' ? payload.p1?.answer ?? null : null,
      player2_answer: mode === 'simple' ? payload.p2?.answer ?? null : null,
      correct_answer: payload.correct_answer ?? 0,
      player1_correct: payload.p1?.correct ?? false,
      player2_correct: payload.p2?.correct ?? false,
      round_winner: payload.round_winner ?? null,
      p1Score: payload.p1?.total ?? 0,
      p2Score: payload.p2?.total ?? 0,
      stepResults,
      p1PartsCorrect: payload.p1_parts_correct ?? payload.p1PartsCorrect ?? undefined,
      p2PartsCorrect: payload.p2_parts_correct ?? payload.p2PartsCorrect ?? undefined,
      totalParts: payload.total_parts ?? payload.totalParts ?? undefined,
      computedAt: payload.computed_at ?? payload.computedAt ?? undefined,
      round_id: roundId // Store round_id in results for reference
    }

    setState(prev => {
      // Don't update if already showing results with same or newer version
      if (prev.status === 'results' && payload.round_number && payload.round_number < prev.currentRoundNumber) {
        console.log('[useGame] Ignoring older round results')
        return prev
      }

      const mergedRoundWins = payload.player_round_wins
        ? { ...prev.playerRoundWins, ...payload.player_round_wins }
        : { ...prev.playerRoundWins }

      // Guardrail: if a round is a DRAW but the backend didn't increment wins,
      // warn loudly (this usually means the draw-awards-both migration isn't applied on the DB).
      if ((payload.round_winner ?? null) === null && payload.player_round_wins) {
        const unchanged = Object.entries(payload.player_round_wins).every(([playerId, wins]) => {
          const prevWins = prev.playerRoundWins?.[playerId] ?? 0
          return prevWins === wins
        })
        if (unchanged) {
          console.warn(
            '[useGame] ⚠️ Draw round detected but player_round_wins did not increase. Make sure the latest DB migrations are applied.'
          )
        }
      }

      return {
        ...prev,
        status: 'results' as const,
        phase: 'result' as const,
        results,
        waitingForOpponent: false,
        resultsAcknowledged: false,
        waitingForOpponentToAcknowledge: false,
        allStepsComplete: false,
        waitingForOpponentToCompleteSteps: false,
        currentRoundNumber: payload.round_number ?? prev.currentRoundNumber,
        targetRoundsToWin:
          payload.target_rounds_to_win ??
          payload.targetRoundsToWin ??
          prev.targetRoundsToWin,
        playerRoundWins: mergedRoundWins,
        matchOver: payload.match_over ?? false,
        matchWinnerId: payload.match_winner_id ?? null,
        // Auto next round countdown (10s) unless match is over
        nextRoundCountdown: (payload.match_over ?? false) ? null : 10
      }
    })

    // Clear polling if active
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    console.log('[useGame] ✅ State updated with results from applyResults')
  }, [])

  // Listen for polling-detected results (fallback if WS message missed)
  useEffect(() => {
    const handlePollingResults = (event: CustomEvent) => {
      const detail = event.detail
      console.log('[useGame] Polling detected results - updating state manually')
      setState(prev => ({
        ...prev,
        status: 'results',
        results: {
          player1_answer: detail.player1_answer,
          player2_answer: detail.player2_answer,
          correct_answer: detail.correct_answer,
          player1_correct: detail.player1_correct,
          player2_correct: detail.player2_correct,
          round_winner: detail.round_winner
        },
        waitingForOpponent: false
      }))
    }

    window.addEventListener('polling-results-detected', handlePollingResults as EventListener)
    return () => {
      window.removeEventListener('polling-results-detected', handlePollingResults as EventListener)
    }
  }, [])

  // Multi-step safety net: if we finished all parts but results didn't arrive (WS/Realtime),
  // poll matches.results_payload until it appears.
  useEffect(() => {
    if (!match?.id) return

    const shouldPoll =
      state.status === 'playing' &&
      state.phase === 'steps' &&
      state.allStepsComplete &&
      !state.results

    if (!shouldPoll) {
      if (multiStepPollingIntervalRef.current) {
        clearInterval(multiStepPollingIntervalRef.current)
        multiStepPollingIntervalRef.current = null
      }
      return
    }

    if (multiStepPollingIntervalRef.current) return

    let attempts = 0
    const maxAttempts = 30 // ~60 seconds at 2s interval

    const poll = async () => {
      attempts++
      try {
        const { data: matchRow, error } = await supabase
          .from('matches')
          .select('results_payload, results_version, results_round_id, current_round_id')
          .eq('id', match.id)
          .single() as { data: any; error: any }

        if (error || !matchRow) return

        const hasPayload = matchRow.results_payload != null
        const roundMatch = matchRow.results_round_id === matchRow.current_round_id
        const version = matchRow.results_version ?? 0

        if (hasPayload && roundMatch && version > localResultsVersionRef.current) {
          console.log('[useGame] ✅ Multi-step polling fallback found results_payload; applying...')
          localResultsVersionRef.current = version
          applyResults(matchRow.results_payload)
        }

        if (attempts >= maxAttempts) {
          console.warn('[useGame] ⚠️ Multi-step polling fallback timed out (no results_payload)')
          if (multiStepPollingIntervalRef.current) {
            clearInterval(multiStepPollingIntervalRef.current)
            multiStepPollingIntervalRef.current = null
          }
        }
      } catch (err) {
        console.error('[useGame] Multi-step polling fallback error:', err)
      }
    }

    poll()
    multiStepPollingIntervalRef.current = window.setInterval(poll, 2000)

    return () => {
      if (multiStepPollingIntervalRef.current) {
        clearInterval(multiStepPollingIntervalRef.current)
        multiStepPollingIntervalRef.current = null
      }
    }
  }, [match?.id, state.status, state.phase, state.allStepsComplete, state.results, applyResults])

  // Timer countdown effect (for single-step questions)
  useEffect(() => {
    if (!state.timerEndAt || state.status !== 'playing' || state.answerSubmitted || state.phase !== 'question') {
      setState(prev => ({ ...prev, timeRemaining: null }))
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const endTime = new Date(state.timerEndAt!).getTime()
      const remaining = Math.max(0, Math.round((endTime - now) / 1000))
      
      setState(prev => ({ ...prev, timeRemaining: remaining }))
      
      if (remaining <= 0) {
        // Timer expired - server will handle timeout
        return
      }
    }

    // Update immediately
    updateTimer()

    // Update every second
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [state.timerEndAt, state.status, state.answerSubmitted, state.phase])

  // Main question timer countdown effect
  useEffect(() => {
    if (!state.mainQuestionEndsAt || state.phase !== 'main_question') {
      setState(prev => ({ ...prev, mainQuestionTimeLeft: null }))
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const endTime = new Date(state.mainQuestionEndsAt!).getTime()
      const remaining = Math.max(0, Math.round((endTime - now) / 1000))
      
      setState(prev => ({ ...prev, mainQuestionTimeLeft: remaining }))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [state.mainQuestionEndsAt, state.phase])

  // Step timer countdown effect
  useEffect(() => {
    if (!state.stepEndsAt || state.phase !== 'steps') {
      setState(prev => ({ ...prev, stepTimeLeft: null, subStepTimeLeft: null }))
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const endTime = new Date(state.stepEndsAt!).getTime()
      const remaining = Math.max(0, Math.round((endTime - now) / 1000))
      
      setState(prev => ({
        ...prev,
        stepTimeLeft: remaining,
        subStepTimeLeft: prev.currentSegment === 'sub' ? remaining : null
      }))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [state.stepEndsAt, state.phase, state.currentSegment])

  useEffect(() => {
    if (!match) {
        setState(prev => ({
          ...prev,
          status: 'connecting',
          playerRole: null,
          errorMessage: null
        }))
      return
    }

    const connect = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
      setState(prev => ({
        ...prev,
        status: 'error' as const,
        playerRole: null,
        errorMessage: 'Not authenticated'
      }))
          return
        }

        userIdRef.current = user.id
        matchIdRef.current = match.id

        // Verify user is part of match
        if (match.player1_id !== user.id && match.player2_id !== user.id) {
          setState(prev => ({
            ...prev,
            status: 'error',
            playerRole: null,
            errorMessage: 'You are not part of this match'
          }))
          return
        }

        // Get session token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.access_token) {
          setState(prev => ({
            ...prev,
            status: 'error' as const,
            playerRole: null,
            errorMessage: 'No session token'
          }))
          return
        }

        // Build WebSocket URL
        if (!SUPABASE_URL) {
          console.error('[useGame] ❌ SUPABASE_URL is not defined')
          setState(prev => ({
            ...prev,
            status: 'error' as const,
            playerRole: null,
            errorMessage: 'Missing SUPABASE_URL'
          }))
          return
        }

        const wsUrl = `${SUPABASE_URL.replace('http', 'ws')}/functions/v1/game-ws?token=${session.access_token}&match_id=${match.id}`
        console.log('[useGame] Connecting to:', wsUrl)

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[useGame] WebSocket connected')
          hasConnectedRef.current = false
          setIsWebSocketConnected(true)
          setState(prev => ({
            ...prev,
            status: 'connecting',
            errorMessage: null
          }))

          // Send JOIN_MATCH message
          const joinMessage = {
            type: 'JOIN_MATCH',
            match_id: match.id,
            player_id: user.id
          }
          console.log('[useGame] Sending JOIN_MATCH:', joinMessage)
          ws.send(JSON.stringify(joinMessage))

          // Heartbeat to keep connection alive
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current)
            heartbeatRef.current = null
          }
          heartbeatRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'PING' }))
            }
          }, 25000) as unknown as number
        }

        ws.onmessage = (event) => {
          try {
            console.log('[useGame] Raw message received:', event.data)
            const message = JSON.parse(event.data)
            console.log('[useGame] Parsed message:', message)

            // Handle lowercase "connected" - just ignore it (it's initial connection confirmation)
            if (message.type === 'connected') {
              console.log('[useGame] Initial connection confirmation received (ignoring)')
              return
            }

            // Handle PONG messages (heartbeat responses)
            if (message.type === 'PONG') {
              // Silently ignore - just heartbeat
              return
            }

            if (message.type === 'CONNECTED') {
              console.log('[useGame] CONNECTED message received, updating state')
              hasConnectedRef.current = true
              setState(prev => ({
                ...prev,
                status: 'connected',
                playerRole: message.player,
                errorMessage: null
              }))
            } else if (message.type === 'BOTH_CONNECTED') {
              console.log('[useGame] BOTH_CONNECTED message received - both players ready!')
              setState(prev => ({
                ...prev,
                status: 'both_connected',
                errorMessage: null
              }))
            } else if (message.type === 'QUESTION_RECEIVED') {
              console.log('[useGame] QUESTION_RECEIVED message received')
              try {
                const mappedQuestion = mapRawToQuestion(message.question)
                const timerEndAt = (message as any).timer_end_at || null
                setState(prev => ({
                  ...prev,
                  status: 'playing',
                  phase: 'question', // Ensure phase is set so question displays
                  question: mappedQuestion,
                  errorMessage: null,
                  timerEndAt: timerEndAt,
                  answerSubmitted: false,
                  waitingForOpponent: false,
                  results: null,
                  nextRoundCountdown: null
                }))
              } catch (error) {
                console.error('[useGame] Error mapping question:', error)
                setState(prev => ({
                  ...prev,
                  status: 'error',
                  errorMessage: 'Failed to process question'
                }))
              }
            } else if (message.type === 'ROUND_START') {
              console.log('[useGame] ROUND_START message received - game starting!', message)
              // Clear processed round IDs and results when new round starts
              processedRoundIdsRef.current.clear()
              const roundStartEvent = message as any as RoundStartEvent
              const roundIdFromMessage = roundStartEvent.roundId

              // Only trust roundId if it differs from the match id (canonical match_rounds.id)
              if (roundIdFromMessage && roundIdFromMessage !== match?.id) {
                currentRoundIdRef.current = roundIdFromMessage
              }

              const resolvedRoundId = roundIdFromMessage && roundIdFromMessage !== match?.id
                ? roundIdFromMessage
                : state.currentRoundId || currentRoundIdRef.current

              if (roundStartEvent.phase === 'main_question' || roundStartEvent.phase === 'steps') {
                // Multi-step question (async segments may start directly in steps)
                setState(prev => ({
                  ...prev,
                  status: 'playing',
                  phase: roundStartEvent.phase === 'steps' ? 'steps' : 'main_question',
                  stepProgressMode: 'shared',
                  question: roundStartEvent.question,
                  mainQuestionEndsAt: (roundStartEvent as any).mainQuestionEndsAt || null,
                  totalSteps: (roundStartEvent as any).totalSteps || 0,
                  currentStepIndex: 0,
                  currentSegment: 'main',
                  currentSubStepIndex: 0,
                  currentSubStep: null,
                  subStepTimeLeft: null,
                  lastStepAdvanceReason: null,
                  lastStepAdvanceAt: null,
                  // Match-level info (used by UI scoreboard)
                  currentRoundId: resolvedRoundId ?? prev.currentRoundId,
                  currentRoundNumber: Number.isFinite(roundStartEvent.roundIndex)
                    ? roundStartEvent.roundIndex + 1
                    : prev.currentRoundNumber,
                  targetRoundsToWin: roundStartEvent.targetRoundsToWin ?? prev.targetRoundsToWin,
                  answerSubmitted: false,
                  waitingForOpponent: false,
                  resultsAcknowledged: false,
                  waitingForOpponentToAcknowledge: false,
                  allStepsComplete: false,
                  waitingForOpponentToCompleteSteps: false,
                  results: null, // Clear results when new round starts
                  nextRoundCountdown: null,
                  errorMessage: null
                }))
              } else {
                // Single-step question - existing flow
                setState(prev => ({
                  ...prev,
                  status: 'playing',
                  phase: 'question',
                  stepProgressMode: 'shared',
                  question: roundStartEvent.question,
                  currentRoundId: resolvedRoundId ?? prev.currentRoundId,
                  currentRoundNumber: Number.isFinite(roundStartEvent.roundIndex)
                    ? roundStartEvent.roundIndex + 1
                    : prev.currentRoundNumber,
                  targetRoundsToWin: roundStartEvent.targetRoundsToWin ?? prev.targetRoundsToWin,
                  resultsAcknowledged: false,
                  waitingForOpponentToAcknowledge: false,
                  allStepsComplete: false,
                  waitingForOpponentToCompleteSteps: false,
                  results: null, // Clear results when new round starts
                  nextRoundCountdown: null,
                  errorMessage: null
                }))
              }
            } else if (message.type === 'PHASE_CHANGE') {
              console.log('[useGame] PHASE_CHANGE message received', message)
              if (message.phase === 'steps') {
                setState(prev => {
                  const nextStepIndex = message.stepIndex ?? message.currentStepIndex ?? 0
                  const nextSegment = (message.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub'
                  const rawSubIdx = Number.isFinite((message as any).subStepIndex) ? (message as any).subStepIndex : 0
                  const nextSubStepIndex = nextSegment === 'sub' ? rawSubIdx : 0

                  const prevKey = `${prev.currentStepIndex}|${prev.currentSegment}|${prev.currentSubStepIndex}`
                  const nextKey = `${nextStepIndex}|${nextSegment}|${nextSubStepIndex}`
                  const segmentChanged = prev.phase === 'steps' && prevKey !== nextKey

                  // Detect likely timeout-driven advancement: segment changed while we had not submitted,
                  // and the prior segment deadline has passed.
                  const nowMs = Date.now()
                  const prevEndsAtMs = prev.stepEndsAt ? new Date(prev.stepEndsAt).getTime() : null
                  const likelyTimedOut =
                    segmentChanged &&
                    !prev.answerSubmitted &&
                    prevEndsAtMs !== null &&
                    nowMs >= (prevEndsAtMs - 250) // allow small client/server skew

                  // Only update the "advance reason" when we actually moved to a different segment.
                  const nextAdvanceReason = segmentChanged ? (likelyTimedOut ? 'timeout' : null) : prev.lastStepAdvanceReason
                  const nextAdvanceAt = segmentChanged ? (likelyTimedOut ? nowMs : null) : prev.lastStepAdvanceAt

                  const nextProgressMode =
                    (message as any).progressMode === 'async'
                      ? 'async'
                      : (message as any).progressMode === 'shared'
                        ? 'shared'
                        : prev.stepProgressMode

                  return {
                    ...prev,
                    phase: 'steps',
                    stepProgressMode: nextProgressMode,
                    currentStepIndex: nextStepIndex,
                    totalSteps: message.totalSteps ?? prev.totalSteps,
                    stepEndsAt: message.stepEndsAt || null,
                    currentStep: message.currentStep || null,
                    currentSegment: nextSegment,
                    currentSubStepIndex: nextSubStepIndex,
                    currentSubStep: nextSegment === 'sub' ? (message.currentStep || null) : null,
                    subStepTimeLeft: null,
                    answerSubmitted: false,
                    waitingForOpponent: false,
                    allStepsComplete: false,
                    waitingForOpponentToCompleteSteps: false,
                    lastStepAdvanceReason: nextAdvanceReason,
                    lastStepAdvanceAt: nextAdvanceAt
                  }
                })
              } else {
                // Other phase changes (choosing, result)
                setState(prev => ({
                  ...prev,
                  phase: message.phase === 'choosing' ? 'question' : 'result',
                  currentStepIndex: message.currentStepIndex ?? prev.currentStepIndex,
                  totalSteps: message.totalSteps ?? prev.totalSteps
                }))
              }
            } else if (message.type === 'STEP_ANSWER_RECEIVED') {
              console.log('[useGame] STEP_ANSWER_RECEIVED message received', message)
              setState(prev => ({
                ...prev,
                answerSubmitted: true
                // Don't set waitingForOpponent during steps - steps should progress without waiting
              }))
            } else if (message.type === 'ANSWER_SUBMITTED') {
              console.log('[useGame] ANSWER_SUBMITTED message received')
              setState(prev => ({
                ...prev,
                answerSubmitted: true,
                waitingForOpponent: !message.both_answered
              }))
            } else if (message.type === 'ANSWER_RECEIVED') {
              console.log('[useGame] ANSWER_RECEIVED message received - opponent answered')
              setState(prev => ({
                ...prev,
                waitingForOpponent: true
              }))
            } else if (message.type === 'RESULTS_RECEIVED') {
              console.log('[useGame] RESULTS_RECEIVED message received (WebSocket fast-path)', message)
              
              // WebSocket fast-path - but check if we already have results from Realtime
              // If results_version is provided, check against local version
              const msg = message as any
              
              // Strict deduplication: Check version first
              if (msg.results_version !== undefined && msg.results_version <= localResultsVersionRef.current) {
                console.log('[useGame] Ignoring WS RESULTS_RECEIVED - already have same/newer version')
                return
              }

              // Also check round_id deduplication (handles same version from different sources)
              const roundId = msg.results_payload?.round_id || msg.round_id
              if (roundId && processedRoundIdsRef.current.has(roundId)) {
                console.log('[useGame] Ignoring WS RESULTS_RECEIVED - already processed this round_id:', roundId)
                return
              }

              // Accept: Update version tracker BEFORE applying (for strict version check)
              // But let applyResults handle roundId deduplication internally
              if (msg.results_payload) {
                if (msg.results_version !== undefined) {
                  localResultsVersionRef.current = msg.results_version
                }
                // Don't add roundId here - applyResults will handle it
                applyResults(msg.results_payload)
              } else {
                // Legacy WS format - construct payload manually
                const payload = {
                  mode: 'simple',
                  round_id: null,
                  round_number: msg.roundNumber ?? state.currentRoundNumber,
                  correct_answer: msg.correct_answer ?? 0,
                  p1: {
                    answer: msg.player1_answer ?? null,
                    correct: msg.player1_correct ?? false,
                    score_delta: 0,
                    total: msg.playerRoundWins?.[Object.keys(msg.playerRoundWins || {})[0]] ?? 0
                  },
                  p2: {
                    answer: msg.player2_answer ?? null,
                    correct: msg.player2_correct ?? false,
                    score_delta: 0,
                    total: msg.playerRoundWins?.[Object.keys(msg.playerRoundWins || {})[1]] ?? 0
                  },
                  round_winner: msg.round_winner ?? null,
                  computed_at: new Date().toISOString()
                }
                applyResults(payload)
              }
            } else if (message.type === 'ALL_STEPS_COMPLETE_WAITING') {
              console.log('[useGame] ALL_STEPS_COMPLETE_WAITING message received', message)
              const msg = message as any
              // Determine player role from match data (most reliable)
              const currentUserId = userIdRef.current
              const isPlayer1 = match?.player1_id === currentUserId
              const myComplete = isPlayer1 ? msg.p1Complete : msg.p2Complete
              const oppComplete = isPlayer1 ? msg.p2Complete : msg.p1Complete
              
              console.log('[useGame] 🔍 DEBUG: ALL_STEPS_COMPLETE_WAITING processing', {
                currentUserId,
                matchP1Id: match?.player1_id,
                matchP2Id: match?.player2_id,
                playerRole: state.playerRole,
                isPlayer1,
                p1Complete: msg.p1Complete,
                p2Complete: msg.p2Complete,
                myComplete,
                oppComplete,
                willSetWaiting: myComplete && !oppComplete
              })
              
              setState(prev => ({
                ...prev,
                allStepsComplete: myComplete,
                waitingForOpponentToCompleteSteps: myComplete && !oppComplete
              }))
            } else if (message.type === 'READY_FOR_NEXT_ROUND') {
              console.log('[useGame] READY_FOR_NEXT_ROUND message received', message)
              setState(prev => ({
                ...prev,
                waitingForOpponentToAcknowledge: message.waitingForOpponent ?? false
              }))
            } else if (message.type === 'ROUND_STARTED') {
              console.log('[useGame] ROUND_STARTED message received - new round starting')
              // Clear processed round IDs to allow new round results
              processedRoundIdsRef.current.clear()
              setState(prev => ({
                ...prev,
                status: 'playing',
                phase: 'question',
                stepProgressMode: 'shared',
                answerSubmitted: false,
                waitingForOpponent: false,
                resultsAcknowledged: false,
                waitingForOpponentToAcknowledge: false,
                allStepsComplete: false,
                waitingForOpponentToCompleteSteps: false,
                results: null, // Clear results when new round starts
                roundNumber: message.round_number || 0,
                lastRoundWinner: message.last_round_winner,
                consecutiveWinsCount: message.consecutive_wins_count || 0,
                timerEndAt: null, // Will be set when QUESTION_RECEIVED arrives
                timeRemaining: null,
                nextRoundCountdown: null,
                // Reset step state
                currentStepIndex: 0,
                totalSteps: 0,
                mainQuestionEndsAt: null,
                stepEndsAt: null,
                mainQuestionTimeLeft: null,
                stepTimeLeft: null,
                subStepTimeLeft: null,
                currentStep: null,
                currentSegment: 'main',
                currentSubStepIndex: 0,
                currentSubStep: null
              }))
            } else if (message.type === 'MATCH_FINISHED') {
              console.log('[useGame] MATCH_FINISHED message received')
              // Clear processed round IDs and results when match ends
              processedRoundIdsRef.current.clear()
              setState(prev => ({
                ...prev,
                status: 'match_finished',
                matchFinished: true,
                matchWinner: message.winner_id,
                totalRounds: message.total_rounds || 0,
                answerSubmitted: false,
                waitingForOpponent: false,
                resultsAcknowledged: false,
                waitingForOpponentToAcknowledge: false,
                results: null, // Clear results when match ends
                nextRoundCountdown: null
              }))
            } else if (message.type === 'GAME_ERROR') {
              console.error('[useGame] GAME_ERROR:', message.message)
              setState(prev => ({
                ...prev,
                status: 'error',
                errorMessage: message.message
              }))
            } else {
              console.warn('[useGame] Unknown message type:', message.type, message)
            }
          } catch (error) {
            console.error('[useGame] Error parsing message:', error, event.data)
            setState(prev => ({
              ...prev,
              status: 'error',
              errorMessage: 'Error parsing server message'
            }))
          }
        }

        ws.onerror = (error) => {
          console.error('[useGame] WebSocket error:', error)
          setState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: 'WebSocket connection error'
          }))
        }

        ws.onclose = () => {
          // Clear polling on WebSocket close
          setIsWebSocketConnected(false)
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current)
            pollingTimeoutRef.current = null
          }
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          console.log('[useGame] WebSocket closed')
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current)
            heartbeatRef.current = null
          }
          setState(prev => {
            if (prev.status !== 'error') {
              return {
                ...prev,
                status: 'connecting'
              }
            }
            return prev
          })
        }
      } catch (error: any) {
        console.error('[useGame] Connection error:', error)
        setState(prev => ({
          ...prev,
          status: 'error',
          playerRole: null,
          errorMessage: error.message || 'Failed to connect'
        }))
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
        setIsWebSocketConnected(false)
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      // Cleanup polling
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [match?.id])

  // On mount: Initial SELECT to check for existing results (handles reload/late join)
  useEffect(() => {
    if (!match?.id) return

    const checkExistingResults = async () => {
      try {
        const { data: matchData, error } = await supabase
          .from('matches')
          .select('results_computed_at, results_payload, results_version, results_round_id, current_round_id, current_round_number, status, winner_id')
          .eq('id', match.id)
          .single() as { data: any; error: any }

        if (error || !matchData) return

        // Track canonical current round identity (used for match_rounds Realtime sync)
        if (matchData.current_round_id) {
          currentRoundIdRef.current = matchData.current_round_id
        }
        setState(prev => ({
          ...prev,
          currentRoundId: matchData.current_round_id ?? prev.currentRoundId,
          currentRoundNumber: matchData.current_round_number ?? prev.currentRoundNumber
        }))

        // If results already computed, show them immediately
        if (matchData.results_computed_at && matchData.results_payload) {
          console.log('[useGame] Found existing results on mount, applying...')
          localResultsVersionRef.current = matchData.results_version || 0
          
          // Validate before applying
          if (
            matchData.results_payload &&
            matchData.results_round_id === matchData.current_round_id
          ) {
            applyResults(matchData.results_payload)
          }
        }
      } catch (err) {
        console.error('[useGame] Error checking existing results on mount:', err)
      }
    }

    checkExistingResults()
  }, [match?.id, applyResults])

  // Realtime subscription for matches table (primary results delivery mechanism)
  useEffect(() => {
    if (!match?.id) return

    console.log('[useGame] Setting up Realtime subscription for match:', match.id)

    const channel = supabase
      .channel(`match:${match.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${match.id}`
        // Note: Supabase automatically includes old record in UPDATE events
        // payload.old and payload.new both available
      }, (payload: any) => {
        console.log('[useGame] Realtime UPDATE received:', {
          old: payload.old,
          new: payload.new
        })

        // Handle results updates (handles both NULL → NOT NULL and out-of-order events)
        const newPayload = payload.new

        // Track canonical current round identity for match_rounds Realtime sync
        if (newPayload?.current_round_id && newPayload.current_round_id !== currentRoundIdRef.current) {
          currentRoundIdRef.current = newPayload.current_round_id
          setState(prev => {
            // If the DB advances the round while we are still on results, we may have missed
            // the WS broadcast (Edge instances are not shared). Kick a re-sync by forcing
            // the READY_FOR_NEXT_ROUND auto-send path (nextRoundCountdown === 0).
            const shouldKickNextRound =
              prev.status === 'results' &&
              !prev.matchOver

            return ({
              ...prev,
              currentRoundId: newPayload.current_round_id,
              currentRoundNumber: newPayload.current_round_number ?? prev.currentRoundNumber,
              nextRoundCountdown: shouldKickNextRound ? 0 : null,
              resultsAcknowledged: shouldKickNextRound ? false : prev.resultsAcknowledged,
              waitingForOpponentToAcknowledge: shouldKickNextRound ? false : prev.waitingForOpponentToAcknowledge,
              // Clear step-phase state; it will be rehydrated from match_rounds updates
              mainQuestionEndsAt: null,
              stepEndsAt: null,
              mainQuestionTimeLeft: null,
              stepTimeLeft: null,
              currentStepIndex: 0,
              currentStep: null,
              answerSubmitted: false,
              waitingForOpponent: false,
              allStepsComplete: false,
              waitingForOpponentToCompleteSteps: false
            })
          })
        } else if (newPayload?.current_round_number != null) {
          // Keep round number in sync even if round_id didn't change (rare but safe)
          setState(prev => (
            newPayload.current_round_number === prev.currentRoundNumber
              ? prev
              : { ...prev, currentRoundNumber: newPayload.current_round_number }
          ))
        }
        const oldVersion = payload.old?.results_version ?? 0
        const newVersion = newPayload.results_version ?? 0

        // Accept results UPDATE if:
        // 1. results_payload != null
        // 2. results_version > local version (strict > prevents duplicates)
        // 3. results_round_id === current_round_id OR current_round_id is null (allow first round)
        const hasPayload = newPayload.results_payload != null
        const versionCheck = newVersion > localResultsVersionRef.current
        const roundMatch = newPayload.results_round_id === newPayload.current_round_id || newPayload.current_round_id === null
        if (
          hasPayload &&
          versionCheck &&
          roundMatch
        ) {
          console.log('[useGame] ✅ Accepting Realtime results (validated):', {
            version: newVersion,
            local_version: localResultsVersionRef.current,
            round_id: newPayload.results_round_id,
            current_round_id: newPayload.current_round_id,
            payload: newPayload.results_payload
          })
          localResultsVersionRef.current = newVersion
          applyResults(newPayload.results_payload)
        } else {
          // Log detailed rejection reason
          console.warn('[useGame] ⚠️ Ignoring Realtime results:', {
            hasPayload: newPayload.results_payload != null,
            versionCheck: `${newVersion} >= ${localResultsVersionRef.current}`,
            roundMatch: `${newPayload.results_round_id} === ${newPayload.current_round_id} || ${newPayload.current_round_id} === null`,
            results_version: newVersion,
            local_version: localResultsVersionRef.current,
            results_round_id: newPayload.results_round_id,
            current_round_id: newPayload.current_round_id,
            payload: newPayload.results_payload
          })
        }
      })
      .subscribe((status) => {
        console.log('[useGame] Realtime subscription status:', status)
      })

    realtimeChannelRef.current = channel

    return () => {
      console.log('[useGame] Cleaning up Realtime subscription')
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
        realtimeChannelRef.current = null
      }
    }
  }, [match?.id, applyResults])

  const applyRoundRow = useCallback((roundRow: any) => {
    if (!roundRow) return
    setState(prev => {
      // Only apply updates for the canonical current round (defense-in-depth)
      const canonicalRoundId = prev.currentRoundId || currentRoundIdRef.current
      if (canonicalRoundId && roundRow.id && roundRow.id !== canonicalRoundId) return prev

      // Only apply match_rounds-driven phase if we are in (or expecting) multi-step flow.
      // Single-step rounds also use match_rounds.status='main', but the UI phase should remain 'question'.
      const isMultiStepContext = prev.totalSteps > 0 || prev.phase === 'main_question' || prev.phase === 'steps'
      if (!isMultiStepContext) return prev

      // Async per-player progression is driven by WebSocket PHASE_CHANGE + progress RPCs.
      // match_rounds is match-scoped and cannot represent per-player stepIndex/segment, so ignore it.
      if (prev.stepProgressMode === 'async') return prev

      const status = roundRow.status
      if (status === 'main') {
        const nextEndsAt = roundRow.main_question_ends_at ?? prev.mainQuestionEndsAt
        return {
          ...prev,
          phase: 'main_question',
          mainQuestionEndsAt: nextEndsAt,
          // Clear step-specific state
          stepEndsAt: null,
          stepTimeLeft: null,
          currentStepIndex: 0,
          currentStep: null,
          answerSubmitted: false,
          waitingForOpponent: false,
          allStepsComplete: false,
          waitingForOpponentToCompleteSteps: false
        }
      }

      if (status === 'steps') {
        const nextStepIndex = typeof roundRow.current_step_index === 'number' ? roundRow.current_step_index : 0
        const nextStepEndsAt = roundRow.step_ends_at ?? prev.stepEndsAt
        const inferredTotalSteps = prev.totalSteps || (Array.isArray(prev.question?.steps) ? prev.question.steps.length : 0)
        const derivedStep = Array.isArray(prev.question?.steps) ? prev.question.steps[nextStepIndex] : null
        const stepChanged = prev.phase !== 'steps' || nextStepIndex !== prev.currentStepIndex

        // Dedup: if we already have this step index and endsAt, no update needed
        if (!stepChanged && nextStepEndsAt === prev.stepEndsAt) return prev

        return {
          ...prev,
          phase: 'steps',
          totalSteps: inferredTotalSteps,
          currentStepIndex: nextStepIndex,
          stepEndsAt: nextStepEndsAt,
          currentStep: derivedStep ?? prev.currentStep,
          answerSubmitted: stepChanged ? false : prev.answerSubmitted,
          waitingForOpponent: false,
          allStepsComplete: false,
          waitingForOpponentToCompleteSteps: false
        }
      }

      return prev
    })
  }, [])

  // Realtime subscription for match_rounds (DB-authoritative phase + step progression)
  useEffect(() => {
    if (!match?.id) return

    const channel = supabase
      .channel(`match_rounds:${match.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_rounds',
        filter: `match_id=eq.${match.id}`
      }, (payload: any) => {
        applyRoundRow(payload.new)
      })
      .subscribe((status) => {
        console.log('[useGame] match_rounds subscription status:', status)
      })

    matchRoundsChannelRef.current = channel

    return () => {
      if (matchRoundsChannelRef.current) {
        supabase.removeChannel(matchRoundsChannelRef.current)
        matchRoundsChannelRef.current = null
      }
    }
  }, [match?.id, applyRoundRow])

  // Fetch current round row on round changes (initial hydration; Realtime delivers subsequent updates)
  useEffect(() => {
    if (!match?.id) return
    const roundId = state.currentRoundId || currentRoundIdRef.current
    if (!roundId) return

    const fetchInitialRoundRow = async () => {
      try {
        const { data, error } = await supabase
          .from('match_rounds')
          .select('id, status, current_step_index, step_ends_at, main_question_ends_at')
          .eq('id', roundId)
          .single() as { data: any; error: any }

        if (error || !data) return
        applyRoundRow(data)
      } catch (err) {
        console.error('[useGame] Error fetching match_rounds initial row:', err)
      }
    }

    fetchInitialRoundRow()
  }, [match?.id, state.currentRoundId, applyRoundRow])

  // If we enter steps phase before the question payload is present, backfill currentStep once question arrives.
  useEffect(() => {
    if (state.phase !== 'steps') return
    if (!state.question || !Array.isArray(state.question.steps)) return

    const step = state.question.steps[state.currentStepIndex]
    if (!step) return

    setState(prev => {
      // Backfill only: if match_rounds update arrived before question payload, currentStep may be null.
      if (prev.currentStep) return prev
      if (prev.phase !== 'steps') return prev
      if (prev.currentStepIndex !== state.currentStepIndex) return prev
      return { ...prev, currentStep: step }
    })
  }, [state.phase, state.question, state.currentStepIndex])

  // Visibility-based lightweight resync
  useEffect(() => {
    const handleVisibility = () => {
      // Only act when tab becomes visible (not on initial load or when hiding)
      if (document.visibilityState !== 'visible') {
        lastVisibilityChangeRef.current = Date.now()
        return
      }

      const now = Date.now()
      // Ignore if this is the initial visibility (page load) or too soon after last change
      if (lastVisibilityChangeRef.current === 0 || now - lastVisibilityChangeRef.current < 1000) {
        lastVisibilityChangeRef.current = now
        return
      }

      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      if (!matchIdRef.current || !userIdRef.current) return

      // Only resync if we're not already in a playing state (to avoid interrupting active rounds)
      // But allow resync if we're stuck in connecting/connected state
      const currentState = state.status
      if (currentState === 'playing' || currentState === 'results' || currentState === 'match_finished') {
        // Already playing - don't resync, just update timers from EndsAt
        console.log('[useGame] Tab visible but already playing - skipping resync')
        return
      }

      // Only resync if we've actually connected before (avoid resync during initial connection)
      if (!hasConnectedRef.current) {
        console.log('[useGame] Tab visible but not yet connected - skipping resync')
        return
      }

      const joinMessage = {
        type: 'JOIN_MATCH',
        match_id: matchIdRef.current,
        player_id: userIdRef.current
      }
      console.log('[useGame] Visibility resync - re-sending JOIN_MATCH (status:', currentState, ')')
      ws.send(JSON.stringify(joinMessage))
      lastVisibilityChangeRef.current = now
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [state.status])

  const submitAnswer = useCallback((answerIndex: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[useGame] WebSocket not connected')
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'WebSocket not connected'
      }))
      return
    }

    setState(prev => {
      if (prev.answerSubmitted) {
        console.warn('[useGame] Answer already submitted')
        return prev
      }

      // Route based on current phase
      if (prev.phase === 'steps') {
        // Segment-based answer (async: main/sub)
        const submitMessage = {
          type: 'SUBMIT_SEGMENT_ANSWER',
          stepIndex: prev.currentStepIndex,
          segment: prev.currentSegment,
          answerIndex: answerIndex
        }
        console.log('[useGame] Sending SUBMIT_SEGMENT_ANSWER:', submitMessage)
        ws.send(JSON.stringify(submitMessage))
      } else {
        // Single-step answer
        // Single-step rounds can be True/False or MCQ. Accept A-F (0-5) based on option count.
        const optionCount = Array.isArray(prev.question?.steps?.[0]?.options)
          ? prev.question.steps[0].options.length
          : 4
        const maxIndex = Math.max(0, Math.min(5, optionCount - 1))
        if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > maxIndex) {
          console.error('[useGame] Invalid answer index (expected 0-' + maxIndex + '):', answerIndex)
          return prev
        }
        const submitMessage = {
          type: 'SUBMIT_ANSWER',
          answer: answerIndex
        }
        console.log('[useGame] Sending SUBMIT_ANSWER:', submitMessage)
        ws.send(JSON.stringify(submitMessage))
        
        // V2: Start polling fallback (2s timeout, then poll every 1s)
        if (matchIdRef.current) {
          // Clear any existing polling
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current)
            pollingTimeoutRef.current = null
          }
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          
          // Start 3s timeout - if Realtime doesn't deliver, start polling fallback (safety net only)
          pollingTimeoutRef.current = window.setTimeout(() => {
            console.log('[useGame] Results not received via Realtime in 3s, starting polling fallback (safety net)')
            startPollingForResults(matchIdRef.current!)
          }, 3000)
        }
      }
      
      // Optimistically update UI
      return {
        ...prev,
        answerSubmitted: true,
        waitingForOpponent: false
      }
    })
  }, [])
  
  // Polling function for results fallback - simplified safety net (debugging only)
  const startPollingForResults = useCallback(async (matchId: string) => {
    console.log('[useGame] 🔄 Polling fallback: Querying database for results (safety net - Realtime should handle this)')
    
    let pollCount = 0
    const maxPolls = 10 // Poll for up to 20 seconds (10 attempts at 2s intervals) - simplified fallback
    
    const poll = async () => {
      pollCount++
      try {
        // Try RPC first (if available)
        let pollData = null
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_match_round_state_v2' as any, {
          p_match_id: matchId
        })
        
        if (!rpcError && rpcData) {
          pollData = rpcData
        } else if (rpcError && (
          rpcError.code === '42883' || 
          rpcError.code === 'PGRST202' ||
          rpcError.message?.includes('does not exist') ||
          rpcError.message?.includes('Could not find the function')
        )) {
          // RPC doesn't exist - fall back to direct table query
          console.log('[useGame] RPC not available (error:', rpcError.code, '), using direct table query fallback')
          // Query only columns that are guaranteed to exist (basic match columns)
          // Note: round_number and round_wins columns might not exist in production schema
          // Also query timestamps to detect if answers were submitted
          const { data: matchData, error: matchError } = await supabase
            .from('matches')
            .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner, results_computed_at, results_payload, results_version, results_round_id, current_round_id, player1_answered_at, player2_answered_at, winner_id, status, player1_id, player2_id')
            .eq('id', matchId)
            .single() as { data: any; error: any }
          
          if (matchError) {
            console.error('[useGame] Direct query error:', matchError)
            if (pollCount >= maxPolls) {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
            }
            return
          }
          
          // Simplified polling: just check if results_payload exists
          const resultsReady = matchData && 
                               matchData.results_computed_at !== null && 
                               matchData.results_payload !== null
          
          if (resultsReady) {
            // Use results_payload directly (same as Realtime handler)
            pollData = {
              both_answered: true,
              results_payload: matchData.results_payload,
              results_version: matchData.results_version ?? 0
            }
            
            console.log('[useGame] ✅ Found results_payload via polling (fallback)')
          } else {
            // Results not ready yet
            if (pollCount <= 5 || pollCount % 5 === 0) {
              console.log('[useGame] Results not ready yet (poll', pollCount, ') - results_computed_at:', matchData?.results_computed_at)
            }
            if (pollCount >= maxPolls) {
              console.warn('[useGame] ⚠️ Polling timeout: Results not available after', maxPolls * 2, 'seconds')
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
            }
            return
          }
        } else if (rpcError) {
          console.error('[useGame] Polling error:', rpcError)
          if (pollCount >= maxPolls) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
          }
          return
        }
        
        const data = pollData
        
        // Debug: log pollData state before processing
        if (pollCount <= 3) {
          console.log('[useGame] Poll attempt', pollCount, '- pollData:', pollData ? 'has data' : 'null', data ? {both_answered: data.both_answered, hasResult: !!data.result} : 'no data')
        }
        
        if (data?.both_answered && data.results_payload) {
          // Results ready - use results_payload directly (same as Realtime handler)
          console.log('[useGame] ✅ Polling detected results via results_payload (fallback - Realtime should handle this)')
          
          // Check version to avoid duplicate processing
          if (data.results_version && data.results_version <= localResultsVersionRef.current) {
            console.log('[useGame] Ignoring polled results - already have newer version')
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
            return
          }
          
          // Clear polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current)
            pollingTimeoutRef.current = null
          }
          
          // Update version and apply results
          if (data.results_version) {
            localResultsVersionRef.current = data.results_version
          }
          applyResults(data.results_payload)
        } else if (pollCount >= maxPolls) {
          // Stop polling after max attempts
          console.warn('[useGame] ⚠️ Polling timeout: Results not available after', maxPolls, 'attempts')
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        }
      } catch (err) {
        console.error('[useGame] Polling exception:', err)
        // Stop polling on error
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }
    
    // Poll immediately, then every 2 seconds (simplified - just safety net)
    poll()
    pollingIntervalRef.current = window.setInterval(poll, 2000)
  }, [applyResults])

  const submitEarlyAnswer = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[useGame] WebSocket not connected')
      return
    }

    const submitMessage = {
      type: 'EARLY_ANSWER'
    }
    console.log('[useGame] Sending EARLY_ANSWER:', submitMessage)
    ws.send(JSON.stringify(submitMessage))
  }, [])

  const submitStepAnswer = useCallback((stepIndex: number, answerIndex: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[useGame] WebSocket not connected')
      return
    }

    setState(prev => {
      if (prev.answerSubmitted) {
        console.warn('[useGame] Answer already submitted')
        return prev
      }

      const submitMessage = {
        type: 'SUBMIT_STEP_ANSWER',
        stepIndex,
        segment: prev.currentSegment,
        subStepIndex: prev.currentSubStepIndex,
        answerIndex
      }
      console.log('[useGame] Sending SUBMIT_STEP_ANSWER:', submitMessage)
      ws.send(JSON.stringify(submitMessage))
      
      return {
        ...prev,
        answerSubmitted: true,
        waitingForOpponent: false
      }
    })
  }, [])

  const readyForNextRound = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[useGame] WebSocket not connected')
      return
    }

    setState(prev => {
      if (prev.resultsAcknowledged) {
        console.warn('[useGame] Already acknowledged results')
        return prev
      }

      const readyMessage = {
        type: 'READY_FOR_NEXT_ROUND'
      }
      console.log('[useGame] Sending READY_FOR_NEXT_ROUND:', readyMessage)
      ws.send(JSON.stringify(readyMessage))
      
      return {
        ...prev,
        resultsAcknowledged: true
      }
    })
  }, [])

  // Inter-round countdown: results -> next round (10s)
  useEffect(() => {
    if (state.status !== 'results') return
    if (state.matchOver) return
    if (state.nextRoundCountdown == null) return
    if (state.nextRoundCountdown <= 0) return

    const interval = window.setInterval(() => {
      setState(prev => {
        if (prev.status !== 'results') return prev
        if (prev.matchOver) return prev
        if (prev.nextRoundCountdown == null) return prev
        return { ...prev, nextRoundCountdown: Math.max(0, prev.nextRoundCountdown - 1) }
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [state.status, state.matchOver, state.nextRoundCountdown])

  // Auto-send READY_FOR_NEXT_ROUND at 0s (only once; retries when WS reconnects)
  useEffect(() => {
    const shouldSend =
      state.status === 'results' &&
      !state.matchOver &&
      state.nextRoundCountdown === 0 &&
      !state.resultsAcknowledged

    if (!shouldSend) return
    if (!isWebSocketConnected) return

    readyForNextRound()
  }, [
    state.status,
    state.matchOver,
    state.nextRoundCountdown,
    state.resultsAcknowledged,
    isWebSocketConnected,
    readyForNextRound
  ])

  return {
    status: state.status,
    playerRole: state.playerRole,
    errorMessage: state.errorMessage,
    question: state.question,
    answerSubmitted: state.answerSubmitted,
    waitingForOpponent: state.waitingForOpponent,
    resultsAcknowledged: state.resultsAcknowledged,
    waitingForOpponentToAcknowledge: state.waitingForOpponentToAcknowledge,
    allStepsComplete: state.allStepsComplete,
    waitingForOpponentToCompleteSteps: state.waitingForOpponentToCompleteSteps,
    results: state.results,
    // Stage 3: Tug-of-war state
    roundNumber: state.roundNumber,
    lastRoundWinner: state.lastRoundWinner,
    consecutiveWinsCount: state.consecutiveWinsCount,
    matchFinished: state.matchFinished,
    matchWinner: state.matchWinner,
    totalRounds: state.totalRounds,
    timerEndAt: state.timerEndAt,
    timeRemaining: state.timeRemaining,
    submitAnswer,
    // Step-based question state
    phase: state.phase,
    currentStepIndex: state.currentStepIndex,
    totalSteps: state.totalSteps,
    mainQuestionEndsAt: state.mainQuestionEndsAt,
    stepEndsAt: state.stepEndsAt,
    mainQuestionTimeLeft: state.mainQuestionTimeLeft,
    stepTimeLeft: state.stepTimeLeft,
    subStepTimeLeft: state.subStepTimeLeft,
    currentStep: state.currentStep,
    currentSegment: state.currentSegment,
    currentSubStepIndex: state.currentSubStepIndex,
    currentSubStep: state.currentSubStep,
    lastStepAdvanceReason: state.lastStepAdvanceReason,
    lastStepAdvanceAt: state.lastStepAdvanceAt,
    submitEarlyAnswer,
    submitStepAnswer,
    readyForNextRound,
    // Match-level state (rounds system)
    currentRoundNumber: state.currentRoundNumber,
    targetRoundsToWin: state.targetRoundsToWin,
    playerRoundWins: state.playerRoundWins,
    matchOver: state.matchOver,
    matchWinnerId: state.matchWinnerId,
    nextRoundCountdown: state.nextRoundCountdown,
    // WebSocket connection status
    isWebSocketConnected
  }
}
