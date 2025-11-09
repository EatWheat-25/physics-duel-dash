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
        body: { subject, chapter, region: 'pk' }
      });

      if (error) {
        console.error('Error joining queue:', error);
        return;
      }

      console.log('✅ Enqueue response:', data);

      if (data.matched) {
        console.log('🎉 Matched immediately!');
        // Navigate immediately without setting up subscriptions
        navigate(`/online-battle/${data.match_id}`, {
          state: { 
            opponentName: data.opponent_name, 
            yourUsername, 
            matchQuality: data.match_quality 
          }
        });
        return;
      }

      setInQueue(true);
      console.log('⏳ Added to queue, waiting for opponent...');

      // Poll for matches every 500ms as primary mechanism (realtime as backup)
      const pollInterval = setInterval(async () => {
        console.log('🔍 Polling for match...');
        const { data: matches } = await supabase
          .from('matches_new')
          .select('*')
          .or(`p1.eq.${user.id},p2.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (matches && matches.length > 0) {
          const match = matches[0];
          console.log('🎉 Match found via polling!', match);
          
          clearInterval(pollInterval);
          
          const opponentId = match.p1 === user.id ? match.p2 : match.p1;
          const { data: opponent } = await supabase
            .from('players')
            .select('display_name')
            .eq('id', opponentId)
            .maybeSingle();

          // Navigate immediately
          navigate(`/online-battle/${match.id}`, {
            state: { 
              opponentName: opponent?.display_name || 'Opponent', 
              yourUsername, 
              matchQuality: null 
            }
          });
        }
      }, 500);

      // Store interval ref for cleanup
      (channelRef as any).pollInterval = pollInterval;

    } catch (error) {
      console.error('Error in joinQueue:', error);
    }
  };

  const leaveQueue = async () => {
    try {
      // Clear polling interval
      if (channelRef.current && (channelRef as any).pollInterval) {
        clearInterval((channelRef as any).pollInterval);
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
        state: { opponentName, yourUsername, matchQuality }
      });
    }
  }, [matchId, navigate, opponentName, yourUsername, matchQuality]);

  useEffect(() => {
    return () => {
      // Cleanup polling interval
      if (channelRef.current && (channelRef as any).pollInterval) {
        clearInterval((channelRef as any).pollInterval);
      }
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
