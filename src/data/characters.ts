import { Character } from "@/types/character";
import blueRobot from "@/assets/characters/blue-robot-animated.mp4";
import cyberWarrior from "@/assets/characters/cyber-warrior-transparent.png";
import mysticMage from "@/assets/characters/mystic-mage-transparent.png";

export const characters: Character[] = [
  {
    id: "robo-genius",
    name: "Robo Genius",
    avatar: blueRobot,
    description: "Advanced AI companion built for mathematical warfare and tactical dominance",
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