import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useMatchmaking = (subject: string, mode: string, rankTier: string) => {
  const [inQueue, setInQueue] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Join matchmaking queue
  const joinQueue = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Add to queue
    const { error } = await supabase
      .from('matchmaking_queue')
      .insert({
        user_id: user.id,
        subject,
        mode,
        rank_tier: rankTier,
      });

    if (error) {
      console.error('Error joining queue:', error);
      return;
    }

    setInQueue(true);

    // Try to find a match
    await findMatch(user.id);
  };

  // Find a match with another player
  const findMatch = async (userId: string) => {
    // Look for another player in queue (not yourself)
    const { data: players, error } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('subject', subject)
      .eq('mode', mode)
      .neq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !players || players.length === 0) {
      return;
    }

    const opponent = players[0];

    // Fetch questions for this match
    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('subject', subject)
      .limit(5);

    // Create match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        player1_id: userId,
        player2_id: opponent.user_id,
        subject,
        mode,
        questions: questions || [],
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (matchError) {
      console.error('Error creating match:', matchError);
      return;
    }

    // Remove both players from queue
    await supabase
      .from('matchmaking_queue')
      .delete()
      .in('user_id', [userId, opponent.user_id]);

    setMatchId(match.id);
  };

  // Leave queue
  const leaveQueue = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('user_id', user.id);

    setInQueue(false);
  };

  // Listen for match creation
  useEffect(() => {
    let channel: any;

    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('matchmaking')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches',
            filter: `player1_id=eq.${user.id},player2_id=eq.${user.id}`,
          },
          (payload) => {
            setMatchId(payload.new.id);
          }
        )
        .subscribe();
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Navigate to battle when match is found
  useEffect(() => {
    if (matchId) {
      navigate(`/online-battle/${matchId}`);
    }
  }, [matchId, navigate]);

  return {
    inQueue,
    matchId,
    joinQueue,
    leaveQueue,
  };
};
