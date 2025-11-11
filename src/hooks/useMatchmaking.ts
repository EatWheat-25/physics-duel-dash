import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const consecutiveHeartbeatFailures = useRef(0);
  const isJoiningRef = useRef(false);

  const cleanup = useCallback(() => {
    console.log('QUEUE: Cleaning up matchmaking resources');

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    consecutiveHeartbeatFailures.current = 0;
    navLockRef.current = false;
    isJoiningRef.current = false;
  }, []);

  const handleMatchInsert = useCallback((payload: any) => {
    if (navLockRef.current) {
      console.log('REALTIME: Match INSERT received but navigation already in progress, ignoring');
      return;
    }

    const matchData = payload.new;
    console.log('REALTIME: Match INSERT detected, matchId=' + matchData.id);

    navLockRef.current = true;
    cleanup();

    setState(prev => ({
      ...prev,
      status: 'matched',
      matchId: matchData.id,
    }));

    toast.success('Match found! Starting battle...');

    navigate(`/battle/${matchData.id}`, {
      state: {
        match: matchData,
        yourUsername: 'You',
        opponentName: 'Opponent'
      }
    });

    setTimeout(() => {
      navLockRef.current = false;
    }, 2000);
  }, [navigate, cleanup]);

  const setupRealtimeSubscription = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('REALTIME: No authenticated user found');
      return;
    }

    console.log('REALTIME: Subscribing to match notifications (p1 + p2 channels)');

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
          filter: `p1=eq.${user.id}`,
        },
        (payload) => handleMatchInsert(payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches_new',
          filter: `p2=eq.${user.id}`,
        },
        (payload) => handleMatchInsert(payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('REALTIME: Successfully subscribed to match notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('REALTIME: Subscription error');
          toast.error('Connection error, please try again');
        }
      });

    channelRef.current = channel;
  }, [handleMatchInsert]);

  const startHeartbeat = useCallback(async () => {
    const sendHeartbeat = async () => {
      try {
        const { error } = await supabase.functions.invoke('heartbeat', {
          body: {},
        });

        if (error) {
          consecutiveHeartbeatFailures.current++;
          console.error(`QUEUE: Heartbeat FAIL (attempt ${consecutiveHeartbeatFailures.current}, error: ${error.message})`);

          if (consecutiveHeartbeatFailures.current >= 3) {
            console.error('QUEUE: 3 consecutive heartbeat failures, leaving queue');
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
          console.log('QUEUE: Heartbeat OK');
        }
      } catch (error) {
        consecutiveHeartbeatFailures.current++;
        console.error(`QUEUE: Heartbeat exception (attempt ${consecutiveHeartbeatFailures.current})`, error);
      }
    };

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 5000);
  }, [cleanup]);

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
      const { data, error } = await supabase.functions.invoke('enqueue', {
        body: { subject, chapter, region },
      });

      if (error) {
        throw error;
      }

      console.log('QUEUE: Joined successfully, response:', data);

      if (data.matched) {
        console.log('QUEUE: Instant match found, matchId=' + data.match_id);
        navLockRef.current = true;

        setState(prev => ({
          ...prev,
          status: 'matched',
          matchId: data.match_id,
          opponentName: data.opponent_name,
        }));

        toast.success('Match found! Starting battle...');
        navigate(`/battle/${data.match_id}`);

        setTimeout(() => {
          navLockRef.current = false;
        }, 2000);
      } else {
        setState(prev => ({
          ...prev,
          status: 'queuing',
          queueStartTime: Date.now(),
        }));

        toast.success('Finding opponent...');

        await setupRealtimeSubscription();
        startHeartbeat();
      }
    } catch (error: any) {
      console.error('QUEUE: Failed to join queue:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to join queue',
      }));
      toast.error('Failed to join queue. Please try again.');
    } finally {
      isJoiningRef.current = false;
    }
  }, [state.status, setupRealtimeSubscription, startHeartbeat, navigate]);

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
