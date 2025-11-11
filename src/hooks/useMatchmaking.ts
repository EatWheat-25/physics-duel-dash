import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

const P1_COL = 'p1';
const P2_COL = 'p2';

interface MatchmakingState {
  status: 'idle' | 'joining' | 'queuing' | 'matched' | 'error';
  matchId: string | null;
  opponentName: string | null;
  queueStartTime: number | null;
  error: string | null;
}

interface JoinQueueParams {
  subject: string;
  chapter: string;
  region?: string;
}

export function useMatchmaking() {
  const navigate = useNavigate();
  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    matchId: null,
    opponentName: null,
    queueStartTime: null,
    error: null,
  });

  const navLockRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rehydrateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const consecutiveHeartbeatFailures = useRef(0);
  const isJoiningRef = useRef(false);

  const cleanup = useCallback(() => {
    console.log('QUEUE: Cleaning up matchmaking resources');

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (rehydrateIntervalRef.current) {
      clearInterval(rehydrateIntervalRef.current);
      rehydrateIntervalRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    consecutiveHeartbeatFailures.current = 0;
    navLockRef.current = false;
    isJoiningRef.current = false;
  }, []);

  const handleInsert = useCallback((matchRow: any) => {
    if (navLockRef.current) {
      console.log('QUEUE: Navigation already in progress, ignoring duplicate match');
      return;
    }

    console.log(`REALTIME: INSERT seen matchId=${matchRow.id}`);

    navLockRef.current = true;
    cleanup();

    setState(prev => ({
      ...prev,
      status: 'matched',
      matchId: matchRow.id,
    }));

    toast.success('Match found! Starting battle...');

    navigate(`/battle/${matchRow.id}`, {
      state: {
        match: matchRow,
      }
    });

    setTimeout(() => {
      navLockRef.current = false;
    }, 2000);
  }, [navigate, cleanup]);

  const rehydrateActiveMatch = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('matches_new')
        .select('*')
        .or(`${P1_COL}.eq.${user.id},${P2_COL}.eq.${user.id}`)
        .in('state', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('REHYDRATE: error', error);
        return;
      }

      if (data) {
        console.log(`REHYDRATE: found matchId=${data.id}`);
        handleInsert(data);
      }
    } catch (error) {
      console.error('REHYDRATE: exception', error);
    }
  }, [handleInsert]);

  const setupRealtimeSubscription = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('SUBSCRIBE: No authenticated user found');
      return;
    }

    console.log('SUBSCRIBE: Started for user', user.id);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`match-notify-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches_new',
          filter: `${P1_COL}=eq.${user.id}`,
        },
        (payload) => handleInsert(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches_new',
          filter: `${P2_COL}=eq.${user.id}`,
        },
        (payload) => handleInsert(payload.new)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('SUBSCRIBE: Successfully subscribed to match notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('SUBSCRIBE: Subscription error');
          toast.error('Connection error, please try again');
        }
      });

    channelRef.current = channel;
  }, [handleInsert]);

  const startHeartbeat = useCallback(async () => {
    const sendHeartbeat = async () => {
      try {
        const { error } = await supabase.functions.invoke('heartbeat', {
          body: {},
        });

        if (error) {
          consecutiveHeartbeatFailures.current++;
          console.error(`HB: error (attempt ${consecutiveHeartbeatFailures.current}: ${error.message})`);

          if (consecutiveHeartbeatFailures.current >= 3) {
            console.error('HB: 3 consecutive failures, leaving queue');
            toast.error('Connection lost, please rejoin queue');
            cleanup();
            setState(prev => ({
              ...prev,
              status: 'error',
              error: 'Connection lost',
            }));
          }
        } else {
          consecutiveHeartbeatFailures.current = 0;
          console.log('HB: tick ok');
        }
      } catch (error) {
        consecutiveHeartbeatFailures.current++;
        console.error(`HB: exception (attempt ${consecutiveHeartbeatFailures.current})`, error);
      }
    };

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 5000);
  }, [cleanup]);

  const startRehydratePoll = useCallback(() => {
    if (rehydrateIntervalRef.current) {
      clearInterval(rehydrateIntervalRef.current);
    }

    rehydrateIntervalRef.current = setInterval(() => {
      if (!navLockRef.current && state.status === 'queuing') {
        rehydrateActiveMatch();
      }
    }, 1500);
  }, [rehydrateActiveMatch, state.status]);

  const joinQueue = useCallback(async ({ subject, chapter, region }: JoinQueueParams) => {
    if (isJoiningRef.current) {
      console.log('QUEUE: Join already in progress, ignoring duplicate call');
      return;
    }

    if (state.status === 'queuing') {
      console.log('QUEUE: Already in queue, ignoring duplicate call');
      return;
    }

    isJoiningRef.current = true;
    setState(prev => ({ ...prev, status: 'joining', error: null }));

    console.log(`QUEUE: Joining queue for ${subject}/${chapter}`);

    try {
      await setupRealtimeSubscription();

      console.log('ENQUEUE: Sending request');
      const { data, error } = await supabase.functions.invoke('enqueue', {
        body: { subject, chapter, region },
      });

      if (error) {
        throw error;
      }

      console.log('ENQUEUE: Response received', data);

      if (data.matched && data.match) {
        console.log(`ENQUEUE: Instant match found, matchId=${data.match.id}`);
        handleInsert(data.match);
      } else {
        console.log('ENQUEUE: No instant match, subscribing and waiting');

        setState(prev => ({
          ...prev,
          status: 'queuing',
          queueStartTime: Date.now(),
        }));

        toast.success('Finding opponent...');

        await rehydrateActiveMatch();

        if (!navLockRef.current) {
          startHeartbeat();
          startRehydratePoll();
        }
      }
    } catch (error: any) {
      console.error('ENQUEUE: Failed to join queue:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to join queue',
      }));
      toast.error('Failed to join queue. Please try again.');
    } finally {
      isJoiningRef.current = false;
    }
  }, [state.status, setupRealtimeSubscription, handleInsert, rehydrateActiveMatch, startHeartbeat, startRehydratePoll]);

  const leaveQueue = useCallback(async () => {
    console.log('QUEUE: Leaving queue');

    try {
      await supabase.functions.invoke('leave_queue');
      toast.info('Left queue');
    } catch (error) {
      console.error('QUEUE: Error leaving queue:', error);
    }

    cleanup();
    setState({
      status: 'idle',
      matchId: null,
      opponentName: null,
      queueStartTime: null,
      error: null,
    });
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
  };
}
