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
  level: number;
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
        // Calculate level from MMR (1 level per 100 MMR, starting at level 1)
        const level = Math.max(1, Math.floor(mmr / 100) + 1);

        setStats({
          accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : null,
          winrate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : null,
          mmr,
          rank_tier: rank.tier,
          level,
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

  const getRankEmoji = (tier: string) => {
    const emojiMap: Record<string, string> = {
      'Bronze': '🥉',
      'Silver': '🥈',
      'Gold': '🥇',
      'Diamond': '💎',
      'Unbeatable': '🔥',
      'Pocket Calculator': '🧮',
    };
    return emojiMap[tier] || '🥉';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-[48rem] mx-auto"
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(30, 41, 59, 0.9)',
          border: '2px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Top Stats Row */}
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getRankEmoji(rank.tier)}</div>
            <div>
              <div className="text-xl font-bold text-white uppercase">
                {rank.tier} {rank.subRank}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-lg font-bold text-white">LEVEL {stats.level || 1}</span>
            </div>
            {stats.mmr !== null && (
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold text-white">{stats.mmr}</span>
                <span className="text-xs uppercase tracking-wider text-white/70">MMR</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Avatar Section */}
        <div className="relative h-[24rem] w-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          {stats.avatar_url ? (
            <img
              src={stats.avatar_url}
              alt="Player avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center border-4 border-white/20">
              <span className="text-6xl font-bold text-white">
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>

        {/* Player Name Section */}
        <div className="p-6 border-b border-white/10">
          <div className="text-3xl font-bold text-white mb-1">
            {profile?.username || 'Player'}
          </div>
          <div className="text-lg text-white/80">
            {rank.tier} {rank.subRank}
          </div>
        </div>

        {/* Bottom Action Row */}
        <div className="p-6 flex justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            Customize Card
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/progression')}
            className="text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            View Progression
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
