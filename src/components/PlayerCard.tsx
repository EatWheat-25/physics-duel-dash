import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getRankByPoints, type Rank } from '@/types/ranking';

interface PlayerCardProps {
  playerId: string;
  isCurrentUser?: boolean;
  onEdit?: () => void;
  className?: string;
}

interface PlayerData {
  username: string;
  displayName: string | null;
  mmr: number;
  rank: Rank;
  level: number;
}

const rankColors: Record<string, string> = {
  'Bronze': 'text-orange-400',
  'Silver': 'text-gray-300',
  'Gold': 'text-yellow-400',
  'Platinum': 'text-cyan-400',
  'Diamond': 'text-blue-400',
  'Master': 'text-purple-400',
  'Grandmaster': 'text-red-400',
};

export function PlayerCard({ playerId, isCurrentUser = false, onEdit, className = '' }: PlayerCardProps) {
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', playerId)
          .single();

        // Fetch player stats
        const { data: player } = await supabase
          .from('players')
          .select('mmr')
          .eq('id', playerId)
          .single();

        if (profile && player) {
          const mmr = player.mmr || 1000;
          const rank = getRankByPoints(mmr);
          const level = Math.floor(mmr / 100) + 1; // Simple level calculation

          setPlayerData({
            username: profile.username,
            displayName: profile.display_name || profile.username,
            mmr,
            rank,
            level,
          });
          setEditedName(profile.display_name || profile.username);
        }
      } catch (error) {
        console.error('Error fetching player data:', error);
      }
    };

    fetchPlayerData();
  }, [playerId]);

  const handleSave = async () => {
    if (!isCurrentUser || !editedName.trim()) return;

    try {
      await supabase
        .from('profiles')
        .update({ display_name: editedName })
        .eq('id', playerId);

      if (playerData) {
        setPlayerData({ ...playerData, displayName: editedName });
      }
      setIsEditing(false);
      onEdit?.();
    } catch (error) {
      console.error('Error updating name:', error);
    }
  };

  if (!playerData) {
    return (
      <div className={`w-full h-64 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center ${className}`}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  const rankColor = rankColors[playerData.rank.tier] || playerData.rank.color || 'text-white';

  return (
    <motion.div
      className={`relative w-full h-64 bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
      whileHover={{ 
        scale: 1.02,
        rotateY: 2,
        rotateX: -2,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* 3D Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)]" />
      
      {/* Holographic Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-6">
        {/* Top Bar */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${rankColor}`}>{playerData.rank.tier.toUpperCase()} {playerData.rank.subRank}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/60">
            <span>LEVEL {playerData.level}</span>
            <span className="text-white/40">•</span>
            <span>{playerData.mmr} MMR</span>
          </div>
        </div>

        {/* Avatar */}
        <div className="flex-1 flex items-center justify-center mb-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-white/20 flex items-center justify-center text-3xl font-bold text-white/80">
            {playerData.displayName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Name Section */}
        <div className="flex items-center justify-between">
          {isEditing && isCurrentUser ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
                autoFocus
              />
            </div>
          ) : (
            <>
              <div>
                <div className="text-xl font-bold text-white mb-1">{playerData.displayName}</div>
                <div className="text-sm text-white/50">{playerData.rank.displayName || `${playerData.rank.tier} ${playerData.rank.subRank}`}</div>
              </div>
              {isCurrentUser && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-white/60" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Bottom Links */}
        {isCurrentUser && (
          <div className="mt-4 flex gap-4 text-xs text-white/30">
            <button className="hover:text-white/50 transition-colors">Customize Card</button>
            <span className="text-white/10">•</span>
            <button className="hover:text-white/50 transition-colors">View Progression</button>
          </div>
        )}
      </div>

      {/* Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 hover:opacity-100 transition-opacity duration-500 -z-10" />
    </motion.div>
  );
}
