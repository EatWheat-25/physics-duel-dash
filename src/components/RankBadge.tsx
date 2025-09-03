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
      className={`inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-wider border ${
        isSigma ? 'border-purple-400/50' : 'border-white/20'
      } ${sizeClasses[size]} ${className}`}
      style={{
        background: rankData.gradient,
        boxShadow: isSigma 
          ? `0 0 30px ${rankData.glowColor}, 0 0 60px ${rankData.glowColor}` 
          : `0 0 20px ${rankData.glowColor}`,
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
          ? `0 0 40px ${rankData.glowColor}, 0 0 80px ${rankData.glowColor}` 
          : `0 0 30px ${rankData.glowColor}`,
      }}
    >
      <motion.span 
        className={`${emojiSizes[size]} ${isSigma ? 'filter drop-shadow-lg' : ''}`}
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
      <span className={`drop-shadow-lg ${isSigma ? 'text-white font-extrabold' : 'text-white'}`}>
        {rankData.displayName}
      </span>
      {isSigma && (
        <motion.div
          className="w-1 h-1 bg-yellow-400 rounded-full"
          animate={{
            scale: [1, 2, 1],
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