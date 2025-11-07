import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface MatchFoundPayload {
  match_id: string;
  opponent_name: string;
}

export const useMatchmaking = (subject: string, chapter: string) => {
  const [inQueue, setInQueue] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>('');
  const [yourUsername, setYourUsername] = useState<string>('');
  const navigate = useNavigate();
  const channelRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const joinQueue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      console.log('🎯 Joining queue for', subject, chapter);

      const { data, error } = await supabase.functions.invoke('enqueue', {
        body: { subject, chapter }
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
        setInQueue(false);
        return;
      }

      setInQueue(true);
      console.log('⏳ Added to queue, waiting for opponent...');

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

            setMatchId(match.id);
            setOpponentName(opponent?.display_name || 'Opponent');
            setInQueue(false);

            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
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

            setMatchId(match.id);
            setOpponentName(opponent?.display_name || 'Opponent');
            setInQueue(false);

            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });

      pollingIntervalRef.current = setInterval(async () => {
        console.log('🔄 Polling for matches...');
        const { data: matches } = await supabase
          .from('matches_new')
          .select('*')
          .or(`p1.eq.${user.id},p2.eq.${user.id}`)
          .eq('state', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (matches && matches.length > 0) {
          const match = matches[0];
          console.log('✅ Found match via polling:', match);

          const opponentId = match.p1 === user.id ? match.p2 : match.p1;
          const { data: opponent } = await supabase
            .from('players')
            .select('display_name')
            .eq('id', opponentId)
            .maybeSingle();

          setMatchId(match.id);
          setOpponentName(opponent?.display_name || 'Opponent');
          setInQueue(false);

          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        }
      }, 2000);

      heartbeatIntervalRef.current = setInterval(async () => {
        console.log('💓 Sending heartbeat...');
        const { error } = await supabase.functions.invoke('heartbeat');
        if (error) {
          console.error('Heartbeat error:', error);
        }
      }, 5000);

    } catch (error) {
      console.error('Error in joinQueue:', error);
    }
  };

  const leaveQueue = async () => {
    try {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

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
        state: { opponentName, yourUsername }
      });
    }
  }, [matchId, navigate, opponentName, yourUsername]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    inQueue,
    matchId,
    joinQueue,
    leaveQueue,
  };
};
