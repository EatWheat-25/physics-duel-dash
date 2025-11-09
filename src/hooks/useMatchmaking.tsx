import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useMatchmaking = (subject: string, chapter: string) => {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string>('');
  const [yourUsername, setYourUsername] = useState<string>('');
  const navigate = useNavigate();

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

  const createInstantMatch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      console.log('🎯 Creating instant match for', subject, chapter);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      const displayName = profile?.username || user.email?.split('@')[0] || 'Player';

      await supabase.from('players').upsert({
        id: user.id,
        display_name: displayName,
        region: 'pk',
      });

      const { data: player } = await supabase
        .from('players')
        .select('mmr')
        .eq('id', user.id)
        .maybeSingle();

      const mmr = player?.mmr || 1000;

      const botId = '00000000-0000-0000-0000-000000000000';

      await supabase.from('players').upsert({
        id: botId,
        display_name: 'AI Opponent',
        region: 'pk',
        mmr: mmr + Math.floor(Math.random() * 200) - 100,
      });

      const newMatchId = crypto.randomUUID();

      const { error: matchError } = await supabase
        .from('matches_new')
        .insert({
          id: newMatchId,
          p1: user.id,
          p2: botId,
          subject,
          chapter,
          state: 'active',
          p1_score: 0,
          p2_score: 0,
        });

      if (matchError) {
        console.error('Error creating match:', matchError);
        return;
      }

      console.log('✅ Instant match created:', newMatchId);
      setMatchId(newMatchId);
      setOpponentName('AI Opponent');

    } catch (error) {
      console.error('Error in createInstantMatch:', error);
    }
  };

  useEffect(() => {
    if (matchId) {
      navigate(`/online-battle/${matchId}`, {
        state: { opponentName, yourUsername }
      });
    }
  }, [matchId, navigate, opponentName, yourUsername]);

  return {
    createInstantMatch,
  };
};
