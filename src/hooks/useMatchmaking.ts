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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const consecutiveHeartbeatFailures = useRef(0);
  const isJoiningRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    console.log('QUEUE: Cleaning up matchmaking resources');

    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
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

  const subscribeToNotifications = useCallback(async (userId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    return new Promise<void>((resolve) => {
      console.log('MN SUBSCRIBE: Starting for user', userId);

      const channel = supabase
        .channel(`mn-${userId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'match_notifications',
            filter: `user_id=eq.${userId}`,
          },
          async (payload: any) => {
            const matchId = payload?.new?.match_id;
            console.log('MN INSERT: notification received', { matchId, payload: payload.new });

            if (!matchId || navLockRef.current) {
              console.log('MN INSERT: ignoring (no matchId or nav locked)');
              return;
            }

            console.log('MN INSERT: fetching match', matchId);
            const { data, error } = await supabase
              .from('matches_new')
              .select('*')
              .eq('id', matchId)
              .maybeSingle();

            if (error) {
              console.error('MN INSERT: error fetching match', error);
              return;
            }

            if (data) {
              console.log('MN INSERT: match fetched, navigating', data.id);
              handleInsert(data);
            }
          }
        )
        .subscribe((status) => {
          console.log('MN SUBSCRIBE:', status);
          if (status === 'SUBSCRIBED') {
            console.log('MN SUBSCRIBE: ready');
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('MN SUBSCRIBE: subscription error');
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

      await subscribeToNotifications(user.id);

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

      setState(prev => ({
        ...prev,
        status: 'queuing',
        queueStartTime: Date.now(),
      }));

      toast.success('Finding opponent...');

      startHeartbeat();

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
  }, [state.status, subscribeToNotifications, handleInsert, startHeartbeat]);

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
