import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RankBadge from '@/components/RankBadge';
import { Button } from '@/components/ui/button';
import { rankColor, RankTier } from '@/lib/rankColors';
import { getRankByPoints } from '@/types/ranking';

interface PlayerStats {
  accuracy: number | null;
  winrate: number | null;
  mmr: number | null;
  rank_tier: string;
  avatar_url?: string;
}

export function PlayerCard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        // Fetch player data
        const { data: playerData } = await supabase
          .from('players')
          .select('mmr')
          .eq('id', user.id)
          .single();

        // Calculate stats from match history
        const { data: matches } = await supabase
          .from('matches_new')
          .select('winner_id, p1, p2, p1_score, p2_score')
          .or(`p1.eq.${user.id},p2.eq.${user.id}`)
          .eq('state', 'completed')
          .order('ended_at', { ascending: false })
          .limit(50);

        let wins = 0;
        let totalMatches = 0;
        let totalQuestions = 0;
        let correctAnswers = 0;

        if (matches) {
          totalMatches = matches.length;
          matches.forEach((match) => {
            if (match.winner_id === user.id) wins++;
            
            // Approximate accuracy from scores (assuming each match had similar question counts)
            const playerScore = match.p1 === user.id ? match.p1_score : match.p2_score;
            const opponentScore = match.p1 === user.id ? match.p2_score : match.p1_score;
            const totalScore = (playerScore || 0) + (opponentScore || 0);
            
            if (totalScore > 0) {
              correctAnswers += playerScore || 0;
              totalQuestions += totalScore;
            }
          });
        }

        const mmr = playerData?.mmr || 1000;
        const rank = getRankByPoints(mmr);

        setStats({
          accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : null,
          winrate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : null,
          mmr,
          rank_tier: rank.tier,
          avatar_url: profile?.username ? undefined : undefined, // Will use placeholder
        });
      } catch (error) {
        console.error('Error fetching player stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('player-stats-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${user.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches_new',
        },
        (payload) => {
          if (payload.new.p1 === user.id || payload.new.p2 === user.id) {
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  if (loading || !stats) {
    return (
      <div className="w-full max-w-[48rem] mx-auto">
        <div className="h-[32rem] rounded-2xl animate-pulse bg-card/20 backdrop-blur-xl" />
      </div>
    );
  }

  const colors = rankColor(stats.rank_tier as RankTier);
  const rank = getRankByPoints(stats.mmr || 1000);
  const rankDisplay = `${rank.tier.toUpperCase()} ${rank.subRank || ''}`.trim();
  const playerInitial = profile?.username?.[0]?.toUpperCase() || '?';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="glass-card"
      style={{ maxWidth: '320px', textAlign: 'center' }}
    >
      {/* Rank Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
        <span style={{ color: 'var(--color-neon-coral)', fontWeight: 600 }}>⬥ {rankDisplay}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>{stats.mmr || 1000} <small>MMR</small></span>
      </div>

      {/* Avatar */}
      <div className="player-avatar" style={{ margin: '0 auto var(--spacing-md)' }}>
        {playerInitial}
      </div>

      {/* Player Name */}
      <h2 style={{ marginBottom: 'var(--spacing-xs)' }}>{profile?.username || 'Player'}</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-md)' }}>{rankDisplay}</p>

      {/* Card Actions */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigate('/profile'); }}
          style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textDecoration: 'none', cursor: 'pointer' }}
        >
          Customize Card
        </a>
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigate('/progression'); }}
          style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textDecoration: 'none', cursor: 'pointer' }}
        >
          View Progression
        </a>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexDirection: 'column' }}>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/matchmaking-new')}
        >
          START
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/dev/db-test')}
        >
          WINNER DEMO
        </button>
      </div>
    </motion.div>
  );
}
