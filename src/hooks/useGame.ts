import { useState, useEffect, useRef } from 'react'
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'
import type { MatchRow, Question, RoundStartEvent, GameErrorEvent } from '@/types/schema'

interface GameState {
  question: Question | null
  gameStatus: 'connecting' | 'waiting_for_round' | 'round_active' | 'error'
  errorMessage: string | null
}

/**
 * Simple game hook that connects to game-ws and handles JOIN_MATCH
 * 
 * @param match - The match row from matchmaking (must have id, player1_id, player2_id)
 * @returns Game state with question, status, and error
 */
export function useGame(match: MatchRow | null) {
  const [state, setState] = useState<GameState>({
    question: null,
    gameStatus: 'connecting',
    errorMessage: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!match) {
      setState({
        question: null,
        gameStatus: 'connecting',
        errorMessage: null
      })
      return
    }

    const connect = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          setState(prev => ({
            ...prev,
            gameStatus: 'error',
            errorMessage: 'Not authenticated'
          }))
          return
        }

        currentUserIdRef.current = user.id

        // Verify user is part of match
        if (match.player1_id !== user.id && match.player2_id !== user.id) {
          setState(prev => ({
            ...prev,
            gameStatus: 'error',
            errorMessage: 'You are not part of this match'
          }))
          return
        }

        // Get session token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.access_token) {
          setState(prev => ({
            ...prev,
            gameStatus: 'error',
            errorMessage: 'No session token'
          }))
          return
        }

        // Build WebSocket URL - use the exported SUPABASE_URL constant
        if (!SUPABASE_URL) {
          console.error('[useGame] ❌ SUPABASE_URL is not defined. Check src/integrations/supabase/client.ts');
          setState(prev => ({
            ...prev,
            gameStatus: 'error',
            errorMessage: 'Missing SUPABASE_URL'
          }))
          return
        }

        const supabaseUrl = SUPABASE_URL

        const wsUrl = `${supabaseUrl.replace('http', 'ws')}/functions/v1/game-ws?token=${session.access_token}&match_id=${match.id}`
        console.log('[useGame] Connecting to:', wsUrl)

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[useGame] WebSocket connected')
          setState(prev => ({
            ...prev,
            gameStatus: 'waiting_for_round',
            errorMessage: null
          }))

          // Send JOIN_MATCH message
          ws.send(JSON.stringify({
            type: 'JOIN_MATCH',
            match_id: match.id,
            player_id: user.id
          }))
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            console.log('[useGame] Message received:', message.type)

            if (message.type === 'ROUND_START') {
              const roundStart = message as RoundStartEvent
              console.log('[useGame] ROUND_START received, question:', roundStart.question.id)
              setState(prev => ({
                ...prev,
                question: roundStart.question,
                gameStatus: 'round_active',
                errorMessage: null
              }))
            } else if (message.type === 'GAME_ERROR') {
              const error = message as GameErrorEvent
              console.error('[useGame] GAME_ERROR:', error.message)
              setState(prev => ({
                ...prev,
                gameStatus: 'error',
                errorMessage: error.message
              }))
            } else if (message.type === 'connected') {
              console.log('[useGame] Connection confirmed')
              // Already sent JOIN_MATCH in onopen, so just wait
            } else {
              console.warn('[useGame] Unknown message type:', message.type)
            }
          } catch (error) {
            console.error('[useGame] Error parsing message:', error)
            setState(prev => ({
              ...prev,
              gameStatus: 'error',
              errorMessage: 'Error parsing server message'
            }))
          }
        }

        ws.onerror = (error) => {
          console.error('[useGame] WebSocket error:', error)
          setState(prev => ({
            ...prev,
            gameStatus: 'error',
            errorMessage: 'WebSocket connection error'
          }))
        }

        ws.onclose = () => {
          console.log('[useGame] WebSocket closed')
          // Don't set error on close - might be intentional
          setState(prev => {
            if (prev.gameStatus !== 'error') {
              return {
                ...prev,
                gameStatus: 'connecting'
              }
            }
            return prev
          })
        }
      } catch (error: any) {
        console.error('[useGame] Connection error:', error)
        setState(prev => ({
          ...prev,
          gameStatus: 'error',
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
    }
  }, [match?.id]) // Only reconnect if match ID changes

  return {
    question: state.question,
    gameStatus: state.gameStatus,
    errorMessage: state.errorMessage
  }
}

