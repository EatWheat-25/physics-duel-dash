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
  const heartbeatIntervalRef = useRef<number | null>(null);
  const burstPollRef = useRef<number | null>(null);
  const slowPollRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const catchAllChannelRef = useRef<RealtimeChannel | null>(null);
  const consecutiveHeartbeatFailures = useRef(0);
  const isJoiningRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    console.log('QUEUE: Cleaning up matchmaking resources');

    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (burstPollRef.current) {
      window.clearInterval(burstPollRef.current);
      burstPollRef.current = null;
    }

    if (slowPollRef.current) {
      window.clearInterval(slowPollRef.current);
      slowPollRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (catchAllChannelRef.current) {
      supabase.removeChannel(catchAllChannelRef.current);
      catchAllChannelRef.current = null;
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

    if (catchAllChannelRef.current) {
      supabase.removeChannel(catchAllChannelRef.current);
      catchAllChannelRef.current = null;
    }

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
    if (!userIdRef.current || navLockRef.current) return;

    try {
      const { data, error } = await supabase
        .from('matches_new')
        .select('*')
        .or(`${P1_COL}.eq.${userIdRef.current},${P2_COL}.eq.${userIdRef.current}`)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
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

  const subscribeToMatches = useCallback(async (userId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    return new Promise<void>((resolve) => {
      console.log('SUBSCRIBE: Starting for user', userId);
      console.log('SUBSCRIBE filters:', `${P1_COL}=eq.${userId}`, `${P2_COL}=eq.${userId}`);

      const channel = supabase
        .channel(`match-${userId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches_new',
            filter: `${P1_COL}=eq.${userId}`,
          },
          (payload) => {
            console.log('SUBSCRIBE: INSERT event (p1 filter)', payload.new);
            handleInsert(payload.new);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches_new',
            filter: `${P2_COL}=eq.${userId}`,
          },
          (payload) => {
            console.log('SUBSCRIBE: INSERT event (p2 filter)', payload.new);
            handleInsert(payload.new);
          }
        )
        .subscribe((status) => {
          console.log('SUBSCRIBE:', status);
          if (status === 'SUBSCRIBED') {
            console.log('SUBSCRIBE: ready');
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('SUBSCRIBE: Subscription error');
            toast.error('Connection error, please try again');
          }
        });

      channelRef.current = channel;
    });
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
      window.clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = window.setInterval(sendHeartbeat, 5000);
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

    if (navLockRef.current) {
      console.log('QUEUE: Navigation in progress, ignoring join');
      return;
    }

    isJoiningRef.current = true;
    setState(prev => ({ ...prev, status: 'joining', error: null }));

    console.log(`QUEUE: Joining queue for ${subject}/${chapter}`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      userIdRef.current = user.id;

      await subscribeToMatches(user.id);

      console.log('CATCHALL: Starting 5s catch-all listener');
      const catchAll = supabase
        .channel(`match-catchall-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches_new',
          },
          (payload: any) => {
            const row = payload.new || payload.record || {};
            const uid = user.id;
            const p1 = row.player1_id ?? row.p1_id ?? row.p1;
            const p2 = row.player2_id ?? row.p2_id ?? row.p2;
            console.log('CATCHALL INSERT:', row.id, { p1, p2, uid, fullRow: row });
            if (uid && (uid === p1 || uid === p2)) {
              console.log('CATCHALL: Match found for this user, navigating');
              handleInsert(row);
            } else {
              console.log('CATCHALL: Match not for this user, ignoring');
            }
          }
        )
        .subscribe((status) => {
          console.log('CATCHALL status:', status);
        });

      catchAllChannelRef.current = catchAll;

      setTimeout(() => {
        console.log('CATCHALL: 5s timeout, removing catch-all listener');
        if (catchAllChannelRef.current) {
          supabase.removeChannel(catchAllChannelRef.current);
          catchAllChannelRef.current = null;
        }
      }, 5000);

      console.log('ENQUEUE: sending');
      const { data, error } = await supabase.functions.invoke('enqueue', {
        body: { subject, chapter, region },
      });

      if (error) {
        throw error;
      }

      console.log('ENQUEUE: response received', data);

      if (data?.matched && data?.match) {
        console.log(`ENQUEUE: matched ${data.match.id}`);
        handleInsert(data.match);
        return;
      }

      const t0 = Date.now();
      const burst = window.setInterval(async () => {
        if (Date.now() - t0 > 5000 || navLockRef.current) {
          console.log('REHYDRATE: burst poll complete');
          window.clearInterval(burst);
          burstPollRef.current = null;
          return;
        }
        await rehydrateActiveMatch();
      }, 400);
      burstPollRef.current = burst;

      await rehydrateActiveMatch();

      setState(prev => ({
        ...prev,
        status: 'queuing',
        queueStartTime: Date.now(),
      }));

      toast.success('Finding opponent...');

      startHeartbeat();

      setTimeout(() => {
        if (slowPollRef.current) {
          window.clearInterval(slowPollRef.current);
        }
        slowPollRef.current = window.setInterval(async () => {
          if (!navLockRef.current && state.status === 'queuing') {
            await rehydrateActiveMatch();
          }
        }, 1500);
      }, 5000);

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
  }, [state.status, subscribeToMatches, handleInsert, rehydrateActiveMatch, startHeartbeat]);

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
