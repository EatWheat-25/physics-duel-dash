import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'
import type { MatchRow } from '@/types/schema'
import { mapRawToQuestion } from '@/utils/questionMapper'

const NEXT_ROUND_DELAY_MS = 10_000

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
    results_version?: number
    round_id?: string | null
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
  nextRoundEndsAt: string | null
  nextRoundTimeLeft: number | null
  // Step-based question state
  phase: 'question' | 'main_question' | 'steps' | 'result'
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
  // Match-level state (rounds system)
  currentRoundId: string | null
  currentRoundNumber: number
  targetRoundsToWin: number
  playerRoundWins: { [playerId: string]: number }
  matchOver: boolean
  matchWinnerId: string | null
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
    nextRoundEndsAt: null,
    nextRoundTimeLeft: null,
    // Step-based question state
    phase: 'question',
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
    // Match-level state (rounds system)
    currentRoundId: null,
    currentRoundNumber: 1,
    targetRoundsToWin: 3,
    playerRoundWins: {},
    matchOver: false,
    matchWinnerId: null
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
  const processedRoundVersionsRef = useRef<Map<string, number>>(new Map())
  const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false)
  const lastSnapshotFetchAtRef = useRef<number>(0)
  const snapshotInFlightRef = useRef<Promise<any> | null>(null)
  const lastSnapshotBurstAtRef = useRef<number>(0)
  const lastSnapshotRef = useRef<{ data: any; fetchedAt: number } | null>(null)
  const SNAPSHOT_THROTTLE_MS = 1500
  const SNAPSHOT_CACHE_TTL_MS = 3000
  const retryCountRef = useRef<number>(0)
  const retryTimeoutRef = useRef<number | null>(null)
  const connectionTimeoutRef = useRef<number | null>(null)
  const [reconnectTrigger, setReconnectTrigger] = useState<number>(0)
  const MAX_RETRY_ATTEMPTS = 5
  const CONNECTION_TIMEOUT_MS = 10_000

  const getResultsShownKey = useCallback((matchId: string) => `bn:match:${matchId}:resultsShown`, [])

  const readResultsShown = useCallback((matchId: string) => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(getResultsShownKey(matchId))
      if (!raw) return null
      const parsed = JSON.parse(raw) as { roundId?: string; resultsVersionShown?: number }
      if (!parsed || typeof parsed.roundId !== 'string' || typeof parsed.resultsVersionShown !== 'number') return null
      return parsed
    } catch {
      return null
    }
  }, [getResultsShownKey])

  const writeResultsShown = useCallback((matchId: string, roundId: string, resultsVersion: number) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        getResultsShownKey(matchId),
        JSON.stringify({ roundId, resultsVersionShown: resultsVersion })
      )
    } catch {
      // Ignore storage errors (quota/private mode)
    }
  }, [getResultsShownKey])

  const clearResultsShown = useCallback((matchId: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(getResultsShownKey(matchId))
    } catch {
      // Ignore storage errors
    }
  }, [getResultsShownKey])

  const fetchMatchSnapshot = useCallback(async (matchId: string, force = false) => {
    const now = Date.now()
    const cached = lastSnapshotRef.current
    if (!force && cached && now - cached.fetchedAt < SNAPSHOT_CACHE_TTL_MS) {
      return cached.data
    }

    if (!force && now - lastSnapshotFetchAtRef.current < SNAPSHOT_THROTTLE_MS) {
      return null
    }

    if (snapshotInFlightRef.current) {
      return snapshotInFlightRef.current
    }

    lastSnapshotFetchAtRef.current = now

    const request = supabase
      .rpc('get_match_round_state_v2' as any, { p_match_id: matchId })
      .then(({ data, error }) => {
        snapshotInFlightRef.current = null
        if (error || !data) {
          return null
        }
        lastSnapshotRef.current = { data, fetchedAt: Date.now() }
        return data
      })

    snapshotInFlightRef.current = request as unknown as Promise<any>
    return snapshotInFlightRef.current
  }, [])

  // Shared function to apply results from payload (used by both Realtime and WS handlers)
  const applyResults = useCallback((payload: any) => {
    console.log('[useGame] applyResults called with payload:', payload)
    
    // Prevent duplicate processing using round_id
    const roundId = payload.round_id || payload.roundId || payload.results_round_id || payload.resultsRoundId
    const resultsVersion = payload.results_version ?? payload.resultsVersion ?? null

    const matchId = matchIdRef.current
    if (matchId && roundId && resultsVersion !== null) {
      const shown = readResultsShown(matchId)
      if (shown && shown.roundId === roundId && resultsVersion <= shown.resultsVersionShown) {
        console.log('[useGame] Ignoring already-shown results from storage:', roundId, resultsVersion)
        return
      }
    }

    if (roundId && resultsVersion !== null) {
      const prevVersion = processedRoundVersionsRef.current.get(roundId)
      if (prevVersion !== undefined && prevVersion >= resultsVersion) {
        console.log('[useGame] Ignoring duplicate results for round_id/version:', roundId, resultsVersion)
        return
      }
      processedRoundVersionsRef.current.set(roundId, resultsVersion)
      if (resultsVersion > localResultsVersionRef.current) {
        localResultsVersionRef.current = resultsVersion
      }
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
      round_id: roundId, // Store round_id in results for reference
      results_version: resultsVersion ?? undefined
    }

    const matchOver =
      payload.match_over ??
      payload.matchOver ??
      Boolean(payload.match_winner_id ?? payload.matchWinnerId)
    const nextRoundEndsAt = matchOver ? null : new Date(Date.now() + NEXT_ROUND_DELAY_MS).toISOString()
    const nextRoundTimeLeft = matchOver ? null : Math.round(NEXT_ROUND_DELAY_MS / 1000)

    setState(prev => {
      // Don't update if already showing results with same or newer version
      if (prev.status === 'results' && payload.round_number && payload.round_number < prev.currentRoundNumber) {
        console.log('[useGame] Ignoring older round results')
        return prev
      }

      if (matchId && roundId && resultsVersion !== null) {
        writeResultsShown(matchId, roundId, resultsVersion)
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
        matchOver,
        matchWinnerId: payload.match_winner_id ?? null,
        nextRoundEndsAt,
        nextRoundTimeLeft
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
  }, [readResultsShown, writeResultsShown])

  const applySnapshot = useCallback((snapshot: any) => {
    if (!snapshot) return false

    const snapshotRoundId = snapshot.current_round_id ?? null
    const snapshotRoundNumber = snapshot.current_round_number ?? null

    if (snapshotRoundId || snapshotRoundNumber) {
      currentRoundIdRef.current = snapshotRoundId ?? currentRoundIdRef.current
      setState(prev => ({
        ...prev,
        currentRoundId: snapshotRoundId ?? prev.currentRoundId,
        currentRoundNumber: snapshotRoundNumber ?? prev.currentRoundNumber
      }))
    }

    const resultsPayload = snapshot.results_payload ?? null
    const resultsRoundId = snapshot.results_round_id ?? null
    const resultsVersion = snapshot.results_version ?? null

    if (snapshot.match_over || snapshot.match_winner_id) {
      setState(prev => ({
        ...prev,
        matchOver: Boolean(snapshot.match_over ?? prev.matchOver),
        matchWinnerId: snapshot.match_winner_id ?? prev.matchWinnerId
      }))
    }

    if (resultsPayload && resultsRoundId && snapshotRoundId && resultsRoundId === snapshotRoundId) {
      if (resultsVersion !== null && resultsVersion > localResultsVersionRef.current) {
        localResultsVersionRef.current = resultsVersion
      }
      const enrichedPayload = {
        ...(resultsPayload as any),
        results_round_id: resultsRoundId,
        results_version: resultsVersion ?? undefined,
        match_over: snapshot.match_over ?? undefined,
        match_winner_id: snapshot.match_winner_id ?? undefined
      }
      applyResults(enrichedPayload)
      return true
    }

    return false
  }, [applyResults])

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
        waitingForOpponent: false,
        nextRoundEndsAt: new Date(Date.now() + NEXT_ROUND_DELAY_MS).toISOString(),
        nextRoundTimeLeft: Math.round(NEXT_ROUND_DELAY_MS / 1000)
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
        const snapshot = await fetchMatchSnapshot(match.id, true)
        const applied = snapshot ? applySnapshot(snapshot) : false

        if (applied) {
          if (multiStepPollingIntervalRef.current) {
            clearInterval(multiStepPollingIntervalRef.current)
            multiStepPollingIntervalRef.current = null
          }
          return
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
  }, [match?.id, state.status, state.phase, state.allStepsComplete, state.results, applySnapshot, fetchMatchSnapshot])

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

  // Next round countdown (results -> auto-advance)
  useEffect(() => {
    if (!state.nextRoundEndsAt || state.status !== 'results' || state.matchOver) {
      setState(prev => ({ ...prev, nextRoundTimeLeft: null }))
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const endTime = new Date(state.nextRoundEndsAt!).getTime()
      const remaining = Math.max(0, Math.round((endTime - now) / 1000))
      setState(prev => ({ ...prev, nextRoundTimeLeft: remaining }))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [state.nextRoundEndsAt, state.status, state.matchOver])

  const manualRetry = useCallback(() => {
    console.log('[useGame] Manual retry triggered')
    // Reset retry count
    retryCountRef.current = 0
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    // Close existing WebSocket if any
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    // Trigger reconnection by updating trigger state
    setReconnectTrigger(prev => prev + 1)
    setState(prev => ({
      ...prev,
      status: 'connecting',
      errorMessage: null
    }))
  }, [])

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

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }

    const handleConnectionFailure = (reason: string, isRetryable: boolean = true) => {
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }

      // Don't retry non-retryable errors (auth, validation)
      if (!isRetryable) {
        setState(prev => ({
          ...prev,
          status: 'error' as const,
          errorMessage: reason
        }))
        return
      }

      // Check if we should retry
      if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
        setState(prev => ({
          ...prev,
          status: 'error' as const,
          errorMessage: 'Connection failed after multiple attempts. Edge function may not be deployed.'
        }))
        return
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000)
      retryCountRef.current++

      console.log(`[useGame] Connection failed (${reason}). Retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS})...`)
      
      setState(prev => ({
        ...prev,
        status: 'connecting' as const,
        errorMessage: `Connection failed - retrying... (${retryCountRef.current}/${MAX_RETRY_ATTEMPTS})`
      }))

      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null
        attemptConnection(true)
      }, delay) as unknown as number
    }

    const attemptConnection = async (isRetry: boolean = false) => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          handleConnectionFailure('Not authenticated', false)
          return
        }

        userIdRef.current = user.id
        matchIdRef.current = match.id

        // Verify user is part of match
        if (match.player1_id !== user.id && match.player2_id !== user.id) {
          handleConnectionFailure('You are not part of this match', false)
          return
        }

        // Get session token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.access_token) {
          handleConnectionFailure('Authentication error: No session token', false)
          return
        }

        // Build WebSocket URL
        if (!SUPABASE_URL) {
          console.error('[useGame] ❌ SUPABASE_URL is not defined')
          handleConnectionFailure('Missing SUPABASE_URL', false)
          return
        }

        const wsUrl = `${SUPABASE_URL.replace('http', 'ws')}/functions/v1/game-ws?token=${session.access_token}&match_id=${match.id}`
        console.log(`[useGame] ${isRetry ? `Retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS}: ` : ''}Connecting to:`, wsUrl)

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        // Set connection timeout
        connectionTimeoutRef.current = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSED) {
            console.warn('[useGame] Connection timeout after 10s')
            ws.close()
            handleConnectionFailure('Connection timeout')
          }
        }, CONNECTION_TIMEOUT_MS) as unknown as number

        ws.onopen = () => {
          // Clear connection timeout
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current)
            connectionTimeoutRef.current = null
          }
          
          console.log('[useGame] WebSocket connected')
          // Reset retry count on successful connection
          retryCountRef.current = 0
          hasConnectedRef.current = true
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
                  nextRoundEndsAt: null,
                  nextRoundTimeLeft: null
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
              processedRoundVersionsRef.current.clear()
              const roundStartEvent = message as any as RoundStartEvent
              if (roundStartEvent.phase === 'main_question' || roundStartEvent.phase === 'steps') {
                // Multi-step question (async segments may start directly in steps)
                setState(prev => ({
                  ...prev,
                  status: 'playing',
                  phase: roundStartEvent.phase === 'steps' ? 'steps' : 'main_question',
                  question: roundStartEvent.question,
                  mainQuestionEndsAt: (roundStartEvent as any).mainQuestionEndsAt || null,
                  totalSteps: (roundStartEvent as any).totalSteps || 0,
                  currentStepIndex: 0,
                  currentSegment: 'main',
                  currentSubStepIndex: 0,
                  currentSubStep: null,
                  subStepTimeLeft: null,
                  // Match-level info (used by UI scoreboard)
                  currentRoundId: roundStartEvent.roundId ?? prev.currentRoundId,
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
                  nextRoundEndsAt: null,
                  nextRoundTimeLeft: null,
                  errorMessage: null
                }))
              } else {
                // Single-step question - existing flow
                setState(prev => ({
                  ...prev,
                  status: 'playing',
                  phase: 'question',
                  question: roundStartEvent.question,
                  currentRoundId: roundStartEvent.roundId ?? prev.currentRoundId,
                  currentRoundNumber: Number.isFinite(roundStartEvent.roundIndex)
                    ? roundStartEvent.roundIndex + 1
                    : prev.currentRoundNumber,
                  targetRoundsToWin: roundStartEvent.targetRoundsToWin ?? prev.targetRoundsToWin,
                  resultsAcknowledged: false,
                  waitingForOpponentToAcknowledge: false,
                  allStepsComplete: false,
                  waitingForOpponentToCompleteSteps: false,
                  results: null, // Clear results when new round starts
                  nextRoundEndsAt: null,
                  nextRoundTimeLeft: null,
                  errorMessage: null
                }))
              }
            } else if (message.type === 'PHASE_CHANGE') {
              console.log('[useGame] PHASE_CHANGE message received', message)
              if (message.phase === 'steps') {
                setState(prev => ({
                  ...prev,
                  phase: 'steps',
                  currentStepIndex: message.stepIndex ?? message.currentStepIndex ?? 0,
                  totalSteps: message.totalSteps ?? prev.totalSteps,
                  stepEndsAt: message.stepEndsAt || null,
                  currentStep: message.currentStep || null,
                  currentSegment: (message.segment === 'sub' ? 'sub' : 'main') as 'main' | 'sub',
                  currentSubStepIndex: Number.isFinite((message as any).subStepIndex) ? (message as any).subStepIndex : 0,
                  currentSubStep: (message.segment === 'sub' ? (message.currentStep || null) : null),
                  subStepTimeLeft: null,
                  answerSubmitted: false,
                  waitingForOpponent: false,
                  allStepsComplete: false,
                  waitingForOpponentToCompleteSteps: false
                }))
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
              
              // Treat WS results as a hint; snapshot remains authoritative
              const msg = message as any
              const incomingVersion = msg.results_version ?? msg.resultsVersion ?? null
              if (incomingVersion !== null && incomingVersion <= localResultsVersionRef.current) {
                console.log('[useGame] Ignoring WS RESULTS_RECEIVED - already have same/newer version')
                return
              }

              const matchId = matchIdRef.current
              if (!matchId) return

              const now = Date.now()
              if (now - lastSnapshotBurstAtRef.current < SNAPSHOT_THROTTLE_MS) return
              lastSnapshotBurstAtRef.current = now

              void fetchMatchSnapshot(matchId).then(snapshot => {
                if (!snapshot) return
                const applied = applySnapshot(snapshot)
                if (!applied) {
                  console.log('[useGame] Snapshot has no results; ignoring WS hint')
                }
              })
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
              processedRoundVersionsRef.current.clear()
              setState(prev => ({
                ...prev,
                status: 'playing',
                phase: 'question',
                answerSubmitted: false,
                waitingForOpponent: false,
                resultsAcknowledged: false,
                waitingForOpponentToAcknowledge: false,
                allStepsComplete: false,
                waitingForOpponentToCompleteSteps: false,
                results: null, // Clear results when new round starts
                nextRoundEndsAt: null,
                nextRoundTimeLeft: null,
                roundNumber: message.round_number || 0,
                lastRoundWinner: message.last_round_winner,
                consecutiveWinsCount: message.consecutive_wins_count || 0,
                timerEndAt: null, // Will be set when QUESTION_RECEIVED arrives
                timeRemaining: null,
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
              processedRoundVersionsRef.current.clear()
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
                nextRoundEndsAt: null,
                nextRoundTimeLeft: null
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
          // Don't set error state here - let onclose handle it
          // This prevents double error handling
        }

        ws.onclose = (event) => {
          // Clear connection timeout if still set
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current)
            connectionTimeoutRef.current = null
          }

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
          console.log('[useGame] WebSocket closed', event.code, event.reason)
          
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current)
            heartbeatRef.current = null
          }

          // Only retry if we haven't successfully connected yet
          // If we had connected before, this is a normal disconnect
          if (!hasConnectedRef.current && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
            const reason = event.code === 1006 ? 'Connection closed unexpectedly' : 'Connection closed'
            handleConnectionFailure(reason, true)
          } else if (!hasConnectedRef.current) {
            // Max retries exhausted
            setState(prev => ({
              ...prev,
              status: 'error',
              errorMessage: 'Connection failed after multiple attempts. Edge function may not be deployed.'
            }))
          } else {
            // Was connected, now disconnected - don't auto-retry
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
        }
      } catch (error: any) {
        console.error('[useGame] Connection error:', error)
        const isRetryable = !error.message?.includes('authenticated') && 
                           !error.message?.includes('session') &&
                           !error.message?.includes('SUPABASE_URL')
        handleConnectionFailure(error.message || 'Failed to connect', isRetryable)
      }
    }

    attemptConnection()

    return () => {
      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }
      // Reset retry count on unmount
      retryCountRef.current = 0
      
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
  }, [match?.id, reconnectTrigger])

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
          setState(prev => ({
            ...prev,
            currentRoundId: newPayload.current_round_id,
            currentRoundNumber: newPayload.current_round_number ?? prev.currentRoundNumber,
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
          }))
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
          const enrichedPayload = {
            ...(newPayload.results_payload ?? {}),
            results_round_id: newPayload.results_round_id ?? null,
            results_version: newVersion,
            match_over: newPayload.winner_id != null || newPayload.status === 'completed',
            match_winner_id: newPayload.winner_id ?? null
          }
          applyResults(enrichedPayload)
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
      void fetchMatchSnapshot(matchIdRef.current).then(snapshot => {
        if (snapshot) {
          applySnapshot(snapshot)
        }
      })
      lastVisibilityChangeRef.current = now
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [state.status])

  useEffect(() => {
    const matchId = matchIdRef.current
    if (!matchId) return
    if (state.matchOver || state.status === 'match_finished') {
      clearResultsShown(matchId)
    }
  }, [state.matchOver, state.status, clearResultsShown])

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
        const rawOptions = Array.isArray(prev.question?.steps?.[0]?.options)
          ? prev.question.steps[0].options
          : Array.isArray((prev.question as any)?.options)
            ? (prev.question as any).options
            : []
        const normalizedOptions = rawOptions.filter((opt: any) => String(opt).trim() !== '')
        const maxAllowed = normalizedOptions.length > 0 ? normalizedOptions.length - 1 : 5
        if (answerIndex < 0 || answerIndex > maxAllowed) {
          console.error('[useGame] Invalid answer index:', answerIndex)
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
        const snapshot = await fetchMatchSnapshot(matchId, true)
        const applied = snapshot ? applySnapshot(snapshot) : false

        if (applied) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current)
            pollingTimeoutRef.current = null
          }
          return
        }

        if (pollCount >= maxPolls) {
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
  }, [applySnapshot, fetchMatchSnapshot])

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

  // Auto-acknowledge results when countdown ends
  useEffect(() => {
    if (state.status !== 'results' || state.matchOver) return
    if (state.nextRoundTimeLeft === null || state.nextRoundTimeLeft > 0) return
    if (state.resultsAcknowledged) return
    readyForNextRound()
  }, [state.status, state.matchOver, state.nextRoundTimeLeft, state.resultsAcknowledged, readyForNextRound])

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
    nextRoundEndsAt: state.nextRoundEndsAt,
    nextRoundTimeLeft: state.nextRoundTimeLeft,
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
    submitEarlyAnswer,
    submitStepAnswer,
    readyForNextRound,
    // Match-level state (rounds system)
    currentRoundNumber: state.currentRoundNumber,
    targetRoundsToWin: state.targetRoundsToWin,
    playerRoundWins: state.playerRoundWins,
    matchOver: state.matchOver,
    matchWinnerId: state.matchWinnerId,
    // WebSocket connection status
    isWebSocketConnected,
    // Manual retry function
    manualRetry
  }
}
