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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-[48rem] mx-auto"
    >
      <div
        className="relative rounded-2xl overflow-hidden backdrop-blur-xl"
        style={{
          background: 'rgba(0, 20, 40, 0.15)',
          border: `1px solid ${colors.outline}`,
          boxShadow: `0 0 40px ${colors.glow}, inset 0 1px 0 ${colors.innerBorder}`,
        }}
      >
        {/* Top Stats Row */}
        <div className="p-6 flex items-center gap-4 border-b border-white/10">
          <RankBadge rank={rank} size="sm" />
          
          {stats.accuracy !== null && (
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-foreground">{stats.accuracy}%</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Accuracy</span>
            </div>
          )}

          {stats.winrate !== null && (
            <div className="flex flex-col ml-4">
              <span className="text-2xl font-bold text-foreground">{stats.winrate}%</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Winrate</span>
            </div>
          )}

          {stats.mmr !== null && stats.winrate === null && (
            <div className="flex flex-col ml-4">
              <span className="text-2xl font-bold text-foreground">{stats.mmr}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">MMR</span>
            </div>
          )}
        </div>

        {/* Main Character/Cover Canvas */}
        <div className="relative h-[20rem] w-full overflow-hidden">
          {stats.avatar_url ? (
            <img
              src={stats.avatar_url}
              alt="Player card"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `
                  repeating-linear-gradient(
                    0deg,
                    rgba(255, 255, 255, 0.03) 0px,
                    transparent 1px,
                    transparent 40px,
                    rgba(255, 255, 255, 0.03) 41px
                  ),
                  repeating-linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0.03) 0px,
                    transparent 1px,
                    transparent 40px,
                    rgba(255, 255, 255, 0.03) 41px
                  ),
                  linear-gradient(135deg, rgba(${parseInt(colors.outline.slice(1, 3), 16)}, ${parseInt(colors.outline.slice(3, 5), 16)}, ${parseInt(colors.outline.slice(5, 7), 16)}, 0.05), transparent)
                `,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl opacity-20">{profile?.username?.[0]?.toUpperCase() || '?'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Row */}
        <div className="p-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="text-sm font-medium text-foreground hover:bg-white/5 border border-white/10"
          >
            Customize Card
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/progression')}
            className="text-sm font-medium text-foreground hover:bg-white/5 border border-white/10"
          >
            View Progression
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
