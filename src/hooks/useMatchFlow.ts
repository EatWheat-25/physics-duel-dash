import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { mapRawToQuestion } from '@/utils/questionMapper'
import type { MatchRow } from '@/types/schema'
import type { StepBasedQuestion } from '@/types/questions'
import type { RoundResult, RoundPhase } from '@/types/roundState'

// Re-export for backward compatibility
export type { RoundResult }

/**
 * Match flow state
 */
export type UseMatchFlowState = {
  match: MatchRow | null
  currentRound: { id: string; roundNumber: number; status: string } | null
  currentQuestion: StepBasedQuestion | null
  roundResult: RoundResult | null
  isMatchFinished: boolean
  playerAnswers: Map<number, number>
  responseTimes: Map<number, number>
  isConnected: boolean
  hasSubmitted: boolean
  // Step-by-step state
  currentStepIndex: number // -1 = thinking phase, 0+ = step index
  stepTimeLeft: number | null
  hasAnsweredCurrentStep: boolean
  thinkingTimeLeft: number | null // Timer for thinking phase
  isThinkingPhase: boolean // Whether we're in thinking phase
  // Round transition state
  isShowingRoundTransition: boolean
  // Server-driven phase (from ROUND_STATE)
  phase: RoundPhase | null
}

/**
 * useMatchFlow - Manages WebSocket connection and match state for 1v1 battles
 * 
 * Handles:
 * - WebSocket connection to game-ws
 * - Match start, round start, answer submission
 * - Round evaluation and match completion
 * - Answer tracking and response time measurement
 */
