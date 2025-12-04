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
  // Step-by-step state
  currentStepIndex: number // -1 = thinking phase, 0+ = step index
  stepTimeLeft: number | null
  hasAnsweredCurrentStep: boolean
  thinkingTimeLeft: number | null // Timer for thinking phase
  isThinkingPhase: boolean // Whether we're in thinking phase
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
    isThinkingPhase: false
  })

  const wsRef = useRef<WebSocket | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const stepTimersRef = useRef<Map<number, number>>(new Map()) // stepIndex -> startTime
  const roundResultTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stepTimerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const stepAnswersRef = useRef<Map<number, number>>(new Map()) // Track which steps we've answered
  const startStepRef = useRef<((stepIndex: number, durationSeconds: number) => void) | null>(null)
  const startThinkingPhaseRef = useRef<((durationSeconds: number) => void) | null>(null)

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
        .select('status, player1_answered_at, player2_answered_at, player1_round_score, player2_round_score, round_number, question_id')
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

          setState(prev => ({
            ...prev,
            roundResult: syntheticResult,
            hasSubmitted: false,
            isMatchFinished: !matchContinues,
            match: matchData as MatchRow
          }))
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
            currentStepIndex: prev.currentQuestion?.steps.length || 0, // Set to beyond last step
            isThinkingPhase: false,
            thinkingTimeLeft: null,
            stepTimeLeft: null
          }))
        } else {
          // Player hasn't answered - restore to thinking phase (simplest approach)
          setState(prev => ({
            ...prev,
            currentStepIndex: -1,
            isThinkingPhase: true,
            thinkingTimeLeft: 60, // Restart thinking phase
            stepTimeLeft: null,
            hasAnsweredCurrentStep: false
          }))
          
          // Start thinking phase timer
          setTimeout(() => {
            if (startThinkingPhaseRef.current) {
              startThinkingPhaseRef.current(60)
            }
          }, 100)
        }
      }
    }

    restoreRoundState()
  }, [matchId, state.currentRound?.id, state.match?.id]) // Only run when round changes

  // Aggressive polling when waiting for opponent (checks round status)
  useEffect(() => {
    if (!matchId || !state.hasSubmitted || !state.currentRound) return

    const checkRoundStatus = async () => {
      const { data: roundData, error: roundError } = await supabase
        .from('match_rounds')
        .select('status, player1_answered_at, player2_answered_at, player1_round_score, player2_round_score, round_number')
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
          
          console.log('[useMatchFlow] Polling: Round finished, updating state from DB')
          setState(prev => ({
            ...prev,
            roundResult: syntheticResult,
            hasSubmitted: false,
            isMatchFinished: !matchContinues,
            match: matchData as MatchRow
          }))
        }
      }
    }

    checkRoundStatus()
    
    // Aggressive polling every 2 seconds when waiting
    const interval = setInterval(checkRoundStatus, 2000)
    return () => clearInterval(interval)
  }, [matchId, state.hasSubmitted, state.currentRound])

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
              
              // Clear any existing timeout for round result
              if (roundResultTimeoutRef.current) {
                clearTimeout(roundResultTimeoutRef.current)
                roundResultTimeoutRef.current = null
              }
              
              // Clear step timer
              if (stepTimerIntervalRef.current) {
                clearInterval(stepTimerIntervalRef.current)
                stepTimerIntervalRef.current = null
              }
              
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
                  isThinkingPhase: false
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
              
              // If match doesn't continue, mark as finished immediately (don't wait for MATCH_FINISHED)
              const isFinished = !message.matchContinues || message.matchWinnerId !== null
              
              // Clear timeout since we got the result
              if (roundResultTimeoutRef.current) {
                clearTimeout(roundResultTimeoutRef.current)
                roundResultTimeoutRef.current = null
              }
              
              // Update match scores by accumulating round scores (no DB refetch needed)
              setState(prev => ({
                ...prev,
                roundResult,
                hasSubmitted: false, // Clear hasSubmitted when result arrives
                isMatchFinished: isFinished, // Set immediately if match ended
                match: prev.match ? {
                  ...prev.match,
                  player1_score: ((prev.match as any).player1_score || 0) + message.player1RoundScore,
                  player2_score: ((prev.match as any).player2_score || 0) + message.player2RoundScore,
                  current_round_number: message.roundNumber,
                  status: isFinished ? 'finished' : prev.match.status,
                  winner_id: message.matchWinnerId || prev.match.winner_id
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
      // Clear timeout on unmount
      if (roundResultTimeoutRef.current) {
        clearTimeout(roundResultTimeoutRef.current)
        roundResultTimeoutRef.current = null
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

    setState(prev => ({
      ...prev,
      currentStepIndex: -1,
      isThinkingPhase: true,
      thinkingTimeLeft: durationSeconds,
      stepTimeLeft: null,
      hasAnsweredCurrentStep: false
    }))

    // Start countdown timer
    let timeLeft = durationSeconds
    stepTimerIntervalRef.current = setInterval(() => {
      timeLeft -= 1
      setState(prev => {
        if (timeLeft <= 0) {
          // Thinking phase over - start step 0
          if (stepTimerIntervalRef.current) {
            clearInterval(stepTimerIntervalRef.current)
            stepTimerIntervalRef.current = null
          }
          
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
        return { ...prev, thinkingTimeLeft: timeLeft }
      })
    }, 1000)
  }, [])

  // Start a step with timer
  const startStep = useCallback((stepIndex: number, durationSeconds: number) => {
    // Clear any existing timer
    if (stepTimerIntervalRef.current) {
      clearInterval(stepTimerIntervalRef.current)
      stepTimerIntervalRef.current = null
    }

    setState(prev => ({
      ...prev,
      currentStepIndex: stepIndex,
      stepTimeLeft: durationSeconds,
      hasAnsweredCurrentStep: false
    }))

    // Start countdown timer
    let timeLeft = durationSeconds
    stepTimerIntervalRef.current = setInterval(() => {
      timeLeft -= 1
      setState(prev => {
        if (timeLeft <= 0) {
          // Timer expired - submit no answer (wrong) for this step
          if (stepTimerIntervalRef.current) {
            clearInterval(stepTimerIntervalRef.current)
            stepTimerIntervalRef.current = null
          }
          
          // Auto-submit with null answer (will be treated as wrong)
          const currentStepIndex = prev.currentStepIndex
          if (!stepAnswersRef.current.has(currentStepIndex)) {
            // Mark this step as answered with -1 (wrong)
            stepAnswersRef.current.set(currentStepIndex, -1)
            
            // Check if this is the last step
            const isLastStep = currentStepIndex === (prev.currentQuestion?.steps.length || 0) - 1
            
            if (isLastStep) {
              // Last step - submit ALL answers at once
              const allSteps = Array.from(stepAnswersRef.current.entries())
                .map(([sIndex, aIndex]) => ({
                  step_index: sIndex,
                  answer_index: aIndex,
                  response_time_ms: prev.responseTimes.get(sIndex) || 0
                }))
                .sort((a, b) => a.step_index - b.step_index)

              const payload = {
                version: 1,
                steps: allSteps
              }

              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && prev.currentRound) {
                const message = {
                  type: 'SUBMIT_ROUND_ANSWER',
                  matchId,
                  roundId: prev.currentRound.id,
                  payload
                }
                console.log('[useMatchFlow] Auto-submitting all step answers (timer expired):', message)
                wsRef.current.send(JSON.stringify(message))
              }
              
              // All steps done - wait for opponent
              setState(prev => ({
                ...prev,
                hasSubmitted: true
              }))
            } else {
              // Not last step - just advance to next step
              setTimeout(() => {
                if (startStepRef.current) {
                  startStepRef.current(currentStepIndex + 1, 15)
                }
              }, 500)
            }
          }
          
          return { ...prev, stepTimeLeft: 0 }
        }
        return { ...prev, stepTimeLeft: timeLeft }
      })
    }, 1000)
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
    setState(prev => {
      if (!matchId || !prev.currentRound || !prev.currentQuestion) {
        return prev
      }

      // Guard: if already answered this step, return
      if (stepAnswersRef.current.has(stepIndex)) {
        return prev
      }

      // Mark as answered locally
      stepAnswersRef.current.set(stepIndex, answerIndex ?? -1)
      
      // Stop timer
      if (stepTimerIntervalRef.current) {
        clearInterval(stepTimerIntervalRef.current)
        stepTimerIntervalRef.current = null
      }

      // Update local state
      const newAnswers = new Map(prev.playerAnswers)
      if (answerIndex !== null) {
        newAnswers.set(stepIndex, answerIndex)
      }

      // Check if this is the last step
      const isLastStep = stepIndex === (prev.currentQuestion.steps.length - 1)
      
      if (isLastStep) {
        // Last step - submit ALL answers at once
        const allSteps = Array.from(stepAnswersRef.current.entries())
          .map(([sIndex, aIndex]) => ({
            step_index: sIndex,
            answer_index: aIndex,
            response_time_ms: prev.responseTimes.get(sIndex) || 0
          }))
          .sort((a, b) => a.step_index - b.step_index)

        const payload = {
          version: 1,
          steps: allSteps
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = {
            type: 'SUBMIT_ROUND_ANSWER',
            matchId,
            roundId: prev.currentRound.id,
            payload
          }
          console.log('[useMatchFlow] Submitting all step answers:', message)
          wsRef.current.send(JSON.stringify(message))
        }

        // After short delay, advance to next step if exists
        setTimeout(() => {
          setState(prevState => {
            if (!prevState.currentQuestion) return prevState
            
            const nextStepIndex = prevState.currentStepIndex + 1
            if (nextStepIndex < prevState.currentQuestion.steps.length) {
              // Start next step
              if (startStepRef.current) {
                startStepRef.current(nextStepIndex, 15)
              }
              return prevState
            } else {
              // All steps done - already set hasSubmitted above
              return prevState
            }
          })
        }, 500) // 500ms delay before advancing

        return {
          ...prev,
          hasAnsweredCurrentStep: true,
          playerAnswers: newAnswers,
          stepTimeLeft: null,
          hasSubmitted: true
        }
      } else {
        // Not last step - just update state, don't submit yet
        // After short delay, advance to next step
        setTimeout(() => {
          setState(prevState => {
            if (!prevState.currentQuestion) return prevState
            
            const nextStepIndex = prevState.currentStepIndex + 1
            if (nextStepIndex < prevState.currentQuestion.steps.length) {
              // Start next step
              if (startStepRef.current) {
                startStepRef.current(nextStepIndex, 15)
              }
              return prevState
            } else {
              return prevState
            }
          })
        }, 500) // 500ms delay before advancing

        return {
          ...prev,
          hasAnsweredCurrentStep: true,
          playerAnswers: newAnswers,
          stepTimeLeft: null
        }
      }
    })
  }, [matchId])

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
        .select('status, player1_answered_at, player2_answered_at, round_number, player1_round_score, player2_round_score')
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
          
          console.log('[useMatchFlow] Timeout: Round was evaluated, updating state from DB')
          setState(prev => ({
            ...prev,
            roundResult: syntheticResult,
            hasSubmitted: false,
            isMatchFinished: !matchContinues,
            match: match as MatchRow
          }))
        }
      }
    }, 5000) // 5 second timeout (reduced from 10)
  }, [state.currentRound, state.currentQuestion, state.playerAnswers, state.responseTimes, state.hasSubmitted, matchId])

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
    startStep,
    submitStepAnswer
  }
}

