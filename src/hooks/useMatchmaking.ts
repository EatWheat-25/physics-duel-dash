import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { MatchRow } from '@/types/schema';

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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    const checkForMatch = async () => {
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
          console.log(`[MATCHMAKING] ✅ Poll detected match! Match ID: ${match.id}, navigating...`);
          
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
          
          navigate(`/online-battle/${match.id}`, {
            state: { match },
          });
        } else {
          console.log('[MATCHMAKING] Poll: No match found yet, continuing to wait...');
        }
      } catch (error) {
        console.error('[MATCHMAKING] Poll: Error in polling:', error);
      }
    };

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(checkForMatch, 2000);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [state.status, navigate]);

  const startMatchmaking = useCallback(async () => {
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

      console.log(`[MATCHMAKING] Starting matchmaking for user ${user.id}`);

      // Call matchmaker edge function
      const { data, error } = await supabase.functions.invoke('matchmake-simple', {
        body: {},
      });

      if (error) {
        throw error;
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
        
        navigate(`/online-battle/${match.id}`, {
          state: { match },
        });
      } else if (data?.matched === false && data?.queued === true) {
        // Queued - enter searching state and start polling
        console.log('[MATCHMAKING] Entering searching state, will poll for match...');
        setState(prev => ({ ...prev, status: 'searching', error: null }));
        toast.info('Searching for opponent...');
        // Polling effect will handle match detection
      } else {
        // Unexpected response - treat as queued
        console.warn('[MATCHMAKING] Unexpected response format, treating as queued:', data);
        setState(prev => ({ ...prev, status: 'searching', error: null }));
        toast.info('Searching for opponent...');
      }

    } catch (error: any) {
      console.error('[MATCHMAKING] Failed:', error);
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: error.message || 'Failed to start matchmaking',
      }));
      toast.error('Failed to start matchmaking. Please try again.');
      
      // Clear polling on error
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
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
  }, []);

  return {
    status: state.status,
    match: state.match,
    error: state.error,
    startMatchmaking,
    leaveQueue,
  };
}
