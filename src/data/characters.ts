import { Character } from "@/types/character";
import cyberWarrior from "@/assets/characters/cyber-warrior-transparent.png";
import mysticMage from "@/assets/characters/mystic-mage-transparent.png";
import animeCharacter from "@/assets/characters/anime-character.png";

export const characters: Character[] = [
  {
    id: "anime-hero",
    name: "Anime Hero",
    avatar: animeCharacter,
    description: "Cheerful and brave hero ready for any challenge",
    rarity: "legendary",
    unlocked: true,
  },
  {
    id: "cyber-warrior",
    name: "Cyber Warrior",
    avatar: cyberWarrior,
    description: "A futuristic fighter with enhanced cybernetic abilities",
    rarity: "epic",
    unlocked: true,
  },
  {
    id: "mystic-mage",
    name: "Mystic Mage",
    avatar: mysticMage,
    description: "Master of ancient magical arts and mystical knowledge",
    rarity: "rare",
    unlocked: true,
  },
];

export const getCharacterById = (id: string): Character | undefined => {
  return characters.find(character => character.id === id);
};