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
    if (!state.stepEndsAt || state.phase !== 'steps') {
      setState(prev => ({ ...prev, stepTimeLeft: null }))
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const endTime = new Date(state.stepEndsAt!).getTime()
      const remaining = Math.max(0, Math.round((endTime - now) / 1000))
      
      setState(prev => ({ ...prev, stepTimeLeft: remaining }))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [state.stepEndsAt, state.phase])

  useEffect(() => {
    if (!match) {
      setState({
        status: 'connecting',
        playerRole: null,
        errorMessage: null
      })
      return
    }

    const connect = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          setState({
            status: 'error',
            playerRole: null,
            errorMessage: 'Not authenticated'
          })
          return
        }

        userIdRef.current = user.id
        matchIdRef.current = match.id

        // Verify user is part of match
        if (match.player1_id !== user.id && match.player2_id !== user.id) {
          setState({
            status: 'error',
            playerRole: null,
            errorMessage: 'You are not part of this match'
          })
          return
        }

        // Get session token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.access_token) {
          setState({
            status: 'error',
            playerRole: null,
            errorMessage: 'No session token'
          })
          return
        }

        // Build WebSocket URL
        if (!SUPABASE_URL) {
          console.error('[useGame] ❌ SUPABASE_URL is not defined')
          setState({
            status: 'error',
            playerRole: null,
            errorMessage: 'Missing SUPABASE_URL'
          })
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
              console.log('[useGame] PHASE_CHANGE message received', message)
              if (message.phase === 'steps') {
                setState(prev => ({
                  ...prev,
                  phase: 'steps',
                  currentStepIndex: message.stepIndex ?? message.currentStepIndex ?? 0,
                  totalSteps: message.totalSteps ?? prev.totalSteps,
                  stepEndsAt: message.stepEndsAt || null,
                  currentStep: message.currentStep || null,
                  answerSubmitted: false,
                  waitingForOpponent: false
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
                answerSubmitted: true,
                waitingForOpponent: message.waitingForOpponent
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
              console.log('[useGame] RESULTS_RECEIVED message received', message)
              console.log('[useGame] Full message structure:', JSON.stringify(message, null, 2))
              
              // Clear polling fallback (WS message arrived)
              if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current)
                pollingTimeoutRef.current = null
              }
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
              
              const msg = message as any
              
              // Validate required fields
              if (msg.player1_answer === undefined && msg.player2_answer === undefined && !msg.stepResults) {
                console.error('[useGame] ❌ RESULTS_RECEIVED missing required fields:', msg)
              }
              
              setState(prev => {
                const newState = {
                  ...prev,
                  status: 'results' as const,
                  phase: 'result' as const,
                  results: {
                    player1_answer: msg.player1_answer ?? null,
                    player2_answer: msg.player2_answer ?? null,
                    correct_answer: msg.correct_answer ?? 0,
                    player1_correct: msg.player1_correct ?? false,
                    player2_correct: msg.player2_correct ?? false,
                    round_winner: msg.round_winner ?? null,
                    p1Score: msg.p1Score,
                    p2Score: msg.p2Score,
                    stepResults: msg.stepResults
                  },
                  waitingForOpponent: false,
                  // Update match-level state
                  currentRoundNumber: msg.roundNumber ?? prev.currentRoundNumber,
                  targetRoundsToWin: msg.targetRoundsToWin ?? prev.targetRoundsToWin,
                  playerRoundWins: msg.playerRoundWins ?? prev.playerRoundWins,
                  matchOver: msg.matchOver ?? false,
                  matchWinnerId: msg.matchWinnerId ?? null,
                  matchFinished: msg.matchOver ?? false,
                  matchWinner: msg.matchWinnerId ?? prev.matchWinner
                }
                
                console.log('[useGame] ✅ State updated with results:', {
                  status: newState.status,
                  hasResults: !!newState.results,
                  player1_answer: newState.results?.player1_answer,
                  player2_answer: newState.results?.player2_answer,
                  round_winner: newState.results?.round_winner
                })
                
                return newState
              })
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
        setState({
          status: 'error',
          playerRole: null,
          errorMessage: error.message || 'Failed to connect'
        })
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
          
          // Start 2s timeout - if RESULTS_RECEIVED doesn't arrive, start polling
          pollingTimeoutRef.current = window.setTimeout(() => {
            console.log('[useGame] RESULTS_RECEIVED not received in 2s, starting polling fallback')
            startPollingForResults(matchIdRef.current!)
          }, 2000)
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
  
  // Polling function for results fallback - queries database if WebSocket message doesn't arrive
  const startPollingForResults = useCallback(async (matchId: string) => {
    console.log('[useGame] 🔄 Polling fallback: Querying database for results')
    
    let pollCount = 0
    const maxPolls = 15 // Poll for up to 15 seconds (15 attempts at 1s intervals)
    
    const poll = async () => {
      pollCount++
      try {
        // Try RPC first
        let pollData = null
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_match_round_state_v2', {
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
          const { data: matchData, error: matchError } = await supabase
            .from('matches')
            .select('player1_answer, player2_answer, correct_answer, player1_correct, player2_correct, round_winner, results_computed_at, winner_id, status, player1_id, player2_id')
            .eq('id', matchId)
            .single()
          
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
          
          // Check if both answered and results are computed (results_computed_at being set means results exist)
          // Note: Results might be cleared if next round started, so we check results_computed_at timestamp
          const resultsReady = matchData && 
                               matchData.player1_answer !== null && 
                               matchData.player2_answer !== null && 
                               matchData.results_computed_at !== null
          
          console.log('[useGame] Direct query result check:', {
            hasMatchData: !!matchData,
            player1_answer: matchData?.player1_answer,
            player2_answer: matchData?.player2_answer,
            results_computed_at: matchData?.results_computed_at,
            resultsReady
          })
          
          if (resultsReady) {
            // Try to get optional columns if they exist (round_wins, round_number might not be in schema)
            let player1RoundWins = 0
            let player2RoundWins = 0
            let targetRoundsToWin = 4
            let roundNumber = 1
            
            try {
              const { data: extendedMatchData, error: extendedError } = await supabase
                .from('matches')
                .select('player1_round_wins, player2_round_wins, target_rounds_to_win, round_number')
                .eq('id', matchId)
                .single()
              
              if (!extendedError && extendedMatchData) {
                player1RoundWins = extendedMatchData.player1_round_wins ?? 0
                player2RoundWins = extendedMatchData.player2_round_wins ?? 0
                targetRoundsToWin = extendedMatchData.target_rounds_to_win ?? 4
                roundNumber = extendedMatchData.round_number ?? 1
              }
            } catch (err) {
              // Optional columns don't exist, use defaults
              console.log('[useGame] Optional columns (round_wins, round_number) not available, using defaults')
            }
            
            pollData = {
              both_answered: true,
              result: {
                player1_answer: matchData.player1_answer,
                player2_answer: matchData.player2_answer,
                correct_answer: matchData.correct_answer,
                player1_correct: matchData.player1_correct,
                player2_correct: matchData.player2_correct,
                round_winner: matchData.round_winner,
                round_number: roundNumber,
                target_rounds_to_win: targetRoundsToWin,
                player1_round_wins: player1RoundWins,
                player2_round_wins: player2RoundWins,
                player_round_wins: {
                  [matchData.player1_id]: player1RoundWins,
                  [matchData.player2_id]: player2RoundWins
                },
                match_over: matchData.winner_id !== null || matchData.status === 'finished',
                match_winner_id: matchData.winner_id
              }
            }
            
            console.log('[useGame] ✅ Constructed pollData from direct query:', {
              both_answered: pollData.both_answered,
              hasResult: !!pollData.result,
              round_winner: pollData.result?.round_winner
            })
          } else {
            // Results not ready yet - log why
            if (pollCount <= 3) {
              console.log('[useGame] Results not ready yet (poll', pollCount, '):', {
                hasMatchData: !!matchData,
                p1_answer: matchData?.player1_answer,
                p2_answer: matchData?.player2_answer,
                results_computed: !!matchData?.results_computed_at
              })
            }
            if (pollCount >= maxPolls) {
              console.warn('[useGame] ⚠️ Polling timeout: Results not available after', maxPolls, 'attempts')
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
        
        if (data?.both_answered && data.result) {
          // Results ready - process as RESULTS_RECEIVED message
          console.log('[useGame] ✅ Polling detected results, processing as RESULTS_RECEIVED')
          
          // Clear polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current)
            pollingTimeoutRef.current = null
          }
          
          // Update state same as WS RESULTS_RECEIVED handler
          setState(prev => {
            // Don't update if already showing results (avoid race condition)
            if (prev.status === 'results') {
              console.log('[useGame] Already showing results, ignoring polled results')
              return prev
            }
            
            const newState = {
              ...prev,
              status: 'results' as const,
              phase: 'result' as const,
              results: {
                player1_answer: data.result.player1_answer,
                player2_answer: data.result.player2_answer,
                correct_answer: data.result.correct_answer,
                player1_correct: data.result.player1_correct,
                player2_correct: data.result.player2_correct,
                round_winner: data.result.round_winner,
                p1Score: data.result.player1_round_wins,
                p2Score: data.result.player2_round_wins
              },
              waitingForOpponent: false,
              currentRoundNumber: data.result.round_number,
              targetRoundsToWin: data.result.target_rounds_to_win,
              playerRoundWins: data.result.player_round_wins,
              matchOver: data.result.match_over,
              matchWinnerId: data.result.match_winner_id,
              matchFinished: data.result.match_over,
              matchWinner: data.result.match_winner_id
            }
            
            console.log('[useGame] ✅ State updated from polling with results:', {
              status: newState.status,
              round_winner: newState.results?.round_winner
            })
            
            return newState
          })
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
    
    // Poll immediately, then every 1 second
    poll()
    pollingIntervalRef.current = window.setInterval(poll, 1000)
  }, [])

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
