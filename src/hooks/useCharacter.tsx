import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Character, CharacterContextType } from '@/types/character';
import { characters } from '@/data/characters';

const CharacterContext = createContext<CharacterContextType | undefined>(undefined);

export const CharacterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(characters[0]);
  const [isCharacterSelectionOpen, setCharacterSelectionOpen] = useState(false);

  const selectCharacter = (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (character && character.unlocked) {
      setSelectedCharacter(character);
    }
  };

  return (
    <CharacterContext.Provider value={{
      selectedCharacter,
      characters,
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