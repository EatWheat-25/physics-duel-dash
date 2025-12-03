import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { mapRawToQuestion } from '@/utils/questionMapper'
import type { MatchRow } from '@/types/schema'
import type { StepBasedQuestion } from '@/types/questions'

/**
 * Round result from ROUND_RESULT message
 */
export type RoundResult = {
  roundWinnerId: string | null
  player1RoundScore: number
  player2RoundScore: number
  matchContinues: boolean
  matchWinnerId: string | null
}

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
    hasSubmitted: false
  })

  const wsRef = useRef<WebSocket | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const stepTimersRef = useRef<Map<number, number>>(new Map()) // stepIndex -> startTime

  // Fetch match data
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
        toast.error('Failed to load match')
        return
      }

      setState(prev => ({ ...prev, match: data as MatchRow }))
    }

    fetchMatch()
  }, [matchId])

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

            if (message.type === 'MATCH_START') {
              console.log('[useMatchFlow] MATCH_START received')
              // Match started, round will come next
            }

            if (message.type === 'ROUND_START') {
              console.log('[useMatchFlow] ROUND_START received')
              console.log('[useMatchFlow] Raw question from WS:', JSON.stringify(message.question, null, 2))
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
                  hasSubmitted: false
                }))
              } catch (error) {
                console.error('[useMatchFlow] Error mapping question:', error)
                console.error('[useMatchFlow] Error stack:', error instanceof Error ? error.stack : 'No stack')
                toast.error('Failed to load question')
              }
            }

            if (message.type === 'ROUND_RESULT') {
              console.log('[useMatchFlow] ROUND_RESULT received')
              const roundResult: RoundResult = {
                roundWinnerId: message.roundWinnerId,
                player1RoundScore: message.player1RoundScore,
                player2RoundScore: message.player2RoundScore,
                matchContinues: message.matchContinues,
                matchWinnerId: message.matchWinnerId
              }
              
              // Update match scores by accumulating round scores (no DB refetch needed)
              setState(prev => ({
                ...prev,
                roundResult,
                match: prev.match ? {
                  ...prev.match,
                  player1_score: ((prev.match as any).player1_score || 0) + message.player1RoundScore,
                  player2_score: ((prev.match as any).player2_score || 0) + message.player2RoundScore,
                  current_round_number: message.roundNumber
                } : null
              }))
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

  // Submit round answer
  const submitRoundAnswer = useCallback(() => {
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
  }, [state.currentRound, state.currentQuestion, state.playerAnswers, state.responseTimes, state.hasSubmitted, matchId])

  return {
    ...state,
    connect,
    disconnect,
    setAnswer,
    startStepTimer,
    stopStepTimer,
    submitRoundAnswer
  }
}

