import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { MatchRow } from '@/types/schema';
import { useElevatorShutter } from '@/components/transitions/ElevatorShutterTransition';

interface MatchmakingState {
  status: 'idle' | 'searching' | 'matched';
  match: MatchRow | null;
  error: string | null;
}

export function useMatchmaking() {
  const navigate = useNavigate();
  const { startMatch } = useElevatorShutter();
  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    match: null,
    error: null,
  });

  const isSearchingRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchmakingStartTimeRef = useRef<Date | null>(null);
  const transitionTriggeredRef = useRef(false);

  const checkForMatch = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[MATCHMAKING] Poll: No user, skipping check');
        return;
      }

      // Check if user has a match in matches table
      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[MATCHMAKING] Poll: Error checking for match:', error);
        return;
      }

      if (matches && matches.length > 0) {
        const match = matches[0] as MatchRow;
        
        // Only navigate if match was created after we started searching
        if (matchmakingStartTimeRef.current) {
          const matchCreatedAt = new Date(match.created_at);
          if (matchCreatedAt < matchmakingStartTimeRef.current) {
            console.log('[MATCHMAKING] Poll: Found old match, ignoring...', {
              matchId: match.id,
              matchCreatedAt,
              startedSearchingAt: matchmakingStartTimeRef.current,
            });
            return;
          }
        }
        
        console.log(`[MATCHMAKING] ✅ Poll detected fresh match, navigating...`, match.id);
        
        // Clear polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        setState({
          status: 'matched',
          match: match,
          error: null,
        });

        toast.success('Match found! Starting battle...');

        if (!transitionTriggeredRef.current) {
          transitionTriggeredRef.current = true;
          startMatch({
            message: 'MATCH FOUND',
            loadingMs: 2000,
            onClosed: () => {
              navigate(`/online-battle-new/${match.id}`, { state: { match } });
            },
          });
        }
      } else {
        console.log('[MATCHMAKING] Poll: No match found yet, continuing to wait...');
      }
    } catch (error) {
      console.error('[MATCHMAKING] Poll: Error in polling:', error);
    }
  }, [navigate]);

  // Poll for matches when in searching state
  useEffect(() => {
    if (state.status !== 'searching') {
      // Clear any existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // Poll every 3 seconds (reduced from 2s to reduce backend load)
    pollIntervalRef.current = setInterval(checkForMatch, 3000);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [state.status, navigate, checkForMatch]);

  // Visibility-based lightweight resync (poll once when tab returns)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (state.status !== 'searching') return;
      checkForMatch();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [state.status, checkForMatch]);

  const startMatchmaking = useCallback(async (subject: string, level: string) => {
    if (isSearchingRef.current) {
      console.log('[MATCHMAKING] Already searching, ignoring duplicate call');
      return;
    }

    if (state.status === 'searching') {
      console.log('[MATCHMAKING] Already in queue, ignoring duplicate call');
      return;
    }

    isSearchingRef.current = true;

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('No authenticated user');
      }

      console.log(`[MATCHMAKING] Starting matchmaking for user ${user.id} (subject: ${subject}, level: ${level})`);

      // Call matchmaker edge function with subject and level
      const { data, error } = await supabase.functions.invoke('matchmake-simple', {
        body: { subject, level },
      });

      if (error) {
        // If error is an object with message/details, extract them
        const errorMessage = error.message || error.details || JSON.stringify(error);
        const errorObj = new Error(errorMessage);
        (errorObj as any).details = error.details;
        (errorObj as any).hint = error.hint;
        throw errorObj;
      }
      
      // Check if data contains an error field (edge function returned error in 200 response)
      if (data && typeof data === 'object' && 'error' in data) {
        const errorMessage = data.error || 'Failed to start matchmaking';
        const errorObj = new Error(errorMessage);
        (errorObj as any).details = data.details;
        (errorObj as any).hint = data.hint;
        throw errorObj;
      }

      console.log('[MATCHMAKING] Response:', data);

      // If matched immediately, navigate right away
      if (data?.matched && data?.match) {
        const match = data.match as MatchRow;
        console.log(`[MATCHMAKING] ✅ Instant match! Match ID: ${match.id}`);
        
        // Clear polling if it exists
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        setState({
          status: 'matched',
          match: match,
          error: null,
        });

        toast.success('Match found! Starting battle...');

        if (!transitionTriggeredRef.current) {
          transitionTriggeredRef.current = true;
          startMatch({
            message: 'MATCH FOUND',
            loadingMs: 2000,
            onClosed: () => {
              navigate(`/online-battle-new/${match.id}`, { state: { match } });
            },
          });
        }
      } else if (data?.matched === false && data?.queued === true) {
        // Queued - enter searching state and start polling
        console.log('[MATCHMAKING] Entering searching state, will poll for match...');
        matchmakingStartTimeRef.current = new Date();
        transitionTriggeredRef.current = false;
        setState(prev => ({ ...prev, status: 'searching', error: null }));
        toast.info('Searching for opponent...');
        // Polling effect will handle match detection
      } else {
        // Unexpected response - treat as queued
        console.warn('[MATCHMAKING] Unexpected response format, treating as queued:', data);
        matchmakingStartTimeRef.current = new Date();
        transitionTriggeredRef.current = false;
        setState(prev => ({ ...prev, status: 'searching', error: null }));
        toast.info('Searching for opponent...');
      }

    } catch (error: any) {
      console.error('[MATCHMAKING] Failed:', error);
      const errorMessage = error?.message || error?.details || 'Failed to start matchmaking';
      const errorHint = error?.hint || '';
      console.error('[MATCHMAKING] Error details:', { message: errorMessage, hint: errorHint, fullError: error });
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: errorMessage,
      }));
      toast.error(`Failed to start matchmaking. ${errorHint ? errorHint : 'Please try again.'}`);
      
      // Clear polling on error
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // Reset matchmaking start time on error
      matchmakingStartTimeRef.current = null;
      transitionTriggeredRef.current = false;
    } finally {
      isSearchingRef.current = false;
    }
  }, [state.status, navigate]);

  const leaveQueue = useCallback(async () => {
    console.log('[MATCHMAKING] Leaving queue');

    // Clear polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Remove from matchmaking_queue
        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('player_id', user.id);
      }
      toast.info('Left queue');
    } catch (error) {
      console.error('[MATCHMAKING] Error leaving queue:', error);
    }

    setState({
      status: 'idle',
      match: null,
      error: null,
    });
    isSearchingRef.current = false;
    matchmakingStartTimeRef.current = null;
    transitionTriggeredRef.current = false;
  }, []);

  return {
    status: state.status,
    match: state.match,
    error: state.error,
    startMatchmaking,
    leaveQueue,
  };
}
