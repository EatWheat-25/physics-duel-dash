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
  const [offer, setOffer] = useState<any>(null);
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

      console.log('🎯 Finding match for', subject, chapter);

      const { data, error } = await supabase.functions.invoke('find_match', {
        body: { subject, region: 'pk' }
      });

      if (error) {
        console.error('Error finding match:', error);
        return;
      }

      console.log('✅ Find match response:', data);

      if (data.status === 'offered') {
        setOffer(data);
        setInQueue(false);
        return data;
      }

      if (data.status === 'waiting') {
        setInQueue(true);
      }

      return data;
    } catch (error) {
      console.error('Error in joinQueue:', error);
    }
  };

  const subscribeToOffer = (offerId: string, matchId: string) => {
    const { data: { user } } = supabase.auth.getUser();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`offer:${offerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_offers',
          filter: `id=eq.${offerId}`
        },
        (payload) => {
          console.log('Offer update:', payload);
          const row = payload.new as any;

          if (row?.state === 'confirmed') {
            setMatchId(matchId);
            setInQueue(false);
          } else if (row?.state === 'expired' || row?.state === 'declined') {
            setOffer(null);
            setInQueue(false);
          }
        }
      )
      .subscribe();
  };

  const leaveQueue = async () => {
    try {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('queue').delete().eq('player_id', user.id);
      }

      setInQueue(false);
      setOffer(null);
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
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    inQueue,
    matchId,
    offer,
    joinQueue,
    leaveQueue,
    subscribeToOffer,
  };
};
