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
  return <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
      <div className="relative">
        <div className="relative cursor-pointer" onClick={onCharacterClick}>
          <div className="relative w-80 h-96 flex items-end justify-center">
            <img 
              src={character.avatar} 
              alt={character.name} 
              className="max-w-full max-h-full object-contain filter drop-shadow-2xl" 
            />
          </div>
        </div>
      </div>
    </div>;
};
export default FortniteStyleShowcase;