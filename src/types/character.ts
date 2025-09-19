export interface Character {
  id: string;
  name: string;
  avatar: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
}

export interface CharacterContextType {
  selectedCharacter: Character | null;
  characters: Character[];
  selectCharacter: (characterId: string) => void;
  isCharacterSelectionOpen: boolean;
  setCharacterSelectionOpen: (open: boolean) => void;
}