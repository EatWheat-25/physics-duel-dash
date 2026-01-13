// Ranked ladder tiers (season 1): capped at 1500 points.
export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Ruby';
// Keep SubRank for backward compatibility across UI components, but we no longer use sub-ranks.
export type SubRank = 1;

export interface RankName {
  tier: RankTier;
  subRank: SubRank;
}

export interface Rank {
  tier: RankTier;
  subRank: SubRank;
  minPoints: number;
  maxPoints: number;
  emoji: string;
  imageUrl?: string; // Optional custom image for rank logo
  color: string;
  gradient: string;
  glowColor: string;
  displayName: string;
}

export interface RankHistory {
  id: string;
  date: Date;
  outcome: 'win' | 'loss';
  pointsChange: number;
  previousRank: RankName;
  newRank: RankName;
  opponentRank?: RankName;
}

export interface UserRankData {
  username: string;
  currentPoints: number;
  currentRank: RankName;
  winStreak: number;
  totalMatches: number;
  wins: number;
  losses: number;
  accuracy: number;
  history: RankHistory[];
  avatar?: string;
}

export const RANKS: Rank[] = [
  {
    tier: 'Bronze',
    subRank: 1,
    minPoints: 0,
    maxPoints: 99,
    emoji: '🥉',
    imageUrl: '/ranks/bronze.png',
    color: 'hsl(30 50% 50%)',
    gradient: 'linear-gradient(135deg, hsl(30 50% 50%), hsl(30 60% 60%))',
    glowColor: 'hsl(30 50% 50% / 0.4)',
    displayName: 'Bronze',
  },
  {
    tier: 'Silver',
    subRank: 1,
    minPoints: 100,
    maxPoints: 249,
    emoji: '🥈',
    imageUrl: '/ranks/silver.png',
    color: 'hsl(0 0% 70%)',
    gradient: 'linear-gradient(135deg, hsl(0 0% 70%), hsl(0 0% 80%))',
    glowColor: 'hsl(0 0% 70% / 0.4)',
    displayName: 'Silver',
  },
  {
    tier: 'Gold',
    subRank: 1,
    minPoints: 250,
    maxPoints: 449,
    emoji: '🥇',
    imageUrl: '/ranks/gold.png',
    color: 'hsl(45 100% 60%)',
    gradient: 'linear-gradient(135deg, hsl(45 100% 60%), hsl(45 100% 70%))',
    glowColor: 'hsl(45 100% 60% / 0.4)',
    displayName: 'Gold',
  },
  {
    tier: 'Platinum',
    subRank: 1,
    minPoints: 450,
    maxPoints: 799,
    emoji: '🟪',
    imageUrl: '/ranks/platinum.png',
    color: 'hsl(270 80% 75%)',
    gradient: 'linear-gradient(135deg, hsl(270 80% 70%), hsl(280 90% 85%))',
    glowColor: 'hsl(280 90% 75% / 0.45)',
    displayName: 'Platinum',
  },
  {
    tier: 'Diamond',
    subRank: 1,
    minPoints: 800,
    maxPoints: 1299,
    emoji: '💎',
    imageUrl: '/ranks/diamond.png',
    color: 'hsl(195 100% 75%)',
    gradient: 'linear-gradient(135deg, hsl(195 100% 70%), hsl(210 100% 85%))',
    glowColor: 'hsl(195 100% 75% / 0.45)',
    displayName: 'Diamond',
  },
  {
    tier: 'Ruby',
    subRank: 1,
    minPoints: 1300,
    maxPoints: 1500,
    emoji: '♦',
    imageUrl: '/ranks/ruby.png',
    color: 'hsl(0 90% 65%)',
    gradient: 'linear-gradient(135deg, hsl(0 90% 60%), hsl(15 95% 70%))',
    glowColor: 'hsl(0 90% 65% / 0.5)',
    displayName: 'Ruby',
  },
];

export const getRankByPoints = (points: number): Rank => {
  return RANKS.find(rank => points >= rank.minPoints && points <= rank.maxPoints) || RANKS[0];
};

export const getRankProgress = (points: number): number => {
  const rank = getRankByPoints(points);
  const progress = ((points - rank.minPoints) / (rank.maxPoints - rank.minPoints)) * 100;
  return Math.min(Math.max(progress, 0), 100);
};

export const getPointsForWin = (): number => {
  return 25; // Fixed 25 XP for win
};

export const getPointsForLoss = (): number => {
  return -20; // Fixed -20 XP for loss
};

export const getNextRank = (currentRank: Rank): Rank | null => {
  const currentIndex = RANKS.findIndex(rank => rank.tier === currentRank.tier);
  return currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
};

export const rankNameToString = (rank: RankName): string => {
  return `${rank.tier}`;
};