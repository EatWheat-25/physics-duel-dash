import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { MatchRow } from '@/types/schema';
import { useElevatorShutter } from '@/components/transitions/ElevatorShutterTransition';
import { createShutterGate } from '@/lib/shutterGate';
import { getRankByPoints } from '@/types/ranking';

interface MatchmakingState {
  status: 'idle' | 'searching' | 'matched';
  match: MatchRow | null;
  error: string | null;
}

export function useMatchmaking() {
  const navigate = useNavigate();
  const { startMatch: startShutterMatch } = useElevatorShutter();
  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    match: null,
    error: null,
  });

  const isSearchingRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const queueStartTimeRef = useRef<number | null>(null);
  const [queueStartTime, setQueueStartTime] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const fetchPlayerStats = useCallback(async (userId: string) => {
    const [profileData, playerData] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
      supabase.from('players').select('mmr').eq('id', userId).maybeSingle(),
    ]);

    const username = profileData.data?.username || 'Player';
    const mmr = playerData.data?.mmr || 1000;
    
    // Rank/level (reuse game ranking logic)
    const rank = getRankByPoints(mmr);
    const level = Math.max(1, Math.floor(mmr / 100) + 1);

    return {
      username,
      mmr,
      rank: `${rank.tier} ${rank.subRank}`,
      level,
    };
  }, []);

  const playMatchFoundCinematic = useCallback(
    async (match: MatchRow, currentUserId: string) => {
      const opponentId = match.player1_id === currentUserId ? match.player2_id : match.player1_id;

      const [myStats, opponentStats] = await Promise.all([
        fetchPlayerStats(currentUserId),
        fetchPlayerStats(opponentId),
      ]);

      const subtitleParts: string[] = [];
      if (match.subject) subtitleParts.push(String(match.subject).toUpperCase());
      // matches table has `mode`; MatchRow type may not include it in this repo's schema typing.
      if ((match as any).mode) subtitleParts.push(String((match as any).mode).toUpperCase());
      const subtitle = subtitleParts.length ? subtitleParts.join(' • ') : 'LOADING';

      const gate = createShutterGate();

      void startShutterMatch({
        subject: match.subject,
        matchup: {
          left: { 
            label: 'YOU', 
            username: myStats.username, 
            rank: myStats.rank, 
            level: myStats.level,
            mmr: myStats.mmr,
            color: 'hsl(var(--battle-primary))',
          },
          right: { 
            label: 'OPPONENT', 
            username: opponentStats.username, 
            rank: opponentStats.rank, 
            level: opponentStats.level,
            mmr: opponentStats.mmr,
            color: 'hsl(var(--battle-danger))',
          },
          center: { title: 'VS', subtitle },
        },
        minLoadingMs: 1200,
        maxLoadingMs: 15000,
        waitFor: gate.promise,
        onClosed: () => {
          navigate(`/online-battle-new/${match.id}`, {
            state: { match, shutterGateId: gate.id },
          });
        },
      });
    },
    [fetchPlayerStats, navigate, startShutterMatch]
  );

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
          
          // Only navigate if match was created after we started searching
          if (queueStartTimeRef.current) {
            const matchCreatedAtMs = new Date(match.created_at).getTime();
            if (matchCreatedAtMs < queueStartTimeRef.current) {
              console.log('[MATCHMAKING] Poll: Found old match, ignoring...', {
                matchId: match.id,
                matchCreatedAt: match.created_at,
                startedSearchingAt: new Date(queueStartTimeRef.current).toISOString(),
              });
              return;
            }
          }
          
          console.log(`[MATCHMAKING] ✅ Poll detected fresh match, starting shutter...`, match.id);
          
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
          setQueueStartTime(null);
          queueStartTimeRef.current = null;

          // Let the shutter handle navigation while doors are closed.
          await playMatchFoundCinematic(match, user.id);
        } else {
          console.log('[MATCHMAKING] Poll: No match found yet, continuing to wait...');
        }
      } catch (error) {
        console.error('[MATCHMAKING] Poll: Error in polling:', error);
      }
    };

    // Poll every 3 seconds (reduced from 2s to reduce backend load)
    pollIntervalRef.current = setInterval(checkForMatch, 3000);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [state.status, playMatchFoundCinematic]);

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
    const requestId = ++requestIdRef.current;

    // Optimistic UI: enter searching immediately for instant button feedback
    const startedAt = Date.now();
    queueStartTimeRef.current = startedAt;
    setQueueStartTime(startedAt);
    setState(prev => ({ ...prev, status: 'searching', error: null }));

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

      // If the user cancelled while this request was in-flight, ignore late results.
      if (requestId !== requestIdRef.current) {
        console.log('[MATCHMAKING] Stale matchmaking response ignored (cancelled or superseded).');
        return;
      }

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
        setQueueStartTime(null);
        queueStartTimeRef.current = null;

        // Let the shutter handle navigation while doors are closed.
        await playMatchFoundCinematic(match, user.id);
      } else if (data?.matched === false && data?.queued === true) {
        // Queued - stay in searching state and let polling handle match detection
        console.log('[MATCHMAKING] Queued, will poll for match...');
        toast.info('Searching for opponent...');
        // Polling effect will handle match detection
      } else {
        // Unexpected response - treat as queued
        console.warn('[MATCHMAKING] Unexpected response format, treating as queued:', data);
        // Already in searching state; keep it.
        toast.info('Searching for opponent...');
      }

    } catch (error: any) {
      // If the user cancelled while this request was in-flight, ignore errors too.
      if (requestId !== requestIdRef.current) {
        console.log('[MATCHMAKING] Stale matchmaking error ignored (cancelled or superseded).');
        return;
      }
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
      setQueueStartTime(null);
      queueStartTimeRef.current = null;
      
      // Clear polling on error
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    } finally {
      isSearchingRef.current = false;
    }
  }, [state.status, playMatchFoundCinematic]);

  const leaveQueue = useCallback(async () => {
    console.log('[MATCHMAKING] Leaving queue');
    // Invalidate any in-flight start request so late responses are ignored.
    requestIdRef.current += 1;

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
    setQueueStartTime(null);
    queueStartTimeRef.current = null;
  }, []);

  return {
    status: state.status,
    match: state.match,
    error: state.error,
    startMatchmaking,
    leaveQueue,
    queueStartTime,
  };
}
