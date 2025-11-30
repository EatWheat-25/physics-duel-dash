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
    setState(prev => ({ ...prev, status: 'searching', error: null }));

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

      // If matched, update state and navigate
      if (data?.matched && data?.match) {
        const match = data.match as MatchRow;
        console.log(`[MATCHMAKING] ✅ Matched! Match ID: ${match.id}`);
        
        setState({
          status: 'matched',
          match: match,
          error: null,
        });

        toast.success('Match found! Starting battle...');
        
        navigate(`/battle/${match.id}`, {
          state: { match },
        });
      } else {
        // Queued, keep searching state
        console.log('[MATCHMAKING] Queued, waiting for opponent...');
        toast.info('Searching for opponent...');
        // State remains 'searching'
      }

    } catch (error: any) {
      console.error('[MATCHMAKING] Failed:', error);
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: error.message || 'Failed to start matchmaking',
      }));
      toast.error('Failed to start matchmaking. Please try again.');
    } finally {
      isSearchingRef.current = false;
    }
  }, [state.status, navigate]);

  const leaveQueue = useCallback(async () => {
    console.log('[MATCHMAKING] Leaving queue');

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
