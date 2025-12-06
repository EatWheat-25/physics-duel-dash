import { useState, useEffect, useRef } from 'react'
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'
import type { MatchRow } from '@/types/schema'
import type { StepBasedQuestion } from '@/types/questions'
import { mapRawToQuestion } from '@/utils/questionMapper'

interface ConnectionState {
  status: 'connecting' | 'connected' | 'both_connected' | 'error'
  playerRole: 'player1' | 'player2' | null
  errorMessage: string | null
  question: StepBasedQuestion | null
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
    question: null
  })

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!match) {
      setState({
        status: 'connecting',
        playerRole: null,
        errorMessage: null,
        question: null
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

            if (message.type === 'CONNECTED') {
              console.log('[useGame] CONNECTED message received, updating state')
              setState(prev => ({
                ...prev,
                status: 'connected',
                playerRole: message.player,
                errorMessage: null
              }))
            } else if (message.type === 'BOTH_CONNECTED') {
              console.log('[useGame] ✅ BOTH_CONNECTED message received, updating status to both_connected')
              setState(prev => ({
                ...prev,
                status: 'both_connected',
                errorMessage: null
              }))
            } else if (message.type === 'QUESTION_RECEIVED') {
              console.log('[useGame] QUESTION_RECEIVED message received')
              try {
                // Convert DB format to client format using questionMapper
                const mappedQuestion = mapRawToQuestion(message.question)
                setState(prev => ({
                  ...prev,
                  question: mappedQuestion,
                  errorMessage: null
                }))
                console.log('[useGame] Question mapped and stored:', mappedQuestion.id)
              } catch (error) {
                console.error('[useGame] Error mapping question:', error)
                setState(prev => ({
                  ...prev,
                  status: 'error',
                  errorMessage: 'Invalid question format received'
                }))
              }
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
          console.log('[useGame] WebSocket closed')
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
    }
  }, [match?.id])

  return {
    status: state.status,
    playerRole: state.playerRole,
    errorMessage: state.errorMessage,
    question: state.question
  }
}
