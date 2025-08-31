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
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Rank Progress</span>
        <span className="font-semibold">
          {currentPoints} / {nextRank ? currentRank.maxPoints + 1 : 'MAX'}
        </span>
      </div>
      
      <div className="relative w-full bg-white/10 rounded-full h-4 overflow-hidden border border-white/20">
        <motion.div
          className="h-full"
          style={{
            background: currentRank.gradient,
            boxShadow: `inset 0 0 20px ${currentRank.glowColor}`,
          }}
          initial={{ width: showAnimation ? 0 : `${progress}%` }}
          animate={{ width: `${progress}%` }}
          transition={{ 
            duration: showAnimation ? 1.5 : 0,
            delay: showAnimation ? 0.3 : 0,
            ease: "easeOut" 
          }}
        />
        
        {/* Animated shine effect */}
        <motion.div
          className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{
            x: [-32, 320],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: "easeInOut"
          }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{currentRank.displayName}</span>
        {nextRank && <span>{nextRank.displayName}</span>}
      </div>
      
      <div className="text-center">
        <motion.div 
          className="text-xs font-semibold"
          style={{ color: currentRank.color }}
          animate={showAnimation ? {
            scale: [1, 1.1, 1],
            textShadow: [`0 0 0px ${currentRank.color}`, `0 0 10px ${currentRank.color}`, `0 0 0px ${currentRank.color}`]
          } : {}}
          transition={{ duration: 1, delay: 1.8 }}
        >
          {progress.toFixed(1)}% to next rank
        </motion.div>
      </div>
    </div>
  );
};

export default RankProgressBar;