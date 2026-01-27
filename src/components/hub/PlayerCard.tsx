import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { getRankByPoints } from '@/types/ranking';
import RankBadge from '@/components/RankBadge';

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
      <div className="w-full max-w-[22rem] mx-auto">
        <div className="aspect-[5/7] rounded-3xl animate-pulse bg-card/20 backdrop-blur-xl" />
      </div>
    );
  }

  const rank = getRankByPoints(stats.mmr || 1000);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-[22rem] mx-auto"
    >
      <div
        className="relative rounded-3xl overflow-hidden flex flex-col aspect-[5/7]"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Matte Texture Overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none">
          <filter id="noiseFilter">
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.9" 
              numOctaves="3" 
              stitchTiles="stitch" 
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>

        {/* Subtle Highlight Gradient */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
          }}
        />

        {/* Inner Border Ring for Depth */}
        <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] border border-white/5 pointer-events-none" />

        {/* Top Stats Row */}
        <div className="relative p-4 border-b border-white/5">
          <div className="flex justify-center">
            <RankBadge rank={rank} size="lg" />
          </div>
          <div className="mt-4 flex items-center justify-end gap-4">
            <div className="flex flex-col items-end">
              <span 
                className="text-sm font-bold text-white/90"
                style={{ 
                  fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                  letterSpacing: '0.1em'
                }}
              >
                LEVEL {stats.level || 1}
              </span>
            </div>
            {stats.mmr !== null && (
              <div className="flex flex-col items-end">
                <span 
                  className="text-lg font-bold text-white"
                  style={{ 
                    fontFamily: 'Orbitron, Inter, system-ui, sans-serif'
                  }}
                >
                  {stats.mmr}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/60">MMR</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Avatar Section */}
        <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          {/* Inner Shadow for Depth */}
          <div className="absolute inset-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)] pointer-events-none" />
          
          {stats.avatar_url ? (
            <img
              src={stats.avatar_url}
              alt="Player avatar"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div 
              className="relative w-28 h-28 rounded-full flex items-center justify-center border-2 border-white/10"
              style={{
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.3), rgba(153, 27, 27, 0.4))',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(220,38,38,0.2)',
              }}
            >
              <span 
                className="text-5xl font-bold text-white"
                style={{ 
                  fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)'
                }}
              >
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>

        {/* Player Name Section */}
        <div className="relative p-4 border-t border-white/5">
          <div 
            className="text-2xl font-bold text-white mb-1 truncate"
            style={{ 
              fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
              letterSpacing: '0.02em'
            }}
          >
            {profile?.username || 'Player'}
          </div>
        </div>

        {/* Bottom Action Row */}
        <div className="relative p-4 pt-3 grid grid-cols-1 gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="w-full justify-center text-sm font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            Customize Card
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/progression')}
            className="w-full justify-center text-sm font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            View Progression
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
