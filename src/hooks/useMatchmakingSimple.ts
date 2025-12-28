import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { MatchRow } from '@/types/schema'

interface MatchmakingState {
  status: 'idle' | 'queuing' | 'searching' | 'matched'
  matchId: string | null
  error: string | null
}

/**
 * Simple Matchmaking Hook
 *
 * Handles:
 * 1. Joining queue via matchmake-simple function
 * 2. Polling for match if not instantly matched
 * 3. Navigating to battle page when matched
 */
export function useMatchmakingSimple() {
  const navigate = useNavigate()
  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    matchId: null,
    error: null
  })

  const pollIntervalRef = useRef<number | null>(null)

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  /**
   * Start matchmaking
   */
  const startMatchmaking = useCallback(async (mode?: string) => {
    console.log('[MATCHMAKING] Starting matchmaking...', { mode })

    setState({
      status: 'queuing',
      matchId: null,
      error: null
    })

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      console.log('[MATCHMAKING] User ID:', user.id)

      // Call matchmaker function
      const { data, error } = await supabase.functions.invoke('matchmake-simple', {
        body: {}
      })

      if (error) {
        throw error
      }

      console.log('[MATCHMAKING] Response:', data)

      // Instant match found
      if (data.matched && data.match_id) {
        console.log('[MATCHMAKING] Instant match!', data.match_id)

        setState({
          status: 'matched',
          matchId: data.match_id,
          error: null
        })

        toast.success('Match found!')

        // Navigate to versus screen first
        navigate(`/versus/${data.match_id}`)
        return
      }

      // No instant match - start polling
      console.log('[MATCHMAKING] Queued, starting poll...')
      toast.info('Finding opponent...')
      startPolling(user.id)

    } catch (error: any) {
      console.error('[MATCHMAKING] Error:', error)

      setState({
        status: 'idle',
        matchId: null,
        error: error.message || 'Failed to start matchmaking'
      })

      toast.error('Failed to join queue')
    }
  }, [navigate])

  /**
   * Poll for match
   */
  const startPolling = useCallback((userId: string) => {
    console.log('[MATCHMAKING] Starting poll for user', userId)

    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    // Poll every 2 seconds
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        console.log('[MATCHMAKING] Polling for match...')

        // Query for active match
        const { data: matches, error } = await supabase
          .from('matches_new')
          .select('*')
          .or(`p1.eq.${userId},p2.eq.${userId}`)
          .in('state', ['pending', 'active'])
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          console.error('[MATCHMAKING] Poll error:', error)
          return
        }

        if (matches && matches.length > 0) {
          const match = matches[0] as MatchRow

          console.log('[MATCHMAKING] Match found!', match.id)

          // Stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }

          setState({
            status: 'matched',
            matchId: match.id,
            error: null
          })

          toast.success('Match found!')

          // Navigate to versus screen first
          navigate(`/versus/${match.id}`)
        }
      } catch (error: any) {
        console.error('[MATCHMAKING] Poll exception:', error)
      }
    }, 2000) // Poll every 2 seconds
  }, [navigate])

  /**
   * Leave queue
   */
  const leaveQueue = useCallback(async () => {
    console.log('[MATCHMAKING] Leaving queue')

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Delete from queue
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('player_id', user.id)

      setState({
        status: 'idle',
        matchId: null,
        error: null
      })

      toast.info('Left queue')
    } catch (error: any) {
      console.error('[MATCHMAKING] Error leaving queue:', error)
    }
  }, [])

  return {
    ...state,
    startMatchmaking,
    leaveQueue
  }
}
