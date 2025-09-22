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
      <div className="relative">
        <div className="relative cursor-pointer" onClick={onCharacterClick}>
          <div className="relative w-80 h-96 flex items-end justify-center">
            <img 
              src={character.avatar} 
              alt={character.name} 
              className="max-w-full max-h-full object-contain filter drop-shadow-2xl transition-all duration-300" 
              style={{
                filter: `drop-shadow(0 0 30px hsl(188, 100%, 42%, 0.3)) drop-shadow(0 0 60px hsl(193, 100%, 50%, 0.2))`
              }}
            />
            {/* Holographic ground reflection */}
            <div 
              className="absolute bottom-0 w-full h-8 rounded-full opacity-30"
              style={{
                background: `radial-gradient(ellipse 60% 100% at center, hsl(188, 100%, 42%, 0.2), transparent)`,
                filter: 'blur(8px)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
export default FortniteStyleShowcase;