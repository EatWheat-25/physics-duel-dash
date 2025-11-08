import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface MatchFoundPayload {
  match_id: string;
  opponent_name: string;
  match_quality?: number;
}

export const useMatchmaking = (subject: string, chapter: string) => {
  const [inQueue, setInQueue] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>('');
  const [yourUsername, setYourUsername] = useState<string>('');
  const [matchQuality, setMatchQuality] = useState<number | null>(null);
  const navigate = useNavigate();
  const channelRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);

  useEffect(() => {
    const fetchUsername = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setYourUsername(profile.username);
        }
      }
    };
    fetchUsername();
  }, []);

  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        await supabase.functions.invoke('heartbeat');
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 10000);
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const joinQueue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      console.log('🎯 Joining queue for', subject, chapter);

      const { data, error } = await supabase.functions.invoke('enqueue', {
        body: { subject, chapter, region: 'pk' }
      });

      if (error) {
        console.error('Error joining queue:', error);
        return;
      }

      console.log('✅ Enqueue response:', data);

      if (data.matched) {
        console.log('🎉 Matched immediately!');
        setMatchId(data.match_id);
        setOpponentName(data.opponent_name);
        setMatchQuality(data.match_quality);
        setInQueue(false);
        return;
      }

      setInQueue(true);
      console.log('⏳ Added to queue, waiting for opponent...');

      startHeartbeat();

      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel(`matchmaking_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches_new',
            filter: `p1=eq.${user.id}`,
          },
          async (payload) => {
            console.log('🎉 Match found (as p1)!', payload);
            const match = payload.new as any;

            const { data: opponent } = await supabase
              .from('players')
              .select('display_name')
              .eq('id', match.p2)
              .maybeSingle();

            const { data: quality } = await supabase
              .from('match_quality_metrics')
              .select('quality_score')
              .eq('match_id', match.id)
              .maybeSingle();

            setMatchId(match.id);
            setOpponentName(opponent?.display_name || 'Opponent');
            setMatchQuality(quality?.quality_score || null);
            setInQueue(false);
            stopHeartbeat();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches_new',
            filter: `p2=eq.${user.id}`,
          },
          async (payload) => {
            console.log('🎉 Match found (as p2)!', payload);
            const match = payload.new as any;

            const { data: opponent } = await supabase
              .from('players')
              .select('display_name')
              .eq('id', match.p1)
              .maybeSingle();

            const { data: quality } = await supabase
              .from('match_quality_metrics')
              .select('quality_score')
              .eq('match_id', match.id)
              .maybeSingle();

            setMatchId(match.id);
            setOpponentName(opponent?.display_name || 'Opponent');
            setMatchQuality(quality?.quality_score || null);
            setInQueue(false);
            stopHeartbeat();
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });

    } catch (error) {
      console.error('Error in joinQueue:', error);
      stopHeartbeat();
    }
  };

  const leaveQueue = async () => {
    try {
      stopHeartbeat();

      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const { error } = await supabase.functions.invoke('leave_queue');
      if (error) {
        console.error('Error leaving queue:', error);
      }

      setInQueue(false);
    } catch (error) {
      console.error('Error in leaveQueue:', error);
    }
  };

  useEffect(() => {
    if (matchId) {
      navigate(`/online-battle/${matchId}`, {
        state: { opponentName, yourUsername, matchQuality }
      });
    }
  }, [matchId, navigate, opponentName, yourUsername, matchQuality]);

  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    inQueue,
    matchId,
    matchQuality,
    joinQueue,
    leaveQueue,
  };
};
