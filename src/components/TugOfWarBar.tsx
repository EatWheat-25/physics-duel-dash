import React from 'react';
import { motion } from 'framer-motion';

interface TugOfWarBarProps {
  position: number; // -4 to 4, where 0 is center
  maxSteps: number;
}

const TugOfWarBar: React.FC<TugOfWarBarProps> = ({ position, maxSteps }) => {
  // Convert position to percentage (0-100%), where 50% is center
  const playerPercentage = ((position + maxSteps) / (maxSteps * 2)) * 100;
  const opponentPercentage = 100 - playerPercentage;
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between text-sm mb-3 px-4">
        <span className="text-red-500 font-bold">OPPONENT</span>
        <span className="text-emerald-500 font-bold">YOU</span>
      </div>
      
      <div className="relative w-full h-8 rounded-full overflow-hidden border-2 border-white/20 bg-black/20">
        {/* Player (green) section - left side */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-l-full"
          style={{
            background: 'linear-gradient(90deg, rgb(16, 185, 129), rgb(5, 150, 105))',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
          }}
          animate={{ 
            width: `${playerPercentage}%`,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 150, 
            damping: 20,
            mass: 0.8
          }}
        />
        
        {/* Opponent (red) section - right side */}
        <motion.div
          className="absolute top-0 right-0 h-full rounded-r-full"
          style={{
            background: 'linear-gradient(270deg, rgb(239, 68, 68), rgb(220, 38, 38))',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
          }}
          animate={{ 
            width: `${opponentPercentage}%`,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 150, 
            damping: 20,
            mass: 0.8
          }}
        />
        
        {/* Center dividing line - glows when near center */}
        <motion.div
          className="absolute top-0 h-full w-1 bg-white/80"
          style={{
            boxShadow: Math.abs(position) <= 1 ? '0 0 15px white' : '0 0 5px white',
          }}
          animate={{ 
            left: `${playerPercentage}%`,
            transform: 'translateX(-50%)',
          }}
          transition={{ 
            type: "spring", 
            stiffness: 150, 
            damping: 20,
            mass: 0.8
          }}
        />
        
        {/* Step markers for visual reference */}
        {Array.from({ length: maxSteps * 2 - 1 }, (_, i) => {
          const stepPosition = ((i + 1) / (maxSteps * 2)) * 100;
          const isNearCenter = Math.abs(stepPosition - 50) <= 25;
          
          return (
            <div
              key={i}
              className={`absolute top-1 w-0.5 h-6 transition-opacity duration-300 ${
                isNearCenter ? 'bg-white/40' : 'bg-white/20'
              }`}
              style={{ left: `${stepPosition}%` }}
            />
          );
        })}
      </div>
      
      {/* Win zones */}
      <div className="flex justify-between text-xs mt-3 px-2">
        <motion.div 
          className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-300 ${
            position <= -maxSteps 
              ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]' 
              : 'text-muted-foreground bg-white/5'
          }`}
          animate={{
            scale: position <= -maxSteps ? 1.1 : 1,
          }}
        >
          DEFEAT
        </motion.div>
        <motion.div 
          className={`px-3 py-1.5 rounded-lg font-bold transition-all duration-300 ${
            position >= maxSteps 
              ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.6)]' 
              : 'text-muted-foreground bg-white/5'
          }`}
          animate={{
            scale: position >= maxSteps ? 1.1 : 1,
          }}
        >
          VICTORY
        </motion.div>
      </div>
    </div>
  );
};

export default TugOfWarBar;