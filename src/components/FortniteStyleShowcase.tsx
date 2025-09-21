import React from 'react';
import { motion } from 'framer-motion';
import { Character } from '@/types/character';
import { Sparkles, Star, Zap } from 'lucide-react';

interface FortniteStyleShowcaseProps {
  character: Character | null;
  onCharacterClick: () => void;
}

const FortniteStyleShowcase: React.FC<FortniteStyleShowcaseProps> = ({ character, onCharacterClick }) => {
  if (!character) return null;

  const getRarityEffects = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return {
          primaryColor: '#ff6b35',
          secondaryColor: '#f7931e',
          glowColor: 'rgba(255, 107, 53, 0.6)',
          particles: <Sparkles className="w-4 h-4" style={{ color: '#ff6b35' }} />
        };
      case 'epic':
        return {
          primaryColor: '#9333ea',
          secondaryColor: '#c084fc',
          glowColor: 'rgba(147, 51, 234, 0.6)',
          particles: <Star className="w-4 h-4" style={{ color: '#9333ea' }} />
        };
      case 'rare':
        return {
          primaryColor: '#3b82f6',
          secondaryColor: '#60a5fa',
          glowColor: 'rgba(59, 130, 246, 0.6)',
          particles: <Zap className="w-4 h-4" style={{ color: '#3b82f6' }} />
        };
      default:
        return {
          primaryColor: '#6b7280',
          secondaryColor: '#9ca3af',
          glowColor: 'rgba(107, 114, 128, 0.6)',
          particles: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#6b7280' }} />
        };
    }
  };

  const effects = getRarityEffects(character.rarity);

  return (
    <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
      {/* Background Environment */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-transparent to-green-400/10" />
      

      <div className="relative">
        {/* Character Platform/Pedestal */}
        <motion.div
          animate={{ rotateY: [0, 5, 0, -5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          {/* Platform Base */}
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-48 h-8 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent backdrop-blur-sm border border-white/30" />
          
          {/* Character Container */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative cursor-pointer"
            onClick={onCharacterClick}
          >
            {/* Breathing Animation */}
            <motion.div
              animate={{ 
                y: [0, -8, 0],
                scale: [1, 1.02, 1]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative"
            >
              {/* Character Glow Effect */}
              <div 
                className="absolute inset-0 rounded-lg blur-xl opacity-50"
                style={{ 
                  background: `radial-gradient(ellipse at center, ${effects.glowColor}, transparent 70%)`,
                  transform: 'translateY(10px) scaleY(0.3)'
                }}
              />
              
              {/* Character Image */}
              <div className="relative w-80 h-96 flex items-end justify-center">
                <motion.img
                  src={character.avatar}
                  alt={character.name}
                  className="max-w-full max-h-full object-contain filter drop-shadow-2xl"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                />
                
                {/* Rarity Border Effect */}
                <div 
                  className="absolute inset-0 rounded-lg opacity-30 pointer-events-none"
                  style={{ 
                    background: `linear-gradient(45deg, transparent, ${effects.primaryColor}30, transparent)`,
                    filter: 'blur(1px)'
                  }}
                />
              </div>

            </motion.div>

          </motion.div>

        </motion.div>

        {/* Ambient Lighting Effects */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ 
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 6, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="w-96 h-96 rounded-full blur-3xl"
            style={{ 
              background: `radial-gradient(circle, ${effects.primaryColor}20, ${effects.secondaryColor}10, transparent)`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FortniteStyleShowcase;