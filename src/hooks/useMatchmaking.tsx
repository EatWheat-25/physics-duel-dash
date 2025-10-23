import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useMatchmaking = (subject: string, mode: string, rankTier: string) => {
  const [inQueue, setInQueue] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const navigate = useNavigate();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    // Start continuous polling for matches
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(async () => {
      await findMatch(user.id);
    }, 2000); // Poll every 2 seconds
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
      console.log('No opponent found yet, continuing to search...');
      return;
    }

    const opponent = players[0];
    console.log('Found opponent!', opponent);

    // Stop polling once we found an opponent
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Fetch questions for this match - bypass type checking to avoid recursion
    const questionsQuery: any = await (supabase as any)
      .from('questions')
      .select('*')
      .eq('subject', subject)
      .eq('mode', mode)
      .limit(5);
    
    const questions = questionsQuery.data;

    if (!questions || questions.length === 0) {
      console.error('No questions found for this mode');
      return;
    }

    // Create match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        player1_id: userId,
        player2_id: opponent.user_id,
        subject,
        mode,
        questions: questions,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (matchError) {
      console.error('Error creating match:', matchError);
      return;
    }

    console.log('Match created successfully!', match);

    // Remove both players from queue
    await supabase
      .from('matchmaking_queue')
      .delete()
      .in('user_id', [userId, opponent.user_id]);

    setInQueue(false);
    setMatchId(match.id);
  };

  // Leave queue
  const leaveQueue = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

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

      // Listen for matches where user is either player1 or player2
      channel = supabase
        .channel(`matchmaking:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches',
          },
          (payload) => {
            if (payload.new.player1_id === user.id || payload.new.player2_id === user.id) {
              setMatchId(payload.new.id);
            }
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
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
