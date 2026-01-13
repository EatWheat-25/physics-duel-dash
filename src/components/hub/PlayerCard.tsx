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
  rank_points: number | null;
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
          .select('rank_points')
          .eq('id', user.id)
          .single();

        // Calculate stats from ranked history (season)
        const { data: history } = await supabase
          .from('player_rank_points_history')
          .select('outcome, accuracy_pct')
          .eq('player_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        let wins = 0;
        let totalMatches = 0;
        let totalAcc = 0;
        let accCount = 0;

        if (history) {
          totalMatches = history.length;
          history.forEach((h) => {
            if (h.outcome === 'win') wins++;
            if (typeof h.accuracy_pct === 'number') {
              totalAcc += h.accuracy_pct;
              accCount++;
            }
          });
        }

        const rankPoints = playerData?.rank_points ?? 0;
        const rank = getRankByPoints(rankPoints);
        const level = 1;

        setStats({
          accuracy: accCount > 0 ? Math.round(totalAcc / accCount) : null,
          winrate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : null,
          rank_points: rankPoints,
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

  const colors = rankColor(stats.rank_tier as RankTier);
  const rank = getRankByPoints(stats.rank_points ?? 0);

  const getRankEmoji = (tier: string) => {
    const emojiMap: Record<string, string> = {
      'Bronze': '🥉',
      'Silver': '🥈',
      'Gold': '🥇',
      'Platinum': '🟪',
      'Diamond': '💎',
      'Ruby': '♦',
    };
    return emojiMap[tier] || '🥉';
  };

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
        <div className="relative p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-xl">{getRankEmoji(rank.tier)}</div>
            <div className="min-w-0">
              <div 
                className="text-lg font-bold text-white uppercase truncate"
                style={{ 
                  fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                  letterSpacing: '0.05em'
                }}
              >
                {rank.tier}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
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
            {stats.rank_points !== null && (
              <div className="flex flex-col items-end">
                <span 
                  className="text-lg font-bold text-white"
                  style={{ 
                    fontFamily: 'Orbitron, Inter, system-ui, sans-serif'
                  }}
                >
                  {stats.rank_points}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/60">POINTS</span>
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

          {/* Valorant-style rank icon (bottom-center) */}
          {rank.imageUrl && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <img
                src={rank.imageUrl}
                alt={rank.tier}
                className="w-14 h-14 drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
                loading="lazy"
              />
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
          <div className="text-sm text-white/70 uppercase tracking-wider">
            {rank.tier}
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
