import React from 'react';
import { motion } from 'framer-motion';
import { Character } from '@/types/character';
import { Sparkles, Star } from 'lucide-react';

interface CharacterShowcaseProps {
  character: Character | null;
  onCharacterClick: () => void;
}

const CharacterShowcase: React.FC<CharacterShowcaseProps> = ({ character, onCharacterClick }) => {
  if (!character) return null;

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'shadow-[0_0_30px_rgba(156,163,175,0.5)]';
      case 'rare': return 'shadow-[0_0_30px_rgba(59,130,246,0.5)]';
      case 'epic': return 'shadow-[0_0_30px_rgba(147,51,234,0.5)]';
      case 'legendary': return 'shadow-[0_0_30px_rgba(249,115,22,0.5)]';
      default: return 'shadow-[0_0_30px_rgba(156,163,175,0.5)]';
    }
  };

  const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-400';
      case 'rare': return 'border-blue-400';
      case 'epic': return 'border-purple-400';
      case 'legendary': return 'border-orange-400';
      default: return 'border-gray-400';
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="relative">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent rounded-2xl" />
        
        {/* Character Display */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          {/* Floating Animation */}
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              rotateY: [0, 5, 0, -5, 0]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative cursor-pointer"
            onClick={onCharacterClick}
          >
            {/* Character Image */}
            <div className={`relative w-80 h-80 rounded-2xl border-4 ${getRarityBorder(character.rarity)} ${getRarityGlow(character.rarity)} overflow-hidden bg-gradient-to-b from-secondary/20 to-background/40 backdrop-blur-sm`}>
              <img
                src={character.avatar}
                alt={character.name}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay Effects */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              
              {/* Rarity Particles */}
              {character.rarity === 'legendary' && (
                <>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.8, 0.3]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute top-4 right-4"
                  >
                    <Sparkles className="w-6 h-6 text-orange-400" />
                  </motion.div>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.8, 0.3]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1
                    }}
                    className="absolute bottom-4 left-4"
                  >
                    <Star className="w-5 h-5 text-orange-400" />
                  </motion.div>
                </>
              )}
            </div>

            {/* Character Info */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">{character.name}</h2>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  character.rarity === 'legendary' ? 'bg-orange-500/20 text-orange-400 border border-orange-400/30' :
                  character.rarity === 'epic' ? 'bg-purple-500/20 text-purple-400 border border-purple-400/30' :
                  character.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30' :
                  'bg-gray-500/20 text-gray-400 border border-gray-400/30'
                }`}>
                  {character.rarity}
                </span>
              </div>
              <p className="text-muted-foreground text-sm max-w-xs">{character.description}</p>
            </motion.div>
          </motion.div>

          {/* Click Hint */}
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -bottom-24 left-1/2 transform -translate-x-1/2 text-center"
          >
            <p className="text-xs text-muted-foreground">Click to change character</p>
          </motion.div>
        </motion.div>

        {/* Ambient Background Effects */}
        <div className="absolute inset-0 -z-10">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="w-96 h-96 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 rounded-full blur-3xl"
          />
        </div>
      </div>
    </div>
  );
};

export default CharacterShowcase;