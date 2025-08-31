import React from 'react';
import { motion } from 'framer-motion';
import { RANKS, RankName, getRankByPoints } from '@/types/ranking';

interface RankBadgeProps {
  rank: RankName;
  showAnimation?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({ 
  rank, 
  showAnimation = false, 
  size = 'md',
  className = '' 
}) => {
  const rankData = RANKS.find(r => r.tier === rank.tier && r.subRank === rank.subRank) || RANKS[0];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-lg px-4 py-2'
  };

  const emojiSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl'
  };

  return (
    <motion.div
      className={`inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-wider border border-white/20 ${sizeClasses[size]} ${className}`}
      style={{
        background: rankData.gradient,
        boxShadow: `0 0 20px ${rankData.glowColor}`,
      }}
      initial={showAnimation ? { scale: 0, rotate: -180 } : {}}
      animate={showAnimation ? { scale: 1, rotate: 0 } : {}}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 15,
        duration: 0.8
      }}
      whileHover={{
        scale: 1.05,
        boxShadow: `0 0 30px ${rankData.glowColor}`,
      }}
    >
      <motion.span 
        className={emojiSizes[size]}
        animate={showAnimation ? {
          rotate: [0, 10, -10, 0],
          scale: [1, 1.2, 1],
        } : {}}
        transition={{
          duration: 2,
          repeat: showAnimation ? 2 : 0,
          delay: 0.5
        }}
      >
        {rankData.emoji}
      </motion.span>
      <span className="text-white drop-shadow-lg">
        {rankData.displayName}
      </span>
    </motion.div>
  );
};

export default RankBadge;