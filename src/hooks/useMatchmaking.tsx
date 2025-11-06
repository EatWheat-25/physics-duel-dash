import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface MatchFoundPayload {
  match_id: string;
  opponent_display: string;
  server_ws_url: string;
}

export const useMatchmaking = (subject: string, chapter: string) => {
  const [inQueue, setInQueue] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>('');
  const [serverWsUrl, setServerWsUrl] = useState<string>('');
  const navigate = useNavigate();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Join matchmaking queue via edge function
  const joinQueue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      // Call enqueue edge function
      const { error } = await supabase.functions.invoke('enqueue', {
        body: { subject, chapter }
      });

      if (error) {
        console.error('Error joining queue:', error);
        return;
      }

      console.log('✅ Successfully joined queue for', subject, chapter);
      setInQueue(true);

      // Log queue status for debugging
      setTimeout(async () => {
        const { data: queueData } = await supabase.from('queue').select('*');
        console.log('📊 Current queue status:', queueData);
      }, 1000);

      // Start heartbeat every 15 seconds
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      heartbeatIntervalRef.current = setInterval(async () => {
        const { error: hbError } = await supabase.functions.invoke('heartbeat');
        if (hbError) {
          console.error('Heartbeat error:', hbError);
        }
      }, 15000);

      // Subscribe to match_found events
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase.channel(`user_${user.id}`)
        .on('broadcast', { event: 'match_found' }, (payload: { payload: MatchFoundPayload }) => {
          console.log('Match found!', payload);
          const { match_id, opponent_display, server_ws_url } = payload.payload;
          setMatchId(match_id);
          setOpponentName(opponent_display);
          setServerWsUrl(server_ws_url);
          setInQueue(false);
          
          // Stop heartbeat
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        })
        .subscribe();

    } catch (error) {
      console.error('Error in joinQueue:', error);
    }
  };

  // Leave queue via edge function
  const leaveQueue = async () => {
    try {
      // Stop heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Unsubscribe from channel
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Call leave_queue edge function
      const { error } = await supabase.functions.invoke('leave_queue');
      if (error) {
        console.error('Error leaving queue:', error);
      }

      setInQueue(false);
    } catch (error) {
      console.error('Error in leaveQueue:', error);
    }
  };

  // Navigate to battle when match is found
  useEffect(() => {
    if (matchId) {
      navigate(`/online-battle/${matchId}`, { 
        state: { opponentName, serverWsUrl }
      });
    }
  }, [matchId, navigate, opponentName, serverWsUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
