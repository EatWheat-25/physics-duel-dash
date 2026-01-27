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
  const sizeConfig = {
    sm: {
      image: 'w-16 h-16',
      emoji: 'text-6xl',
      label: 'text-xs',
      gap: 'gap-1.5',
    },
    md: {
      image: 'w-20 h-20',
      emoji: 'text-7xl',
      label: 'text-sm',
      gap: 'gap-1.5',
    },
    lg: {
      image: 'w-24 h-24',
      emoji: 'text-8xl',
      label: 'text-base',
      gap: 'gap-2',
    },
  };
  const activeSize = sizeConfig[size];

  return (
    <motion.div
      className={`inline-flex flex-col items-center ${activeSize.gap} ${className}`}
      initial={showAnimation ? { scale: 0.6, opacity: 0 } : {}}
      animate={showAnimation ? { scale: 1, opacity: 1 } : {}}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 15,
        duration: 0.8
      }}
    >
      {rankData.imageUrl ? (
        <motion.img
          src={rankData.imageUrl}
          alt={rankData.tier}
          className={`${activeSize.image} object-contain filter drop-shadow-lg`}
          animate={showAnimation ? {
            rotate: [0, 6, -6, 0],
            scale: [1, 1.08, 1],
          } : {}}
          transition={{
            duration: 1.8,
            repeat: showAnimation ? 2 : 0,
            delay: 0.2,
            repeatType: "reverse"
          }}
        />
      ) : (
        <motion.span 
          className={`${activeSize.emoji} leading-none filter drop-shadow-lg`}
          animate={showAnimation ? {
            rotate: [0, 6, -6, 0],
            scale: [1, 1.08, 1],
          } : {}}
          transition={{
            duration: 1.8,
            repeat: showAnimation ? 2 : 0,
            delay: 0.2,
            repeatType: "reverse"
          }}
        >
          {rankData.emoji}
        </motion.span>
      )}
      <span
        className={`uppercase tracking-widest font-semibold ${activeSize.label} drop-shadow-lg`}
        style={{ color: rankData.color }}
      >
        {rankData.tier}
      </span>
    </motion.div>
  );
};

export default RankBadge;