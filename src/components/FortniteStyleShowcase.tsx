import React from 'react';
import { Character } from '@/types/character';

interface FortniteStyleShowcaseProps {
  character: Character | null;
  onCharacterClick: () => void;
}

const FortniteStyleShowcase: React.FC<FortniteStyleShowcaseProps> = ({
  character,
  onCharacterClick
}) => {
  if (!character) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-8 cursor-pointer" onClick={onCharacterClick}>
      <div className="relative" style={{ width: '25vw', height: '35vh', minWidth: '300px', minHeight: '400px' }}>
        {character.avatar.endsWith('.mp4') ? (
          <video 
            src={character.avatar} 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <img 
            src={character.avatar} 
            alt={character.name} 
            className="w-full h-full object-contain"
          />
        )}
      </div>
    </div>
  );
};

export default FortniteStyleShowcase;