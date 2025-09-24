import React from 'react';
import { motion } from 'framer-motion';
import { Character } from '@/types/character';
import { Sparkles, Star, Zap } from 'lucide-react';
interface FortniteStyleShowcaseProps {
  character: Character | null;
  onCharacterClick: () => void;
}
const FortniteStyleShowcase: React.FC<FortniteStyleShowcaseProps> = ({
  character,
  onCharacterClick
}) => {
  if (!character) return null;
  const getRarityEffects = (rarity: string) => {
    return {
      primaryColor: '#0891b2',
      secondaryColor: '#06b6d4',
      glowColor: 'rgba(8, 145, 178, 0.3)',
      particles: null
    };
  };
  const effects = getRarityEffects(character.rarity);
  return (
    <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
      {/* Holographic Showcase Arena */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative"
      >
        {/* Character Platform */}
        <motion.div
          className="relative cursor-pointer group"
          onClick={onCharacterClick}
        >
          {/* Character Display with Ultra Glow */}
          <div className="relative w-96 h-[500px] flex items-end justify-center">
            <motion.img 
              src={character.avatar} 
              alt={character.name} 
              className="max-w-full max-h-full object-contain transition-all duration-500 group-hover:scale-110" 
              style={{
                filter: 'var(--glow-robot)',
                transform: 'perspective(1000px)'
              }}
              animate={{
                y: [0, -10, 0],
                rotateX: [0, 2, 0]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Advanced Holographic Base */}
            <motion.div 
              className="absolute bottom-0 w-full h-12"
              style={{
                background: `
                  radial-gradient(ellipse 80% 100% at center, hsl(180, 100%, 50%, 0.3), transparent 70%),
                  radial-gradient(ellipse 60% 100% at center, hsl(280, 100%, 70%, 0.2), transparent 60%),
                  radial-gradient(ellipse 40% 100% at center, hsl(320, 100%, 60%, 0.15), transparent 50%)
                `,
                filter: 'blur(10px)'
              }}
              animate={{
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Holographic Grid Base */}
            <motion.div
              className="absolute bottom-0 w-80 h-2 rounded-full overflow-hidden"
              style={{
                background: 'linear-gradient(90deg, transparent, hsl(180, 100%, 50%, 0.4), hsl(280, 100%, 70%, 0.3), hsl(320, 100%, 60%, 0.2), transparent)',
                boxShadow: '0 0 20px hsl(180, 100%, 50%, 0.3)'
              }}
            >
              <motion.div
                className="w-full h-full bg-gradient-to-r from-transparent via-primary to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
          
          
        </motion.div>
        
        {/* Character Info Panel */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 cyber-panel p-4 min-w-[300px]"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold futuristic-heading mb-2">{character.name}</h2>
            <div className="flex items-center justify-center gap-2 mb-3">
              <motion.div
                className="px-4 py-1 rounded-full text-xs font-bold uppercase border"
                style={{
                  background: 'var(--gradient-primary)',
                  borderColor: 'hsl(180, 100%, 50%, 0.4)',
                  color: 'hsl(220, 30%, 2%)'
                }}
                animate={{ boxShadow: ['0 0 10px hsl(180, 100%, 50%, 0.3)', '0 0 20px hsl(180, 100%, 50%, 0.6)', '0 0 10px hsl(180, 100%, 50%, 0.3)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {character.rarity}
              </motion.div>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">{character.description}</p>
          </div>
        </motion.div>
        
        {/* Interactive Hint */}
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute -bottom-32 left-1/2 transform -translate-x-1/2 text-center"
        >
          <p className="text-xs text-primary font-medium uppercase tracking-wider">
            ◦ CLICK TO MODIFY AGENT ◦
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};
export default FortniteStyleShowcase;