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

    const handlePolledQuestion = (event: CustomEvent) => {
      const detail = event.detail
      console.log('[useGame] Polling detected question - updating state manually')
      try {
        // The question is already mapped in BattleConnected
        setState(prev => ({
          ...prev,
          status: 'playing',
          question: detail.question,
          errorMessage: null,
          timerEndAt: detail.timer_end_at,
          answerSubmitted: false,
          waitingForOpponent: false,
          results: null
        }))
        console.log('[useGame] ✅ State updated with polled question')
      } catch (error) {
        console.error('[useGame] Error handling polled question:', error)
      }
    }

    window.addEventListener('polling-results-detected', handlePollingResults as EventListener)
    window.addEventListener('question-polled-from-db', handlePolledQuestion as EventListener)
    return () => {
      window.removeEventListener('polling-results-detected', handlePollingResults as EventListener)
      window.removeEventListener('question-polled-from-db', handlePolledQuestion as EventListener)
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
              console.log('[useGame] Waiting for QUESTION_RECEIVED or ROUND_START...')
              setState(prev => ({
                ...prev,
                status: 'both_connected',
                errorMessage: null
              }))
              // Note: Server should send QUESTION_RECEIVED shortly after BOTH_CONNECTED
              // If it doesn't arrive within a few seconds, we'll need to handle that
            } else if (message.type === 'QUESTION_RECEIVED') {
              console.log('[useGame] ✅ QUESTION_RECEIVED message received!')
              console.log('[useGame] Question data:', {
                hasQuestion: !!message.question,
                questionId: message.question?.id,
                hasSteps: !!message.question?.steps,
                stepsLength: Array.isArray(message.question?.steps) ? message.question.steps.length : 'not array',
                timerEndAt: (message as any).timer_end_at
              })
              try {
                const mappedQuestion = mapRawToQuestion(message.question)
                const timerEndAt = (message as any).timer_end_at || null
                console.log('[useGame] ✅ Question mapped successfully:', {
                  questionId: mappedQuestion?.id,
                  title: mappedQuestion?.title,
                  stepsCount: mappedQuestion?.steps?.length
                })
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
                console.log('[useGame] ✅ State updated to playing with question')
              } catch (error) {
                console.error('[useGame] ❌ Error mapping question:', error)
                console.error('[useGame] Raw question object:', message.question)
                setState(prev => ({
                  ...prev,
                  status: 'error',
                  errorMessage: 'Failed to process question: ' + (error instanceof Error ? error.message : String(error))
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
          setState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: 'WebSocket connection error'
          }))
        }

        ws.onclose = (event) => {
          console.log('[useGame] WebSocket closed', { code: event.code, reason: event.reason, wasClean: event.wasClean })
          // Don't reset to 'connecting' if we're in a game state - the connection might have closed
          // but we should still show the current state (question might have been received)
          setState(prev => {
            // Only reset if we're in early connection states
            if (prev.status === 'connecting' || prev.status === 'connected') {
              return {
                ...prev,
                status: 'connecting'
              }
            }
            // For 'both_connected', 'playing', 'results' - keep the state
            // The question might have been received before close
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
    }
  }, [match?.id])

  const submitAnswer = useCallback((answerIndex: number) => {
    if (answerIndex !== 0 && answerIndex !== 1) {
      console.error('[useGame] Invalid answer index:', answerIndex)
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
      if (prev.answerSubmitted) {
        console.warn('[useGame] Answer already submitted')
        return prev
      }

      const submitMessage = {
        type: 'SUBMIT_ANSWER',
        answer: answerIndex
      }
      console.log('[useGame] Sending SUBMIT_ANSWER:', submitMessage)
      ws.send(JSON.stringify(submitMessage))
      
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
