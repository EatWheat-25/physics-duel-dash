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
  results: {
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
  currentStepIndex: number
  totalSteps: number
  mainQuestionEndsAt: string | null
  stepEndsAt: string | null
  mainQuestionTimeLeft: number | null
  stepTimeLeft: number | null
  currentStep: any | null
  // Match-level state (rounds system)
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
  phase: 'thinking'
  question: any
  thinkingEndsAt: string
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
    currentStepIndex: 0,
    totalSteps: 0,
    mainQuestionEndsAt: null,
    stepEndsAt: null,
    mainQuestionTimeLeft: null,
    stepTimeLeft: null,
    currentStep: null,
    // Match-level state (rounds system)
    currentRoundNumber: 1,
    targetRoundsToWin: 4,
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
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const localResultsVersionRef = useRef<number>(0)

  // Shared function to apply results from payload (used by both Realtime and WS handlers)
  const applyResults = useCallback((payload: any) => {
    console.log('[useGame] applyResults called with payload:', payload)
    
    // Build results object from payload (handles both simple and multi-step modes)
    const mode = payload.mode || 'simple'
    const results = {
      player1_answer: mode === 'simple' ? payload.p1?.answer ?? null : null,
      player2_answer: mode === 'simple' ? payload.p2?.answer ?? null : null,
      correct_answer: payload.correct_answer ?? 0,
      player1_correct: payload.p1?.correct ?? false,
      player2_correct: payload.p2?.correct ?? false,
      round_winner: payload.round_winner ?? null,
      p1Score: payload.p1?.total ?? 0,
      p2Score: payload.p2?.total ?? 0,
      stepResults: mode === 'steps' ? payload.p1?.steps : undefined
    }

    setState(prev => {
      // Don't update if already showing results with same or newer version
      if (prev.status === 'results' && payload.round_number && payload.round_number < prev.currentRoundNumber) {
        console.log('[useGame] Ignoring older round results')
        return prev
      }

      return {
        ...prev,
        status: 'results' as const,
        phase: 'result' as const,
        results,
        waitingForOpponent: false,
        currentRoundNumber: payload.round_number ?? prev.currentRoundNumber,
        playerRoundWins: {
          ...prev.playerRoundWins,
          // Wins are in payload.p1.total and payload.p2.total but we'd need player IDs to map them
          // For now, keep existing wins - they'll be updated from match state
        },
        matchOver: false, // Will be determined from match status
        matchWinnerId: null
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
    const timestamp = new Date().toISOString()
    
    if (!state.stepEndsAt || state.phase !== 'steps') {
      if (state.stepTimeLeft !== null) {
        console.log(`[useGame] [${timestamp}] [STEP_TIMER] [STOPPED] stepEndsAt=${state.stepEndsAt} phase=${state.phase} - clearing timer`)
      }
      setState(prev => ({ ...prev, stepTimeLeft: null }))
      return
    }

    console.log(`[useGame] [${timestamp}] [STEP_TIMER] [STARTED] stepIndex=${state.currentStepIndex} stepEndsAt=${state.stepEndsAt} phase=${state.phase}`)

    const updateTimer = () => {
      const now = Date.now()
      const endTime = new Date(state.stepEndsAt!).getTime()
      const remaining = Math.max(0, Math.round((endTime - now) / 1000))
      
      setState(prev => {
        // Only log every 5 seconds or when time is critical (<= 5 seconds)
        if (remaining % 5 === 0 || remaining <= 5) {
          console.log(`[useGame] [${new Date().toISOString()}] [STEP_TIMER] [UPDATE] stepIndex=${prev.currentStepIndex} timeLeft=${remaining}s`)
        }
        
        if (remaining === 0 && prev.stepTimeLeft !== null) {
          console.log(`[useGame] [${new Date().toISOString()}] [STEP_TIMER] [EXPIRED] stepIndex=${prev.currentStepIndex} - timer reached 0`)
        }
        
        return { ...prev, stepTimeLeft: remaining }
      })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    
    return () => {
      console.log(`[useGame] [${new Date().toISOString()}] [STEP_TIMER] [CLEANUP] stepIndex=${state.currentStepIndex} - clearing interval`)
      clearInterval(interval)
    }
  }, [state.stepEndsAt, state.phase, state.currentStepIndex])

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
                  results: null
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
              const roundStartEvent = message as RoundStartEvent
              if (roundStartEvent.phase === 'main_question') {
                // Multi-step question - main question phase
                setState(prev => ({
                  ...prev,
                  status: 'playing',
                  phase: 'main_question',
                  question: roundStartEvent.question,
                  mainQuestionEndsAt: roundStartEvent.mainQuestionEndsAt || null,
                  totalSteps: roundStartEvent.totalSteps || 0,
                  currentStepIndex: 0,
                  answerSubmitted: false,
                  waitingForOpponent: false,
                  results: null,
                  errorMessage: null
                }))
              } else {
                // Single-step question - existing flow
                setState(prev => ({
                  ...prev,
                  status: 'playing',
                  phase: 'question',
                  question: roundStartEvent.question,
                  errorMessage: null
                }))
              }
            } else if (message.type === 'PHASE_CHANGE') {
              const timestamp = new Date().toISOString()
              console.log(`[useGame] [${timestamp}] [PHASE_CHANGE] [MESSAGE_RECEIVED]`, message)
              
              if (message.phase === 'steps') {
                setState(prev => {
                  const oldStepIndex = prev.currentStepIndex
                  const newStepIndex = message.stepIndex ?? message.currentStepIndex ?? 0
                  const stepChanged = oldStepIndex !== newStepIndex
                  
                  console.log(`[useGame] [${timestamp}] [PHASE_CHANGE] [STATE_BEFORE] phase=${prev.phase} currentStepIndex=${prev.currentStepIndex} totalSteps=${prev.totalSteps} answerSubmitted=${prev.answerSubmitted} stepEndsAt=${prev.stepEndsAt}`)
                  console.log(`[useGame] [${timestamp}] [PHASE_CHANGE] [STEP_TRANSITION] oldStepIndex=${oldStepIndex} newStepIndex=${newStepIndex} stepChanged=${stepChanged}`)
                  
                  const newState = {
                    ...prev,
                    phase: 'steps',
                    currentStepIndex: newStepIndex,
                    totalSteps: message.totalSteps ?? prev.totalSteps,
                    stepEndsAt: message.stepEndsAt || null,
                    currentStep: message.currentStep || null,
                    answerSubmitted: false,
                    waitingForOpponent: false
                  }
                  
                  console.log(`[useGame] [${timestamp}] [PHASE_CHANGE] [STATE_AFTER] phase=${newState.phase} currentStepIndex=${newState.currentStepIndex} totalSteps=${newState.totalSteps} answerSubmitted=${newState.answerSubmitted} stepEndsAt=${newState.stepEndsAt}`)
                  console.log(`[useGame] [${timestamp}] [PHASE_CHANGE] [STEP_INFO] stepId=${message.currentStep?.id} prompt="${message.currentStep?.prompt?.substring(0, 50)}..." options=${message.currentStep?.options?.length}`)
                  
                  return newState
                })
              } else {
                // Other phase changes (choosing, result)
                setState(prev => {
                  console.log(`[useGame] [${timestamp}] [PHASE_CHANGE] [OTHER_PHASE] phase=${message.phase} currentStepIndex=${message.currentStepIndex ?? prev.currentStepIndex}`)
                  return {
                    ...prev,
                    phase: message.phase === 'choosing' ? 'question' : 'result',
                    currentStepIndex: message.currentStepIndex ?? prev.currentStepIndex,
                    totalSteps: message.totalSteps ?? prev.totalSteps
                  }
                })
              }
            } else if (message.type === 'STEP_ANSWER_RECEIVED') {
              const timestamp = new Date().toISOString()
              console.log(`[useGame] [${timestamp}] [STEP_ANSWER_RECEIVED] [MESSAGE_RECEIVED] stepIndex=${message.stepIndex} playerId=${message.playerId} waitingForOpponent=${message.waitingForOpponent}`)
              
              setState(prev => {
                console.log(`[useGame] [${timestamp}] [STEP_ANSWER_RECEIVED] [STATE_BEFORE] answerSubmitted=${prev.answerSubmitted} waitingForOpponent=${prev.waitingForOpponent}`)
                const newState = {
                  ...prev,
                  answerSubmitted: true,
                  waitingForOpponent: message.waitingForOpponent
                }
                console.log(`[useGame] [${timestamp}] [STEP_ANSWER_RECEIVED] [STATE_AFTER] answerSubmitted=${newState.answerSubmitted} waitingForOpponent=${newState.waitingForOpponent}`)
                return newState
              })
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
              
              // If message has results_version, check if we've already processed a newer version
              if (msg.results_version !== undefined && msg.results_version <= localResultsVersionRef.current) {
                console.log('[useGame] Ignoring WS RESULTS_RECEIVED - already have newer version via Realtime')
                return
              }

              // Map WS message format to payload format for applyResults
              // Note: WS message might have different structure, try to map it
              if (msg.results_payload) {
                // If message has results_payload, use it directly
                if (msg.results_version) {
                  localResultsVersionRef.current = msg.results_version
                }
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
            } else if (message.type === 'ROUND_STARTED') {
              console.log('[useGame] ROUND_STARTED message received - new round starting')
              setState(prev => ({
                ...prev,
                status: 'playing',
                phase: 'question',
                answerSubmitted: false,
                waitingForOpponent: false,
                results: null,
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
                currentStep: null
              }))
            } else if (message.type === 'MATCH_FINISHED') {
              console.log('[useGame] MATCH_FINISHED message received')
              setState(prev => ({
                ...prev,
                status: 'match_finished',
                matchFinished: true,
                matchWinner: message.winner_id,
                totalRounds: message.total_rounds || 0,
                answerSubmitted: false,
                waitingForOpponent: false
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
          .select('results_computed_at, results_payload, results_version, results_round_id, current_round_id, status, winner_id')
          .eq('id', match.id)
          .single() as { data: any; error: any }

        if (error || !matchData) return

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

        // Detect results_computed_at NULL → NOT NULL transition
        const oldResultsComputed = payload.old?.results_computed_at
        const newResultsComputed = payload.new?.results_computed_at
        const newPayload = payload.new

        if (oldResultsComputed === null && newResultsComputed !== null) {
          // Results just computed
          console.log('[useGame] Results computed detected via Realtime')

          // Validate before accepting (prevent ghost updates)
          if (
            newPayload.results_payload != null &&
            newPayload.results_version > localResultsVersionRef.current &&
            newPayload.results_round_id === newPayload.current_round_id
          ) {
            console.log('[useGame] ✅ Accepting Realtime results (validated)')
            localResultsVersionRef.current = newPayload.results_version
            applyResults(newPayload.results_payload)
          } else {
            console.log('[useGame] ⚠️ Ignoring Realtime results (failed validation):', {
              hasPayload: newPayload.results_payload != null,
              versionCheck: newPayload.results_version > localResultsVersionRef.current,
              roundMatch: newPayload.results_round_id === newPayload.current_round_id,
              results_version: newPayload.results_version,
              local_version: localResultsVersionRef.current
            })
          }
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
        // Step-based answer
        const submitMessage = {
          type: 'SUBMIT_STEP_ANSWER',
          stepIndex: prev.currentStepIndex,
          answerIndex: answerIndex
        }
        console.log('[useGame] Sending SUBMIT_STEP_ANSWER:', submitMessage)
        ws.send(JSON.stringify(submitMessage))
      } else {
        // Single-step answer
        if (answerIndex !== 0 && answerIndex !== 1) {
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
    const timestamp = new Date().toISOString()
    const ws = wsRef.current
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error(`[useGame] [${timestamp}] [submitStepAnswer] [ERROR] WebSocket not connected readyState=${ws?.readyState}`)
      return
    }

    setState(prev => {
      if (prev.answerSubmitted) {
        console.warn(`[useGame] [${timestamp}] [submitStepAnswer] [ALREADY_SUBMITTED] stepIndex=${stepIndex} - answer already submitted for this step`)
        return prev
      }

      console.log(`[useGame] [${timestamp}] [submitStepAnswer] [BEFORE_SEND] stepIndex=${stepIndex} answerIndex=${answerIndex} currentStepIndex=${prev.currentStepIndex} phase=${prev.phase}`)

      const submitMessage = {
        type: 'SUBMIT_STEP_ANSWER',
        stepIndex,
        answerIndex
      }
      
      console.log(`[useGame] [${timestamp}] [submitStepAnswer] [SENDING]`, submitMessage)
      ws.send(JSON.stringify(submitMessage))
      console.log(`[useGame] [${timestamp}] [submitStepAnswer] [SENT] stepIndex=${stepIndex} answerIndex=${answerIndex}`)
      
      const newState = {
        ...prev,
        answerSubmitted: true,
        waitingForOpponent: false
      }
      
      console.log(`[useGame] [${timestamp}] [submitStepAnswer] [STATE_UPDATED] answerSubmitted=${newState.answerSubmitted} waitingForOpponent=${newState.waitingForOpponent}`)
      
      return newState
    })
  }, [])

  return {
    status: state.status,
    playerRole: state.playerRole,
    errorMessage: state.errorMessage,
    question: state.question,
    answerSubmitted: state.answerSubmitted,
    waitingForOpponent: state.waitingForOpponent,
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
    currentStep: state.currentStep,
    submitEarlyAnswer,
    submitStepAnswer,
    // Match-level state (rounds system)
    currentRoundNumber: state.currentRoundNumber,
    targetRoundsToWin: state.targetRoundsToWin,
    playerRoundWins: state.playerRoundWins,
    matchOver: state.matchOver,
    matchWinnerId: state.matchWinnerId
  }
}
