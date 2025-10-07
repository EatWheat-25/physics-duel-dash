import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Character, CharacterContextType } from '@/types/character';

// Import dynamically to avoid circular dependencies
const CharacterContext = createContext<CharacterContextType | undefined>(undefined);

export const CharacterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Lazy load characters to avoid import issues
  const [charactersData] = useState<Character[]>(() => {
    const blueRobot = '/src/assets/characters/blue-robot-animated.mp4';
    const cyberWarrior = '/src/assets/characters/cyber-warrior-transparent.png';
    const mysticMage = '/src/assets/characters/mystic-mage-transparent.png';
    
    return [
      {
        id: "robo-genius",
        name: "Robo Genius",
        avatar: blueRobot,
        description: "Advanced AI companion built for mathematical warfare and tactical dominance",
        rarity: "legendary" as const,
        unlocked: true,
      },
      {
        id: "cyber-warrior",
        name: "Cyber Warrior",
        avatar: cyberWarrior,
        description: "A futuristic fighter with enhanced cybernetic abilities",
        rarity: "epic" as const,
        unlocked: true,
      },
      {
        id: "mystic-mage",
        name: "Mystic Mage",
        avatar: mysticMage,
        description: "Master of ancient magical arts and mystical knowledge",
        rarity: "rare" as const,
        unlocked: true,
      },
    ];
  });
  
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(charactersData[0]);
  const [isCharacterSelectionOpen, setCharacterSelectionOpen] = useState(false);

  const selectCharacter = (characterId: string) => {
    const character = charactersData.find(c => c.id === characterId);
    if (character && character.unlocked) {
      setSelectedCharacter(character);
    }
  };

  return (
    <CharacterContext.Provider value={{
      selectedCharacter,
      characters: charactersData,
      selectCharacter,
      isCharacterSelectionOpen,
      setCharacterSelectionOpen,
    }}>
      {children}
    </CharacterContext.Provider>
  );
};

export const useCharacter = (): CharacterContextType => {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return context;
};