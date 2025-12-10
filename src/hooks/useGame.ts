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
  } | null
  // Stage 3: Tug-of-war state
  roundNumber: number
  lastRoundWinner: string | null
  consecutiveWinsCount: number
  matchFinished: boolean
  matchWinner: string | null
  totalRounds: number
  // Timer state
  timerEndAt: string | null
  timeRemaining: number | null // seconds remaining
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
    // Stage 3: Tug-of-war state
    roundNumber: 0,
    lastRoundWinner: null,
    consecutiveWinsCount: 0,
    matchFinished: false,
    matchWinner: null,
    totalRounds: 0,
    // Timer state
    timerEndAt: null,
    timeRemaining: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const submittingAnswerRef = useRef(false)
  const lastSubmissionTimeRef = useRef<number>(0)
  const lastVisibilityCheckRef = useRef<number>(0)

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

  // Timer countdown effect
  useEffect(() => {
    if (!state.timerEndAt || state.status !== 'playing' || state.answerSubmitted) {
      setState(prev => ({ ...prev, timeRemaining: null }))
      return
    }

    const updateTimer = () => {
      const now = new Date().getTime()
      const endTime = new Date(state.timerEndAt!).getTime()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      
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
  }, [state.timerEndAt, state.status, state.answerSubmitted])

  useEffect(() => {
    if (!match) {
      setState({
        status: 'connecting',
        playerRole: null,
        errorMessage: null
      })
      return
    }

    let reconnectTimeout: NodeJS.Timeout | null = null
    let isConnecting = false

    const connect = async () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnecting) {
        console.log('[useGame] Already connecting, skipping duplicate attempt')
        return
      }

      // If WebSocket is already open, don't reconnect
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[useGame] WebSocket already open, skipping connection')
        return
      }

      isConnecting = true

      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          setState({
            status: 'error',
            playerRole: null,
            errorMessage: 'Not authenticated'
          })
          isConnecting = false
          return
        }

        // Verify user is part of match
        if (match.player1_id !== user.id && match.player2_id !== user.id) {
          setState({
            status: 'error',
            playerRole: null,
            errorMessage: 'You are not part of this match'
          })
          isConnecting = false
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
          isConnecting = false
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
          isConnecting = false
          return
        }

        // Close existing connection if any
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }

        const wsUrl = `${SUPABASE_URL.replace('http', 'ws')}/functions/v1/game-ws?token=${session.access_token}&match_id=${match.id}`
        console.log('[useGame] Connecting to:', wsUrl)

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        // Connection timeout (10 seconds)
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.error('[useGame] Connection timeout')
            ws.close()
            isConnecting = false
            // Retry connection after 1 second
            reconnectTimeout = setTimeout(() => {
              connect()
            }, 1000)
          }
        }, 10000)

        ws.onopen = () => {
          clearTimeout(connectionTimeout)
          console.log('[useGame] WebSocket connected')
          isConnecting = false
          setState(prev => ({
            ...prev,
            status: 'connecting',
            errorMessage: null
          }))

          // Send JOIN_MATCH message - ensure it's sent even if tab was in background
          const joinMessage = {
            type: 'JOIN_MATCH',
            match_id: match.id,
            player_id: user.id
          }
          console.log('[useGame] Sending JOIN_MATCH:', joinMessage)
          
          // Ensure message is sent - retry if needed
          if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(joinMessage))
          } else {
            // Wait a bit and retry
            setTimeout(() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(joinMessage))
              }
            }, 100)
          }
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

            if (message.type === 'CONNECTED') {
              console.log('[useGame] CONNECTED message received, updating state')
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
              
              // Guard: Ignore QUESTION_RECEIVED if we're in results phase
              // This prevents the question from restarting while results are being displayed
              if (state.status === 'results') {
                console.log('[useGame] Ignoring QUESTION_RECEIVED - currently showing results, will process after delay')
                // Queue the question to be processed after a short delay
                // This allows results to be displayed before transitioning
                setTimeout(() => {
                  // Re-check state - if still in results, process the question
                  setState(prev => {
                    if (prev.status === 'results') {
                      try {
                        const mappedQuestion = mapRawToQuestion(message.question)
                        const timerEndAt = (message as any).timer_end_at || null
                        submittingAnswerRef.current = false // Reset submission flag for new question
                        return {
                          ...prev,
                          status: 'playing',
                          question: mappedQuestion,
                          errorMessage: null,
                          timerEndAt: timerEndAt,
                          answerSubmitted: false,
                          waitingForOpponent: false,
                          results: null
                        }
                      } catch (error) {
                        console.error('[useGame] Error mapping queued question:', error)
                        return prev
                      }
                    }
                    return prev
                  })
                }, 2000) // Wait 2 seconds before processing
                return
              }
              
              try {
                const mappedQuestion = mapRawToQuestion(message.question)
                const timerEndAt = (message as any).timer_end_at || null
                submittingAnswerRef.current = false // Reset submission flag for new question
                setState(prev => ({
                  ...prev,
                  status: 'playing',
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
              setState(prev => ({
                ...prev,
                status: 'playing',
                question: roundStartEvent.question,
                errorMessage: null
              }))
            } else if (message.type === 'ANSWER_SUBMITTED') {
              console.log('[useGame] ANSWER_SUBMITTED message received')
              submittingAnswerRef.current = false // Reset submission flag
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
              console.log('[useGame] RESULTS_RECEIVED message received')
              setState(prev => ({
                ...prev,
                status: 'results',
                results: {
                  player1_answer: message.player1_answer,
                  player2_answer: message.player2_answer,
                  correct_answer: message.correct_answer,
                  player1_correct: message.player1_correct,
                  player2_correct: message.player2_correct,
                  round_winner: message.round_winner
                },
                waitingForOpponent: false
              }))
            } else if (message.type === 'ROUND_STARTED') {
              console.log('[useGame] ROUND_STARTED message received - new round starting')
              submittingAnswerRef.current = false // Reset submission flag for new round
              setState(prev => ({
                ...prev,
                status: 'playing',
                answerSubmitted: false,
                waitingForOpponent: false,
                results: null,
                roundNumber: message.round_number || 0,
                lastRoundWinner: message.last_round_winner,
                consecutiveWinsCount: message.consecutive_wins_count || 0,
                timerEndAt: null, // Will be set when QUESTION_RECEIVED arrives
                timeRemaining: null
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
          clearTimeout(connectionTimeout)
          isConnecting = false
          
          // Retry connection after 1 second (don't immediately set error state)
          reconnectTimeout = setTimeout(() => {
            connect()
          }, 1000)
        }

        ws.onclose = (event) => {
          console.log('[useGame] WebSocket closed', { code: event.code, reason: event.reason })
          clearTimeout(connectionTimeout)
          isConnecting = false
          
          // Only reconnect if it wasn't a clean close (code 1000 = normal closure)
          if (event.code !== 1000) {
            setState(prev => {
              // Don't reconnect if already in error or finished state
              if (prev.status !== 'error' && prev.status !== 'match_finished') {
                // Retry connection after 1 second
                reconnectTimeout = setTimeout(() => {
                  connect()
                }, 1000)
                return {
                  ...prev,
                  status: 'connecting'
                }
              }
              return prev
            })
          } else {
            // Clean close - don't reconnect
          setState(prev => {
              if (prev.status !== 'error' && prev.status !== 'match_finished') {
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
        isConnecting = false
        setState({
          status: 'error',
          playerRole: null,
          errorMessage: error.message || 'Failed to connect'
        })
      }
    }

    connect()

    // Handle visibility change - reconnect when tab becomes visible
    // Only reconnect if not in active game state and only if actually needed
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Throttle visibility checks - only check once every 2 seconds
        const now = Date.now()
        const timeSinceLastCheck = now - lastVisibilityCheckRef.current
        if (timeSinceLastCheck < 2000) {
          // Too soon since last check, skip
          return
        }
        lastVisibilityCheckRef.current = now
        
        // Don't do anything if we're in an active game state
        // This prevents any disruption during gameplay
        const activeGameStates = ['playing', 'results', 'both_connected']
        if (activeGameStates.includes(state.status)) {
          // In active game - don't check anything, just return silently
          return
        }
        
        // Only check connection if we're in early connection states
        if (state.status === 'connecting' || state.status === 'connected') {
          // Check if WebSocket is actually disconnected (not just checking status)
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.log('[useGame] WebSocket disconnected, reconnecting...')
            connect()
          }
          // If WebSocket is open, don't re-send JOIN_MATCH - it's already connected
          // The server will handle reconnections automatically if needed
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [match?.id])

  const submitAnswer = useCallback((answerIndex: number) => {
    if (answerIndex !== 0 && answerIndex !== 1) {
      console.error('[useGame] Invalid answer index:', answerIndex)
      return
    }

    // Debounce: Prevent rapid duplicate submissions (within 500ms)
    const now = Date.now()
    const timeSinceLastSubmission = now - lastSubmissionTimeRef.current
    if (timeSinceLastSubmission < 500) {
      console.warn('[useGame] Submission debounced - too soon after last submission')
      return
    }

    // Check if already submitting
    if (submittingAnswerRef.current) {
      console.warn('[useGame] Answer submission already in progress')
      return
    }

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
      // Double-check state before submitting
      if (prev.answerSubmitted) {
        console.warn('[useGame] Answer already submitted')
        return prev
      }

      // Don't allow submission if not in playing state
      if (prev.status !== 'playing') {
        console.warn('[useGame] Cannot submit answer - not in playing state:', prev.status)
        return prev
      }

      // Mark as submitting
      submittingAnswerRef.current = true
      lastSubmissionTimeRef.current = now

      const submitMessage = {
        type: 'SUBMIT_ANSWER',
        answer: answerIndex
      }
      console.log('[useGame] Sending SUBMIT_ANSWER:', submitMessage)
      
      try {
      ws.send(JSON.stringify(submitMessage))
      } catch (error) {
        console.error('[useGame] Error sending SUBMIT_ANSWER:', error)
        submittingAnswerRef.current = false
        return {
          ...prev,
          status: 'error',
          errorMessage: 'Failed to send answer'
        }
      }
      
      // Optimistically update UI - show "submitted" immediately
      // Server will confirm and update waitingForOpponent status via ANSWER_SUBMITTED message
      return {
        ...prev,
        answerSubmitted: true,
        waitingForOpponent: false // Show "Answer submitted!" first, server will update if opponent hasn't answered
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
    submitAnswer
  }
}
