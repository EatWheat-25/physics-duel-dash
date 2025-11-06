import React from 'react';
import { motion } from 'framer-motion';
import { Character } from '@/types/character';

interface CharacterAvatarProps {
  character: Character | null;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  onClick?: () => void;
}

const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ 
  character, 
  size = 'md', 
  animated = true,
  onClick 
}) => {
  if (!character) return null;

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  };

  const isVideo = character.avatar.endsWith('.mp4');
  
  const avatarContent = (
    <div className={`${sizeClasses[size]} relative ${onClick ? 'cursor-pointer' : ''}`}>
      {isVideo ? (
        <video
          src={character.avatar}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <img
          src={character.avatar}
          alt={character.name}
          className="w-full h-full object-cover rounded-full"
        />
      )}
    </div>
  );

  if (animated) {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="flex flex-col items-center space-y-2"
      >
        {avatarContent}
        <span className="text-xs font-medium text-center text-white">{character.name}</span>
      </motion.div>
    );
  }

  return (
    <div onClick={onClick} className="flex flex-col items-center space-y-2">
      {avatarContent}
      <span className="text-xs font-medium text-center text-white">{character.name}</span>
    </div>
  );
};

export default CharacterAvatar;