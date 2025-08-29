import React from 'react';
import { motion } from 'framer-motion';

interface TugOfWarBarProps {
  position: number; // -4 to 4, where 0 is center
  maxSteps: number;
}

const TugOfWarBar: React.FC<TugOfWarBarProps> = ({ position, maxSteps }) => {
  // Convert position to percentage (0-100%)
  const percentage = ((position + maxSteps) / (maxSteps * 2)) * 100;
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between text-sm mb-2 px-4">
        <span className="text-battle-danger font-bold">OPPONENT</span>
        <span className="text-battle-success font-bold">YOU</span>
      </div>
      
      <div className="tug-bar relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/50 transform -translate-x-0.5" />
        
        {/* Progress indicator */}
        <motion.div
          className="tug-indicator"
          style={{ 
            left: `${Math.max(0, percentage - 2)}%`,
            width: '4%',
          }}
          animate={{ 
            left: `${Math.max(0, percentage - 2)}%`,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 25 
          }}
        />
        
        {/* Step markers */}
        {Array.from({ length: maxSteps * 2 - 1 }, (_, i) => {
          const stepPosition = ((i + 1) / (maxSteps * 2)) * 100;
          const isActive = i < maxSteps ? percentage < stepPosition : percentage > stepPosition;
          
          return (
            <div
              key={i}
              className={`absolute top-0 w-0.5 h-full transition-opacity duration-300 ${
                isActive ? 'bg-white/30' : 'bg-white/10'
              }`}
              style={{ left: `${stepPosition}%` }}
            />
          );
        })}
      </div>
      
      {/* Win zones */}
      <div className="flex justify-between text-xs mt-2 px-2">
        <div className={`px-2 py-1 rounded ${position <= -maxSteps ? 'bg-battle-danger text-white' : 'text-muted-foreground'}`}>
          DEFEAT
        </div>
        <div className={`px-2 py-1 rounded ${position >= maxSteps ? 'bg-battle-success text-white' : 'text-muted-foreground'}`}>
          VICTORY
        </div>
      </div>
    </div>
  );
};

export default TugOfWarBar;