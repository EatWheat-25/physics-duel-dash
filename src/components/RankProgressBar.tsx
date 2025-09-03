import React from 'react';
import { motion } from 'framer-motion';
import { getRankProgress, getRankByPoints, getNextRank } from '@/types/ranking';

interface RankProgressBarProps {
  currentPoints: number;
  showAnimation?: boolean;
}

const RankProgressBar: React.FC<RankProgressBarProps> = ({ currentPoints, showAnimation = false }) => {
  const progress = getRankProgress(currentPoints);
  const currentRank = getRankByPoints(currentPoints);
  const nextRank = getNextRank(currentRank);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground font-medium">Rank Progress</span>
        <span className="font-bold" style={{
          background: 'var(--gradient-cyber)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {currentPoints} / {nextRank ? currentRank.maxPoints + 1 : 'MAX'}
        </span>
      </div>
      
      <div className="cyber-progress">
        <motion.div
          className="cyber-progress-fill"
          style={{
            background: currentRank.gradient,
          }}
          initial={{ width: showAnimation ? 0 : `${progress}%` }}
          animate={{ width: `${progress}%` }}
          transition={{ 
            duration: showAnimation ? 1.5 : 0,
            delay: showAnimation ? 0.3 : 0,
            ease: "easeOut" 
          }}
        />
        
        {/* Enhanced shine effect */}
        <motion.div
          className="absolute top-0 left-0 h-full w-12 opacity-60"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.6), transparent)',
          }}
          animate={{
            x: [-48, 320],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatDelay: 4,
            ease: "easeInOut"
          }}
        />
      </div>
      
      <div className="flex justify-between text-xs font-medium">
        <span style={{ color: currentRank.color }}>{currentRank.displayName}</span>
        {nextRank && <span className="text-muted-foreground">{nextRank.displayName}</span>}
      </div>
      
      <div className="text-center">
        <motion.div 
          className="text-xs font-bold tracking-wider"
          style={{ 
            color: currentRank.color,
            textShadow: `0 0 10px ${currentRank.color}40`
          }}
          animate={showAnimation ? {
            scale: [1, 1.05, 1],
            textShadow: [
              `0 0 0px ${currentRank.color}40`, 
              `0 0 15px ${currentRank.color}80`, 
              `0 0 5px ${currentRank.color}40`
            ]
          } : {}}
          transition={{ duration: 1.2, delay: 1.8 }}
        >
          {progress.toFixed(1)}% TO NEXT RANK
        </motion.div>
      </div>
    </div>
  );
};

export default RankProgressBar;