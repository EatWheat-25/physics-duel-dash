import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { MatchRow } from '@/types/schema';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MatchmakingState {
  status: 'idle' | 'searching' | 'matched';
  match: MatchRow | null;
  error: string | null;
}

export function useMatchmaking() {
  const navigate = useNavigate();
  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    match: null,
    error: null,
  });

  const isSearchingRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const matchmakingStartTimeRef = useRef<Date | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null); // Fallback polling

  // Use Realtime subscription for instant match detection
  useEffect(() => {
    if (state.status !== 'searching') {
      // Cleanup subscription
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      // Cleanup fallback polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const setupRealtimeSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[MATCHMAKING] No user, skipping subscription');
          return;
        }

        console.log('[MATCHMAKING] Setting up Realtime subscription for user', user.id);

        // Subscribe to matches table INSERT events where user is player1 or player2
        const channel = supabase
          .channel(`matchmaking-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'matches',
              filter: `player1_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('[MATCHMAKING] ✅ Realtime: Match INSERT detected (as player1)', payload.new);
              handleMatchFound(payload.new as MatchRow);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'matches',
              filter: `player2_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('[MATCHMAKING] ✅ Realtime: Match INSERT detected (as player2)', payload.new);
              handleMatchFound(payload.new as MatchRow);
            }
          )
          .subscribe((status) => {
            console.log('[MATCHMAKING] Realtime subscription status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('[MATCHMAKING] ✅ Realtime subscription active');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('[MATCHMAKING] Realtime subscription error, falling back to polling');
              startFallbackPolling();
            }
          });

        channelRef.current = channel;

        // Also set up fallback polling in case Realtime fails (every 1 second as backup)
        startFallbackPolling();

      } catch (error) {
        console.error('[MATCHMAKING] Error setting up Realtime:', error);
        startFallbackPolling();
      }
    };

    const handleMatchFound = (match: MatchRow) => {
      // Only navigate if match was created after we started searching
      if (matchmakingStartTimeRef.current) {
        const matchCreatedAt = new Date(match.created_at);
        if (matchCreatedAt < matchmakingStartTimeRef.current) {
          console.log('[MATCHMAKING] Found old match, ignoring...', {
            matchId: match.id,
            matchCreatedAt,
            startedSearchingAt: matchmakingStartTimeRef.current,
          });
          return;
        }
      }

      // Only process pending matches
      if (match.status !== 'pending') {
        console.log('[MATCHMAKING] Match is not pending, ignoring...', match.status);
        return;
      }

      console.log(`[MATCHMAKING] ✅ Match found! Navigating...`, match.id);

      // Cleanup
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
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

      navigate(`/online-battle-new/${match.id}`, {
        state: { match },
      });
    };

    const startFallbackPolling = () => {
      // Clear existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      // Fallback polling every 1 second (faster than before)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

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
            handleMatchFound(matches[0] as MatchRow);
          }
        } catch (error) {
          console.error('[MATCHMAKING] Poll: Error in polling:', error);
        }
      }, 1000);
    };

    setupRealtimeSubscription();

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [state.status, navigate]);

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
        
        navigate(`/online-battle-new/${match.id}`, {
          state: { match },
        });
      } else if (data?.matched === false && data?.queued === true) {
        // Queued - enter searching state and start polling
        console.log('[MATCHMAKING] Entering searching state, will poll for match...');
        matchmakingStartTimeRef.current = new Date();
        setState(prev => ({ ...prev, status: 'searching', error: null }));
        toast.info('Searching for opponent...');
        // Polling effect will handle match detection
      } else {
        // Unexpected response - treat as queued
        console.warn('[MATCHMAKING] Unexpected response format, treating as queued:', data);
        matchmakingStartTimeRef.current = new Date();
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
    } finally {
      isSearchingRef.current = false;
    }
  }, [state.status, navigate]);

  const leaveQueue = useCallback(async () => {
    console.log('[MATCHMAKING] Leaving queue');

    // Cleanup subscription
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

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
  }, []);

  return {
    status: state.status,
    match: state.match,
    error: state.error,
    startMatchmaking,
    leaveQueue,
  };
}
