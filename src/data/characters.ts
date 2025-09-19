import { Character } from "@/types/character";
import cyberWarrior from "@/assets/characters/cyber-warrior-transparent.png";
import mysticMage from "@/assets/characters/mystic-mage-transparent.png";
import techNinja from "@/assets/characters/tech-ninja-transparent.png";

export const characters: Character[] = [
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
  {
    id: "tech-ninja",
    name: "Tech Ninja",
    avatar: techNinja,
    description: "Silent assassin with cutting-edge technology",
    rarity: "legendary",
    unlocked: true,
  },
];

export const getCharacterById = (id: string): Character | undefined => {
  return characters.find(character => character.id === id);
};