export function useMatchFlow(matchId: string | null) {
  const [state, setState] = useState<UseMatchFlowState>({
    match: null,
    currentRound: null,
    currentQuestion: null,
    roundResult: null,
    isMatchFinished: false,
    playerAnswers: new Map(),
    responseTimes: new Map(),
    isConnected: false,
    hasSubmitted: false,
    // Step-by-step state
    currentStepIndex: -1, // Start at -1 (thinking phase)
    stepTimeLeft: null,
    hasAnsweredCurrentStep: false,
    thinkingTimeLeft: null,
    isThinkingPhase: false,
    // Round transition state
    isShowingRoundTransition: false,
    // Server-driven phase
    phase: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const stepTimersRef = useRef<Map<number, number>>(new Map()) // stepIndex -> startTime
  const roundResultTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stepTimerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const stepAnswersRef = useRef<Map<number, number>>(new Map()) // Track which steps we've answered
  const startStepRef = useRef<((stepIndex: number, durationSeconds: number) => void) | null>(null)
  const startThinkingPhaseRef = useRef<((durationSeconds: number) => void) | null>(null)
  const thinkingPhaseStartTimeRef = useRef<number | null>(null) // Start time for thinking phase
  const stepStartTimeRef = useRef<number | null>(null) // Start time for current step
  // Round transition refs
  const roundTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTransitioningRef = useRef(false)
  const queuedRoundStartRef = useRef<any | null>(null) // Queued ROUND_START message
  // Guard condition refs (to avoid stale closures in callbacks)
  const roundResultRef = useRef<RoundResult | null>(null)
  const lastAppliedRoundIdRef = useRef<string | null>(null) // Idempotency guard: prevents duplicate round processing
  const isShowingRoundTransitionRef = useRef(false)
  const isMatchFinishedRef = useRef(false)
  const finishRoundTransitionRef = useRef<(() => void) | null>(null)
  // Queue ROUND_STATE if it arrives before match is ready
  const pendingRoundStateRef = useRef<any | null>(null)

  // ========================================
  // applyRoundResult - SINGLE SOURCE OF TRUTH
  // ========================================
  // Both WS ROUND_RESULT and polling MUST call this function.
  // This ensures identical cleanup for early and late answerers.
  // Phase 1 goal: Round transition correctness (not match score reconciliation)
  // Defined early to avoid temporal dead zone issues with useEffect dependencies
  const applyRoundResult = useCallback((
    result: RoundResult,
    source: 'ws' | 'polling',
    roundId: string
  ) => {
    // === DOUBLE IDEMPOTENCY GUARD ===
    
    // Guard 1: roundId-based (prevents duplicate round processing)
    if (lastAppliedRoundIdRef.current === roundId) {
      console.log(`[useMatchFlow] applyRoundResult(${source}): already applied roundId=${roundId}, skipping`)
      return
    }
    
    // Guard 2: roundResultRef-based (prevents any duplicate result application)
    if (roundResultRef.current) {
      console.log(`[useMatchFlow] applyRoundResult(${source}): roundResult already exists, skipping`)
      return
    }
    
    // Set both guards immediately (atomic)
    lastAppliedRoundIdRef.current = roundId
    roundResultRef.current = result

    console.log(`[useMatchFlow] applyRoundResult(${source}): roundId=${roundId}`, result)

    // === FULL CLEANUP (identical for both paths) ===

    // Clear all timeouts
    if (roundTransitionTimeoutRef.current) {
      clearTimeout(roundTransitionTimeoutRef.current)
      roundTransitionTimeoutRef.current = null
    }
    if (roundResultTimeoutRef.current) {
      clearTimeout(roundResultTimeoutRef.current)
      roundResultTimeoutRef.current = null
    }

    // Clear step timer
    if (stepTimerIntervalRef.current) {
      clearInterval(stepTimerIntervalRef.current)
      stepTimerIntervalRef.current = null
    }

    // Clear step tracking refs
    stepAnswersRef.current.clear()
    thinkingPhaseStartTimeRef.current = null
    stepStartTimeRef.current = null

    // Set transition ref
    isTransitioningRef.current = true

    const isFinished = !result.matchContinues || result.matchWinnerId !== null

    // === SINGLE STATE UPDATE (no match score mutation - Phase 1 goal is transition correctness) ===
    setState(prev => {
      return {
        ...prev,
        roundResult: result,
        hasSubmitted: false,
        isMatchFinished: isFinished,
        isShowingRoundTransition: true, // CRITICAL: always set this
        // Clear all answer state
        playerAnswers: new Map(),
        responseTimes: new Map(),
        currentStepIndex: -1,
        stepTimeLeft: null,
        hasAnsweredCurrentStep: false,
        thinkingTimeLeft: null,
        isThinkingPhase: false,
        // Phase 1: Don't mutate match totals - just keep prev.match
        // Phase 1 goal is round transition correctness, not match scoring reconciliation
        match: prev.match
      }
    })

    // Start 5-second transition timeout (visual lifecycle, not correctness-critical)
    roundTransitionTimeoutRef.current = setTimeout(() => {
      // Use ref to avoid circular dependency
      if (finishRoundTransitionRef.current) {
        finishRoundTransitionRef.current()
      }
    }, 5000)
  }, []) // No dependencies - refs handle all state

  // Fetch match data (normal polling)
  useEffect(() => {
    if (!matchId) return

    const fetchMatch = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle()

      if (error || !data) {
        console.error('[useMatchFlow] Error fetching match:', error)
        return
      }

      const matchData = data as MatchRow
      const shouldBeFinished = matchData.status === 'finished'
      setState(prev => ({
        ...prev,
        match: matchData,
        isMatchFinished: prev.isMatchFinished || shouldBeFinished
      }))
    }

    fetchMatch()

    // Normal polling every 5 seconds
    const interval = setInterval(fetchMatch, 5000)
    return () => clearInterval(interval)
  }, [matchId])

  // Restore round state on mount (handles page reload)
  useEffect(() => {
    if (!matchId || !state.currentRound || !state.match) return

    const restoreRoundState = async () => {
      // Check current round status
      const { data: roundData } = await supabase
        .from('match_rounds')
        .select('status, player1_answered_at, player2_answered_at, player1_round_score, player2_round_score, round_number, question_id, id')
        .eq('id', state.currentRound!.id)
        .single()

      if (!roundData) return

      // If round is finished, restore roundResult
      if (roundData.status === 'finished') {
        const { data: matchData } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single()

        if (matchData) {
          const targetPoints = (matchData as any).target_points || 5
          const maxRounds = (matchData as any).max_rounds || 3
          const p1Score = (matchData as any).player1_score || 0
          const p2Score = (matchData as any).player2_score || 0
          const currentRoundNum = (matchData as any).current_round_number || 0

          const matchContinues =
            p1Score < targetPoints &&
            p2Score < targetPoints &&
            currentRoundNum < maxRounds &&
            matchData.status === 'in_progress'

          const syntheticResult: RoundResult = {
            roundWinnerId: roundData.player1_round_score > roundData.player2_round_score
              ? (matchData as any).player1_id
              : roundData.player2_round_score > roundData.player1_round_score
                ? (matchData as any).player2_id
                : null,
            player1RoundScore: roundData.player1_round_score || 0,
            player2RoundScore: roundData.player2_round_score || 0,
            matchContinues,
            matchWinnerId: !matchContinues ? (matchData as any).winner_id : null
          }

          // Use applyRoundResult for consistency (page reload recovery)
          applyRoundResult(syntheticResult, 'polling', roundData.id)
          return // Don't restore step state if round is finished
        }
      }

      // If round is active, check if player has already answered
      if (roundData.status === 'active' && state.currentQuestion) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const isPlayer1 = (state.match as any)?.player1_id === user.id
        const hasAnswered = isPlayer1
          ? !!roundData.player1_answered_at
          : !!roundData.player2_answered_at

        if (hasAnswered) {
          // Player has already answered - restore to "waiting" state
          setState(prev => ({
            ...prev,
            hasSubmitted: true,
            currentStepIndex: prev.currentQuestion?.steps.length || 0 // Set to beyond last step
          }))
        }
      }
    }

    restoreRoundState()
  }, [matchId, state.currentRound?.id, state.match?.id, applyRoundResult]) // Only run when round changes

  // Keep refs in sync with state for guards (avoids stale closures)
  useEffect(() => {
    roundResultRef.current = state.roundResult
    isShowingRoundTransitionRef.current = state.isShowingRoundTransition
    isMatchFinishedRef.current = state.isMatchFinished
  }, [state.roundResult, state.isShowingRoundTransition, state.isMatchFinished])

  // Polling fallback - runs when hasSubmitted === true (safety net for early-answer desync)
  useEffect(() => {
    if (!matchId || !state.currentRound || !state.hasSubmitted) return

    const checkRoundStatus = async () => {
      const { data: roundData, error: roundError } = await supabase
        .from('match_rounds')
        .select('status, player1_answered_at, player2_answered_at, player1_round_score, player2_round_score, round_number, id')
        .eq('id', state.currentRound!.id)
        .single()

      if (roundError || !roundData) {
        return
      }

      // If round is finished, update state from DB
      if (roundData.status === 'finished' && roundData.player1_answered_at && roundData.player2_answered_at) {
        const { data: matchData } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single()

        if (matchData) {
          const targetPoints = (matchData as any).target_points || 5
          const maxRounds = (matchData as any).max_rounds || 3
          const p1Score = (matchData as any).player1_score || 0
          const p2Score = (matchData as any).player2_score || 0
          const currentRoundNum = (matchData as any).current_round_number || 0

          const matchContinues =
            p1Score < targetPoints &&
            p2Score < targetPoints &&
            currentRoundNum < maxRounds &&
            matchData.status === 'in_progress'

          const syntheticResult: RoundResult = {
            roundWinnerId: roundData.player1_round_score > roundData.player2_round_score
              ? (matchData as any).player1_id
              : roundData.player2_round_score > roundData.player1_round_score
                ? (matchData as any).player2_id
                : null,
            player1RoundScore: roundData.player1_round_score || 0,
            player2RoundScore: roundData.player2_round_score || 0,
            matchContinues,
            matchWinnerId: !matchContinues ? (matchData as any).winner_id : null
          }

          console.log('[useMatchFlow] Polling: Round finished, calling applyRoundResult')
          // ✅ Use roundData.id (DB truth), not state.currentRound?.id (stale state)
          // ✅ No setState before applyRoundResult - let it handle all state
          applyRoundResult(syntheticResult, 'polling', roundData.id)
        }
      }
    }

    checkRoundStatus()

    // Aggressive polling every 2 seconds when waiting
    const interval = setInterval(checkRoundStatus, 2000)
    return () => clearInterval(interval)
  }, [matchId, state.hasSubmitted, state.currentRound, applyRoundResult])

  // Handle ROUND_START message - factored out for reuse
  // This is the NUCLEAR RESET - clears ALL previous round state
  const handleRoundStart = useCallback((message: any) => {
    console.log('[useMatchFlow] ROUND_START received - NUCLEAR RESET')
    console.log('[useMatchFlow] Raw question from WS:', JSON.stringify(message.question, null, 2))

    // === NUCLEAR CLEANUP - CLEAR BOTH GUARDS ===
    
    // Clear roundId guard (allows next round to apply result)
    lastAppliedRoundIdRef.current = null
    
    // Clear roundResult guard (allows next round to apply result)
    roundResultRef.current = null
    
    // Clear transition state
    isTransitioningRef.current = false
    queuedRoundStartRef.current = null

    // Clear transition timeout
    if (roundTransitionTimeoutRef.current) {
      clearTimeout(roundTransitionTimeoutRef.current)
      roundTransitionTimeoutRef.current = null
    }

    // Clear round result timeout
    if (roundResultTimeoutRef.current) {
      clearTimeout(roundResultTimeoutRef.current)
      roundResultTimeoutRef.current = null
    }

    // Clear step timer
    if (stepTimerIntervalRef.current) {
      clearInterval(stepTimerIntervalRef.current)
      stepTimerIntervalRef.current = null
    }

    // Clear timer start times
    thinkingPhaseStartTimeRef.current = null
    stepStartTimeRef.current = null

    // Clear step answers
    stepAnswersRef.current.clear()

    try {
      const question = mapRawToQuestion(message.question)
      console.log('[useMatchFlow] Mapped question:', question)
      console.log('[useMatchFlow] Steps count:', question.steps.length)
      if (question.steps.length > 0) {
        const firstStep = question.steps[0]
        console.log('[useMatchFlow] First step:', firstStep)
        console.log('[useMatchFlow] First step options:', firstStep.options)
        console.log('[useMatchFlow] Options type:', typeof firstStep.options)
        console.log('[useMatchFlow] Is array:', Array.isArray(firstStep.options))
        console.log('[useMatchFlow] Options length:', firstStep.options?.length)
      }
      setState(prev => ({
        ...prev,
        currentRound: {
          id: message.roundId,
          roundNumber: message.roundNumber,
          status: 'active'
        },
        currentQuestion: question,
        roundResult: null, // Clear round result when new round starts
        playerAnswers: new Map(),
        responseTimes: new Map(),
        hasSubmitted: false, // IMPORTANT: Clear hasSubmitted on new round
        // Reset step state - start with thinking phase
        currentStepIndex: -1,
        stepTimeLeft: null,
        hasAnsweredCurrentStep: false,
        thinkingTimeLeft: null,
        isThinkingPhase: false,
        isShowingRoundTransition: false // Clear transition state
      }))

      // Start thinking phase after state update
      setTimeout(() => {
        if (startThinkingPhaseRef.current) {
          startThinkingPhaseRef.current(60) // 60 seconds for thinking
        }
      }, 100)
    } catch (error) {
      console.error('[useMatchFlow] Error mapping question:', error)
      console.error('[useMatchFlow] Error stack:', error instanceof Error ? error.stack : 'No stack')
      toast.error('Failed to load question')
    }
  }, [])

  // Finish round transition - clears transition state and processes queued ROUND_START
  const finishRoundTransition = useCallback(() => {
    console.log('[useMatchFlow] Finishing round transition')
    isTransitioningRef.current = false

    if (roundTransitionTimeoutRef.current) {
      clearTimeout(roundTransitionTimeoutRef.current)
      roundTransitionTimeoutRef.current = null
    }

    setState(prev => ({
      ...prev,
      isShowingRoundTransition: false,
      // If match is over, keep roundResult for the final screen.
      // If there is another round, clear roundResult so the next round is clean.
      roundResult: prev.isMatchFinished ? prev.roundResult : null,
    }))

    // If we already received the next ROUND_START while transitioning, process it now:
    if (queuedRoundStartRef.current) {
      const msg = queuedRoundStartRef.current
      queuedRoundStartRef.current = null
      console.log('[useMatchFlow] Processing queued ROUND_START')
      handleRoundStart(msg)
    }
  }, [handleRoundStart])

  // Sync finishRoundTransition to ref (allows applyRoundResult to call it)
  useEffect(() => {
    finishRoundTransitionRef.current = finishRoundTransition
  }, [finishRoundTransition])

  // Handle ROUND_STATE - authoritative server state
  // Defined early to avoid TDZ issues with useEffect below
  const handleRoundState = useCallback((message: any) => {
    console.log('[useMatchFlow] ROUND_STATE received (authoritative):', message)

    // Get current user ID and match
    const currentUserId = currentUserIdRef.current
    if (!currentUserId) {
      console.warn('[useMatchFlow] No currentUserId, cannot reconcile ROUND_STATE')
      return
    }

    // Determine if current player is player1
    const match = state.match
    if (!match) {
      console.warn('[useMatchFlow] ROUND_STATE before match, queueing for later')
      pendingRoundStateRef.current = message
      return
    }
    const isPlayer1 = currentUserId === (match as any).player1_id

    // Get current player's step progress
    const currentPlayerStep = isPlayer1 ? message.player1CurrentStep : message.player2CurrentStep
    const currentPlayerHasAnswered = isPlayer1 ? message.player1HasAnswered : message.player2HasAnswered

    // Determine if current player has answered the step they should be on
    const hasAnsweredCurrentStep = message.currentStepIndex >= 0 &&
      currentPlayerStep > message.currentStepIndex

    // === NUCLEAR RECONCILIATION ===
    // Clear all local timers/flags
    if (stepTimerIntervalRef.current) {
      clearInterval(stepTimerIntervalRef.current)
      stepTimerIntervalRef.current = null
    }
    if (roundTransitionTimeoutRef.current) {
      clearTimeout(roundTransitionTimeoutRef.current)
      roundTransitionTimeoutRef.current = null
    }
    if (roundResultTimeoutRef.current) {
      clearTimeout(roundResultTimeoutRef.current)
      roundResultTimeoutRef.current = null
    }

    // Clear step tracking
    stepAnswersRef.current.clear()
    thinkingPhaseStartTimeRef.current = null
    stepStartTimeRef.current = null

    // Update refs
    isTransitioningRef.current = message.phase === 'results'
    roundResultRef.current = message.roundResult

    // Only consider match finished if roundResult exists AND indicates match is finished
    // If roundResult is null (game just started), match is not finished
    const isFinished = !!message.roundResult && (!message.roundResult.matchContinues || !!message.roundResult.matchWinnerId)

    // Reconcile state
    setState(prev => {
      // Map question to ensure options are in the correct format (strings, not objects)
      // This prevents .trim() errors when rendering options
      let mappedQuestion = null
      if (message.question) {
        try {
          mappedQuestion = mapRawToQuestion(message.question)
        } catch (error) {
          console.error('[useMatchFlow] Failed to map question from ROUND_STATE:', error)
          // Keep previous question if mapping fails
          mappedQuestion = prev.currentQuestion
        }
      }

      return {
        ...prev,
        // Round state
        currentRound: {
          id: message.roundId,
          roundNumber: message.roundNumber,
          status: message.phase === 'results' ? 'finished' : 'active'
        },
        // Question is always included in ROUND_STATE (even during results phase)
        // Map it to ensure options are in the correct format (strings, not objects)
        currentQuestion: mappedQuestion,

        // Phase state (from server)
        currentStepIndex: message.currentStepIndex,
        isThinkingPhase: message.phase === 'thinking',
        stepTimeLeft: message.deadlineTs ? Math.max(0, (message.deadlineTs - Date.now()) / 1000) : null,
        thinkingTimeLeft: message.phase === 'thinking' && message.deadlineTs
          ? Math.max(0, (message.deadlineTs - Date.now()) / 1000)
          : null,

        // Answer state (from server)
        hasSubmitted: message.phase === 'waiting' || message.phase === 'results',
        hasAnsweredCurrentStep: hasAnsweredCurrentStep,

        // Match state
        match: prev.match ? {
          ...prev.match,
          player1_score: message.player1Score,
          player2_score: message.player2Score,
          status: isFinished ? 'finished' : 'in_progress',
          winner_id: message.roundResult?.matchWinnerId || prev.match.winner_id
        } : null,

        // Round result
        roundResult: message.roundResult,
        isMatchFinished: isFinished,
        isShowingRoundTransition: message.phase === 'results' && !!message.roundResult,
        // Server-driven phase
        phase: message.phase,

        // Clear answer maps (server doesn't send these, so reset)
        playerAnswers: new Map(),
        responseTimes: new Map()
      }
    })

    // Restart timers based on server deadline
    if (message.deadlineTs && message.phase !== 'results') {
      const secondsLeft = Math.max(0, (message.deadlineTs - Date.now()) / 1000)

      if (message.phase === 'thinking') {
        // Start thinking phase timer
        if (startThinkingPhaseRef.current) {
          startThinkingPhaseRef.current(Math.ceil(secondsLeft))
        }
      } else if (message.phase === 'step' && message.currentStepIndex >= 0) {
        // Start step timer
        if (startStepRef.current) {
          startStepRef.current(message.currentStepIndex, Math.ceil(secondsLeft))
        }
      }
    }
  }, [state.match])

  // Apply queued ROUND_STATE when match becomes available
  // This must come AFTER handleRoundState is defined (above)
  useEffect(() => {
    if (state.match && pendingRoundStateRef.current) {
      const queued = pendingRoundStateRef.current
      pendingRoundStateRef.current = null
      console.log('[useMatchFlow] Match now available, applying queued ROUND_STATE')
      handleRoundState(queued)
    }
  }, [state.match, handleRoundState])

  // Timeout warning: If connected with match but no question after 3 seconds, log warning
  useEffect(() => {
    if (state.isConnected && state.match && !state.currentQuestion && !state.currentRound) {
      const timeout = setTimeout(() => {
        console.warn('[useMatchFlow] Connected with match but no ROUND_STATE received after 3s', {
          matchId: state.match?.id,
          hasQueuedState: !!pendingRoundStateRef.current,
          isConnected: state.isConnected
        })
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [state.isConnected, state.match, state.currentQuestion, state.currentRound])

  // Connect to WebSocket
  const connect = useCallback((matchId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[useMatchFlow] Already connected')
      return
    }

    const connectWebSocket = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          toast.error('Not authenticated')
          return
        }

        currentUserIdRef.current = user.id

        // Get session token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.access_token) {
          toast.error('No session token')
          return
        }

        if (!SUPABASE_URL) {
          console.error('[useMatchFlow] SUPABASE_URL not defined')
          toast.error('Missing SUPABASE_URL')
          return
        }

        const wsUrl = `${SUPABASE_URL.replace('http', 'ws')}/functions/v1/game-ws?token=${session.access_token}&match_id=${matchId}`
        console.log('[useMatchFlow] Connecting to:', wsUrl)

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[useMatchFlow] WebSocket connected')
          setState(prev => ({ ...prev, isConnected: true }))

          // Send JOIN_MATCH
          ws.send(JSON.stringify({
            type: 'JOIN_MATCH',
            matchId
          }))
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            console.log('[useMatchFlow] Message received:', message.type)

            if (message.type === 'connected') {
              // Connection confirmed, already sent JOIN_MATCH
              return
            }

            // ROUND_STATE is authoritative - handle it first and return
            if (message.type === 'ROUND_STATE') {
              handleRoundState(message)
              return
            }

            if (message.type === 'MATCH_START') {
              console.log('[useMatchFlow] MATCH_START received')
              // Update match state from message
              if (message.match) {
                setState(prev => ({
                  ...prev,
                  match: message.match as MatchRow
                }))
              } else if (!state.match && matchId) {
                // Fallback: Fetch match data if not in message and not already loaded
                // The useEffect will apply queued ROUND_STATE when match becomes available
                const fetchMatchData = async () => {
                  const { data: matchData } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('id', matchId)
                    .single()
                  
                  if (matchData) {
                    setState(prev => ({
                      ...prev,
                      match: matchData as MatchRow
                    }))
                  }
                }
                fetchMatchData()
              }
            }

            if (message.type === 'ROUND_START') {
              // If we're in transition, queue this message and return
              if (isTransitioningRef.current) {
                console.log('[useMatchFlow] ROUND_START received during transition, queuing...')
                queuedRoundStartRef.current = message
                return
              }

              // Otherwise, process normally
              handleRoundStart(message)
            }

            if (message.type === 'ROUND_RESULT') {
              console.log('[useMatchFlow] ROUND_RESULT received via WS', {
                roundId: message.roundId,
                roundNumber: message.roundNumber,
                roundWinnerId: message.roundWinnerId,
                player1RoundScore: message.player1RoundScore,
                player2RoundScore: message.player2RoundScore,
                matchContinues: message.matchContinues
              })

              const result: RoundResult = {
                roundWinnerId: message.roundWinnerId,
                player1RoundScore: message.player1RoundScore,
                player2RoundScore: message.player2RoundScore,
                matchContinues: message.matchContinues,
                matchWinnerId: message.matchWinnerId
              }

              // Call unified function with roundId
              applyRoundResult(result, 'ws', message.roundId)
            }

            if (message.type === 'MATCH_FINISHED') {
              console.log('[useMatchFlow] MATCH_FINISHED received')
              setState(prev => ({
                ...prev,
                isMatchFinished: true,
                match: prev.match ? {
                  ...prev.match,
                  status: 'finished',
                  winner_id: message.winnerId,
                  player1_score: message.player1FinalScore,
                  player2_score: message.player2FinalScore
                } : null
              }))
            }

            if (message.type === 'GAME_ERROR') {
              console.error('[useMatchFlow] GAME_ERROR:', message.message)
              toast.error(message.message || 'Game error occurred')
            }
          } catch (error) {
            console.error('[useMatchFlow] Error parsing message:', error)
          }
        }

        ws.onerror = (error) => {
          console.error('[useMatchFlow] WebSocket error:', error)
          toast.error('WebSocket connection error')
        }

        ws.onclose = () => {
          console.log('[useMatchFlow] WebSocket closed')
          setState(prev => ({ ...prev, isConnected: false }))
        }
      } catch (error: any) {
        console.error('[useMatchFlow] Connection error:', error)
        toast.error(error.message || 'Failed to connect')
      }
    }

    connectWebSocket()
  }, [])

  // Auto-connect when matchId is available
  useEffect(() => {
    if (matchId && !wsRef.current) {
      connect(matchId)
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      // Clear timeout on unmount
      if (roundResultTimeoutRef.current) {
        clearTimeout(roundResultTimeoutRef.current)
        roundResultTimeoutRef.current = null
      }
      // Clear transition timeout
      if (roundTransitionTimeoutRef.current) {
        clearTimeout(roundTransitionTimeoutRef.current)
        roundTransitionTimeoutRef.current = null
      }
      // Clear step timer
      if (stepTimerIntervalRef.current) {
        clearInterval(stepTimerIntervalRef.current)
        stepTimerIntervalRef.current = null
      }
    }
  }, [matchId, connect])

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [])

  // Set answer for a step
  const setAnswer = useCallback((stepIndex: number, answerIndex: number) => {
    setState(prev => {
      const newAnswers = new Map(prev.playerAnswers)
      newAnswers.set(stepIndex, answerIndex)
      return { ...prev, playerAnswers: newAnswers }
    })
  }, [])

  // Start timer for a step
  const startStepTimer = useCallback((stepIndex: number) => {
    stepTimersRef.current.set(stepIndex, Date.now())
  }, [])

  // Stop timer and record response time
  const stopStepTimer = useCallback((stepIndex: number) => {
    const startTime = stepTimersRef.current.get(stepIndex)
    if (startTime) {
      const responseTime = Date.now() - startTime
      setState(prev => {
        const newTimes = new Map(prev.responseTimes)
        newTimes.set(stepIndex, responseTime)
        return { ...prev, responseTimes: newTimes }
      })
      stepTimersRef.current.delete(stepIndex)
    }
  }, [])

  // Start thinking phase
  const startThinkingPhase = useCallback((durationSeconds: number) => {
    // Clear any existing timers
    if (stepTimerIntervalRef.current) {
      clearInterval(stepTimerIntervalRef.current)
      stepTimerIntervalRef.current = null
    }

    // Store start time for time-based calculation
    const startTime = Date.now()
    thinkingPhaseStartTimeRef.current = startTime

    setState(prev => ({
      ...prev,
      currentStepIndex: -1,
      isThinkingPhase: true,
      thinkingTimeLeft: durationSeconds,
      stepTimeLeft: null,
      hasAnsweredCurrentStep: false
    }))

    // Start countdown timer using time-based calculation (works even when tab is in background)
    stepTimerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const remaining = Math.max(0, durationSeconds - elapsed)

      setState(prev => {
        if (remaining <= 0) {
          // Thinking phase over - start step 0
          if (stepTimerIntervalRef.current) {
            clearInterval(stepTimerIntervalRef.current)
            stepTimerIntervalRef.current = null
          }

          thinkingPhaseStartTimeRef.current = null

          // Start first step
          if (startStepRef.current) {
            startStepRef.current(0, 15)
          }

          return {
            ...prev,
            thinkingTimeLeft: 0,
            isThinkingPhase: false
          }
        }
        return { ...prev, thinkingTimeLeft: remaining }
      })
    }, 100) // Update every 100ms for smoother display
  }, [])

  // Skip thinking phase and start answering immediately
  const skipThinkingPhase = useCallback(() => {
    if (!state.isThinkingPhase) {
      return // Not in thinking phase, do nothing
    }

    // Clear thinking phase timer
    if (stepTimerIntervalRef.current) {
      clearInterval(stepTimerIntervalRef.current)
      stepTimerIntervalRef.current = null
    }

    thinkingPhaseStartTimeRef.current = null

    // Start first step immediately
    if (startStepRef.current && state.currentQuestion && state.currentQuestion.steps.length > 0) {
      startStepRef.current(0, 15)
    }

    setState(prev => ({
      ...prev,
      thinkingTimeLeft: 0,
      isThinkingPhase: false
    }))
  }, [state.isThinkingPhase, state.currentQuestion])

  // Start a step with timer
  const startStep = useCallback((stepIndex: number, durationSeconds: number) => {
    // Clear any existing timer
    if (stepTimerIntervalRef.current) {
      clearInterval(stepTimerIntervalRef.current)
      stepTimerIntervalRef.current = null
    }

    // Store start time for time-based calculation
    const startTime = Date.now()
    stepStartTimeRef.current = startTime

    setState(prev => ({
      ...prev,
      currentStepIndex: stepIndex,
      stepTimeLeft: durationSeconds,
      hasAnsweredCurrentStep: false
    }))

    // Start countdown timer using time-based calculation (works even when tab is in background)
    stepTimerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const remaining = Math.max(0, durationSeconds - elapsed)

      setState(prev => {
        if (remaining <= 0) {
          // Timer expired - submit no answer (wrong)
          if (stepTimerIntervalRef.current) {
            clearInterval(stepTimerIntervalRef.current)
            stepTimerIntervalRef.current = null
          }

          stepStartTimeRef.current = null

          // Do NOT auto-submit if round is already resolved or during transition
          // Use refs to avoid stale closures
          if (roundResultRef.current || isShowingRoundTransitionRef.current || isMatchFinishedRef.current) {
            console.log('[useMatchFlow] Ignoring auto-submit on timer expiry: round already resolved')
            return { ...prev, stepTimeLeft: 0 }
          }

          // Auto-submit with null answer (will be treated as wrong)
          const currentStepIndex = prev.currentStepIndex

          // Hard guards: check state directly (not refs, since we're in setState callback)
          if (prev.roundResult || prev.isShowingRoundTransition || prev.isMatchFinished) {
            console.log('[useMatchFlow] Guard blocked auto-submit on timer expiry:', {
              hasRoundResult: !!prev.roundResult,
              isTransition: prev.isShowingRoundTransition,
              isMatchFinished: prev.isMatchFinished
            })
            return { ...prev, stepTimeLeft: 0 }
          }

          if (!prev.currentRound || !prev.currentQuestion) {
            console.log('[useMatchFlow] Guard blocked auto-submit: missing round or question')
            return { ...prev, stepTimeLeft: 0 }
          }

          // Use composite key: roundId:stepIndex
          const stepKey = `${prev.currentRound.id}:${currentStepIndex}`
          if (stepAnswersRef.current.has(stepKey)) {
            console.log('[useMatchFlow] Guard blocked auto-submit: already answered', stepKey)
            return { ...prev, stepTimeLeft: 0 }
          }

          // Submit step answer with null (wrong)
          stepAnswersRef.current.set(stepKey, -1)

          const payload = {
            version: 1,
            steps: [{
              step_index: currentStepIndex,
              answer_index: -1,
              response_time_ms: prev.responseTimes.get(currentStepIndex) || 0
            }]
          }

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && prev.currentRound) {
            const message = {
              type: 'SUBMIT_ROUND_ANSWER',
              matchId,
              roundId: prev.currentRound.id,
              payload
            }
            console.log('[useMatchFlow] Auto-submitting step answer (timer expired):', {
              roundId: prev.currentRound.id,
              stepIndex: currentStepIndex,
              stepKey,
              message
            })
            wsRef.current.send(JSON.stringify(message))
          }

          // DO NOT auto-advance - wait for ROUND_STATE from server
          // The server will send ROUND_STATE with updated currentStepIndex after processing the answer
          console.log('[useMatchFlow] Auto-submitted step answer (timer expired), waiting for ROUND_STATE from server')

          return { ...prev, stepTimeLeft: 0 }
        }
        return { ...prev, stepTimeLeft: remaining }
      })
    }, 100) // Update every 100ms for smoother display
  }, [matchId])

  // Store startStep in ref so it can be called from anywhere
  useEffect(() => {
    startStepRef.current = startStep
  }, [startStep])

  // Store startThinkingPhase in ref
  useEffect(() => {
    startThinkingPhaseRef.current = startThinkingPhase
  }, [startThinkingPhase])

  // Submit answer for current step
  const submitStepAnswer = useCallback((stepIndex: number, answerIndex: number | null) => {
    // Hard guards: use refs to avoid stale closures
    if (roundResultRef.current || isShowingRoundTransitionRef.current || isMatchFinishedRef.current) {
      console.log('[useMatchFlow] Guard blocked submitStepAnswer: round already resolved', {
        hasRoundResult: !!roundResultRef.current,
        isTransition: isShowingRoundTransitionRef.current,
        isMatchFinished: isMatchFinishedRef.current
      })
      return
    }

    if (!matchId || !state.currentRound || !state.currentQuestion) {
      console.log('[useMatchFlow] Guard blocked submitStepAnswer: missing matchId, round, or question', {
        hasMatchId: !!matchId,
        hasRound: !!state.currentRound,
        hasQuestion: !!state.currentQuestion
      })
      return
    }

    // Use composite key: roundId:stepIndex
    const stepKey = `${state.currentRound.id}:${stepIndex}`
    if (stepAnswersRef.current.has(stepKey)) {
      console.log('[useMatchFlow] Guard blocked submitStepAnswer: already answered', {
        stepKey,
        roundId: state.currentRound.id,
        stepIndex
      })
      return
    }

    setState(prev => {
      // Use composite key: roundId:stepIndex
      const stepKey = `${prev.currentRound!.id}:${stepIndex}`

      // Double-check guard inside setState (defensive)
      if (prev.roundResult || prev.isShowingRoundTransition || prev.isMatchFinished) {
        console.log('[useMatchFlow] Guard blocked submitStepAnswer inside setState: round already resolved')
        return prev
      }

      if (stepAnswersRef.current.has(stepKey)) {
        console.log('[useMatchFlow] Guard blocked submitStepAnswer inside setState: already answered', stepKey)
        return prev
      }

      // Mark as answered locally (don't send to server yet)
      stepAnswersRef.current.set(stepKey, answerIndex ?? -1)

      // Stop timer
      if (stepTimerIntervalRef.current) {
        clearInterval(stepTimerIntervalRef.current)
        stepTimerIntervalRef.current = null
      }

      // Clear step start time
      stepStartTimeRef.current = null

      // Update state with answer
      const newAnswers = new Map(prev.playerAnswers)
      if (answerIndex !== null) {
        newAnswers.set(stepIndex, answerIndex)
      }

      // Check if all steps are answered
      const totalSteps = prev.currentQuestion?.steps?.length || 0
      if (totalSteps === 0) {
        console.warn('[useMatchFlow] No steps in question')
        return prev
      }

      // Get all step indices from the question (they might not be 0-indexed consecutive)
      const stepIndices = prev.currentQuestion.steps.map((step: any, idx: number) => 
        step.index !== undefined ? step.index : idx
      )
      
      // Check if we have answers for all step indices
      const answeredStepIndices = Array.from(newAnswers.keys())
      const allStepsAnswered = stepIndices.every((stepIdx: number) => 
        answeredStepIndices.includes(stepIdx)
      )

      console.log('[useMatchFlow] Step answer collected:', {
        stepIndex,
        answerIndex,
        totalSteps,
        answeredSteps: answeredSteps.length,
        allStepsAnswered
      })

      // If all steps are answered, submit the entire round
      if (allStepsAnswered && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Build payload with ALL steps (only include steps that are in the question)
        const steps = stepIndices
          .map((stepIdx: number) => {
            const ansIdx = newAnswers.get(stepIdx)
            if (ansIdx === undefined) return null
            return {
              step_index: stepIdx,
              answer_index: ansIdx,
              response_time_ms: prev.responseTimes.get(stepIdx) || 0
            }
          })
          .filter((step: any) => step !== null)
          .sort((a: any, b: any) => a.step_index - b.step_index)

        const payload = {
          version: 1,
          steps
        }

        const message = {
          type: 'SUBMIT_ROUND_ANSWER',
          matchId,
          roundId: prev.currentRound!.id,
          payload
        }

        console.log('[useMatchFlow] All steps answered, submitting complete round:', {
          roundId: prev.currentRound!.id,
          totalSteps: steps.length,
          message
        })

        wsRef.current.send(JSON.stringify(message))
      }

      return {
        ...prev,
        hasAnsweredCurrentStep: true,
        playerAnswers: newAnswers,
        stepTimeLeft: null,
        hasSubmitted: allStepsAnswered // Mark as submitted when all steps done
      }
    })

    console.log('[useMatchFlow] Step answer collected locally (batch submission when all steps complete)')
  }, [matchId, state.currentRound, state.currentQuestion])

  // Submit round answer
  const submitRoundAnswer = useCallback(() => {
    // Do NOT allow any answers once round is resolved or during transition
    // Use refs to avoid stale closures
    if (roundResultRef.current || isShowingRoundTransitionRef.current || isMatchFinishedRef.current) {
      console.log('[useMatchFlow] Ignoring submitRoundAnswer: round already resolved')
      return
    }

    if (!matchId) {
      toast.error('No match ID')
      return
    }

    if (!state.currentRound || !state.currentQuestion || state.hasSubmitted) {
      return
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to game server')
      return
    }

    // Build payload from playerAnswers and responseTimes
    const steps = Array.from(state.playerAnswers.entries()).map(([stepIndex, answerIndex]) => {
      const responseTime = state.responseTimes.get(stepIndex) || 0
      return {
        step_index: stepIndex,
        answer_index: answerIndex,
        response_time_ms: responseTime
      }
    })

    // Validate: at least one answer chosen
    if (steps.length === 0) {
      toast.error('Please select an answer')
      return
    }

    // Validate: every step_index exists in currentQuestion.steps
    const questionStepIndices = state.currentQuestion.steps.map(s => s.index)
    const invalidSteps = steps.filter(s => !questionStepIndices.includes(s.step_index))
    if (invalidSteps.length > 0) {
      console.error('[useMatchFlow] Invalid step indices:', invalidSteps)
      toast.error('Invalid answer format')
      return
    }

    // Ensure steps are sorted by step_index
    steps.sort((a, b) => a.step_index - b.step_index)

    const payload = {
      version: 1,
      steps
    }

    const message = {
      type: 'SUBMIT_ROUND_ANSWER',
      matchId,
      roundId: state.currentRound.id,
      payload
    }

    console.log('[useMatchFlow] Submitting answer:', message)
    wsRef.current.send(JSON.stringify(message))

    setState(prev => ({ ...prev, hasSubmitted: true }))
    toast.success('Answer submitted!')

    // Set timeout to check match status if ROUND_RESULT doesn't arrive
    // Clear any existing timeout first
    if (roundResultTimeoutRef.current) {
      clearTimeout(roundResultTimeoutRef.current)
    }

    roundResultTimeoutRef.current = setTimeout(async () => {
      if (!matchId || !state.currentRound) return

      console.log('[useMatchFlow] Timeout: Checking if round was evaluated...')

      // Check the specific current round
      const { data: round } = await supabase
        .from('match_rounds')
        .select('status, player1_answered_at, player2_answered_at, round_number, player1_round_score, player2_round_score, id')
        .eq('id', state.currentRound.id)
        .single()

      if (round && round.status === 'finished' && round.player1_answered_at && round.player2_answered_at) {
        // Round was evaluated, fetch the match to get updated scores
        const { data: match } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single()

        if (match) {
          const targetPoints = (match as any).target_points || 5
          const maxRounds = (match as any).max_rounds || 3
          const p1Score = (match as any).player1_score || 0
          const p2Score = (match as any).player2_score || 0
          const currentRoundNum = (match as any).current_round_number || 0

          const matchContinues =
            p1Score < targetPoints &&
            p2Score < targetPoints &&
            currentRoundNum < maxRounds &&
            match.status === 'in_progress'

          // Create synthetic ROUND_RESULT
          const syntheticResult: RoundResult = {
            roundWinnerId: round.player1_round_score > round.player2_round_score
              ? (match as any).player1_id
              : round.player2_round_score > round.player1_round_score
                ? (match as any).player2_id
                : null,
            player1RoundScore: round.player1_round_score || 0,
            player2RoundScore: round.player2_round_score || 0,
            matchContinues,
            matchWinnerId: !matchContinues ? (match as any).winner_id : null
          }

          console.log('[useMatchFlow] Timeout: Round was evaluated, calling applyRoundResult')
          // ✅ REPLACE direct setState with applyRoundResult
          applyRoundResult(syntheticResult, 'polling', round.id)
        }
      }
    }, 5000) // 5 second timeout (reduced from 10)
  }, [
    state.currentRound,
    state.currentQuestion,
    state.playerAnswers,
    state.responseTimes,
    state.hasSubmitted,
    state.roundResult,
    state.isShowingRoundTransition,
    state.isMatchFinished,
    matchId,
    applyRoundResult
  ])

  return {
    ...state,
    connect,
    disconnect,
    setAnswer,
    startStepTimer,
    stopStepTimer,
    submitRoundAnswer,
    // Step-by-step helpers
    startThinkingPhase,
    skipThinkingPhase,
    startStep,
    submitStepAnswer,
    // Round transition helper (optional, for manual skip)
    finishRoundTransition
  }
}

