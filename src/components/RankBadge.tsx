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
  const isSigma = rank.tier === 'Sigma';
  
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

  return (
    <motion.div
      className={`inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-widest glassmorphism ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${rankData.gradient}, rgba(195, 100, 255, 0.1))`,
        boxShadow: isSigma 
          ? `var(--shadow-soft), 0 0 25px ${rankData.glowColor}60` 
          : `var(--shadow-soft), 0 0 15px ${rankData.glowColor}40`,
        border: `1px solid ${rankData.glowColor}30`
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
        boxShadow: isSigma 
          ? `var(--shadow-medium), 0 0 35px ${rankData.glowColor}80` 
          : `var(--shadow-medium), 0 0 25px ${rankData.glowColor}60`,
      }}
    >
      <motion.span 
        className={`${emojiSizes[size]} filter drop-shadow-lg`}
        animate={showAnimation || isSigma ? {
          rotate: [0, 10, -10, 0],
          scale: [1, 1.2, 1],
        } : {}}
        transition={{
          duration: isSigma ? 3 : 2,
          repeat: (showAnimation || isSigma) ? (isSigma ? Infinity : 2) : 0,
          delay: 0.5,
          repeatType: isSigma ? "reverse" : "loop"
        }}
      >
        {rankData.emoji}
      </motion.span>
      <span className={`drop-shadow-lg ${isSigma ? 'font-extrabold' : ''}`}>
        {rankData.displayName}
      </span>
      {isSigma && (
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