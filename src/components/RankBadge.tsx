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
  const isTopRank = rank.tier === 'Pocket Calculator';
  
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-lg px-6 py-3'
  };

  const emojiSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl'
  };

  const imageSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7'
  };

  return (
    <motion.div
      className={`inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-widest glassmorphism ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${rankData.gradient}, rgba(0, 229, 255, 0.1))`,
        boxShadow: isTopRank 
          ? `var(--shadow-purple), 0 0 40px ${rankData.glowColor}80` 
          : `var(--shadow-cyber-glow), 0 0 20px ${rankData.glowColor}60`,
        border: `1px solid ${rankData.glowColor}40`,
        textShadow: '0 0 10px rgba(0, 0, 0, 0.8)'
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
        boxShadow: isTopRank 
          ? `var(--shadow-purple), 0 0 60px ${rankData.glowColor}` 
          : `var(--shadow-intense), 0 0 40px ${rankData.glowColor}80`,
      }}
    >
      {rankData.imageUrl ? (
        <motion.img
          src={rankData.imageUrl}
          alt={rankData.displayName}
          className={`${imageSizes[size]} object-contain filter drop-shadow-lg`}
          animate={showAnimation || isTopRank ? {
            rotate: [0, 10, -10, 0],
            scale: [1, 1.2, 1],
          } : {}}
          transition={{
            duration: isTopRank ? 3 : 2,
            repeat: (showAnimation || isTopRank) ? (isTopRank ? Infinity : 2) : 0,
            delay: 0.5,
            repeatType: isTopRank ? "reverse" : "loop"
          }}
        />
      ) : (
        <motion.span 
          className={`${emojiSizes[size]} filter drop-shadow-lg`}
          animate={showAnimation || isTopRank ? {
            rotate: [0, 10, -10, 0],
            scale: [1, 1.2, 1],
          } : {}}
          transition={{
            duration: isTopRank ? 3 : 2,
            repeat: (showAnimation || isTopRank) ? (isTopRank ? Infinity : 2) : 0,
            delay: 0.5,
            repeatType: isTopRank ? "reverse" : "loop"
          }}
        >
          {rankData.emoji}
        </motion.span>
      )}
      <span className={`drop-shadow-lg text-white ${isTopRank ? 'font-extrabold' : ''}`}>
        {rankData.displayName}
      </span>
      {isTopRank && (
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ 
            background: 'hsl(var(--rank-sigma))',
            boxShadow: '0 0 10px hsl(var(--rank-sigma))'
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
      )}
    </motion.div>
  );
};

export default RankBadge;