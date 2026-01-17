export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Ruby';
export type SubRank = 1 | 2 | 3;

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
  outcome: 'win' | 'loss' | 'draw';
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
    maxPoints: 100,
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
    minPoints: 101,
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
    maxPoints: 450,
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
    minPoints: 451,
    maxPoints: 600,
    emoji: '🟪',
    imageUrl: '/ranks/platinum.png',
    color: 'hsl(270 90% 70%)',
    gradient: 'linear-gradient(135deg, hsl(270 90% 70%), hsl(280 90% 80%))',
    glowColor: 'hsl(270 90% 70% / 0.45)',
    displayName: 'Platinum I',
  },
  {
    tier: 'Platinum',
    subRank: 2,
    minPoints: 601,
    maxPoints: 800,
    emoji: '🟪',
    imageUrl: '/ranks/platinum.png',
    color: 'hsl(270 90% 70%)',
    gradient: 'linear-gradient(135deg, hsl(270 90% 70%), hsl(280 90% 80%))',
    glowColor: 'hsl(270 90% 70% / 0.45)',
    displayName: 'Platinum II',
  },
  {
    tier: 'Diamond',
    subRank: 1,
    minPoints: 801,
    maxPoints: 1000,
    emoji: '💎',
    imageUrl: '/ranks/diamond.png',
    color: 'hsl(180 100% 70%)',
    gradient: 'linear-gradient(135deg, hsl(180 100% 70%), hsl(180 100% 80%))',
    glowColor: 'hsl(180 100% 70% / 0.4)',
    displayName: 'Diamond I',
  },
  {
    tier: 'Diamond',
    subRank: 2,
    minPoints: 1001,
    maxPoints: 1250,
    emoji: '💎',
    imageUrl: '/ranks/diamond.png',
    color: 'hsl(180 100% 70%)',
    gradient: 'linear-gradient(135deg, hsl(180 100% 70%), hsl(180 100% 80%))',
    glowColor: 'hsl(180 100% 70% / 0.4)',
    displayName: 'Diamond II',
  },
  {
    tier: 'Ruby',
    subRank: 1,
    minPoints: 1251,
    maxPoints: 1500,
    emoji: '♦️',
    imageUrl: '/ranks/ruby.png',
    color: 'hsl(350 85% 60%)',
    gradient: 'linear-gradient(135deg, hsl(350 85% 60%), hsl(0 80% 65%))',
    glowColor: 'hsl(350 85% 60% / 0.5)',
    displayName: 'Ruby I',
  },
  {
    tier: 'Ruby',
    subRank: 2,
    minPoints: 1501,
    maxPoints: 1750,
    emoji: '♦️',
    imageUrl: '/ranks/ruby.png',
    color: 'hsl(350 85% 60%)',
    gradient: 'linear-gradient(135deg, hsl(350 85% 60%), hsl(0 80% 65%))',
    glowColor: 'hsl(350 85% 60% / 0.5)',
    displayName: 'Ruby II',
  },
  {
    tier: 'Ruby',
    subRank: 3,
    minPoints: 1751,
    maxPoints: 2000,
    emoji: '♦️',
    imageUrl: '/ranks/ruby.png',
    color: 'hsl(350 85% 60%)',
    gradient: 'linear-gradient(135deg, hsl(350 85% 60%), hsl(0 80% 65%))',
    glowColor: 'hsl(350 85% 60% / 0.5)',
    displayName: 'Ruby III',
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

export const getNextRank = (currentRank: Rank): Rank | null => {
  const currentIndex = RANKS.findIndex(rank => 
    rank.tier === currentRank.tier && rank.subRank === currentRank.subRank
  );
  return currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
};

export const rankNameToString = (rank: RankName): string => {
  const match = RANKS.find(r => r.tier === rank.tier && r.subRank === rank.subRank);
  return match?.displayName ?? `${rank.tier} ${rank.subRank}`;
};

export type MatchOutcome = 'win' | 'loss' | 'draw';

const clampInt = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const roundAccuracyToEven = (accuracy: number): number => {
  const pct = accuracy <= 1 ? accuracy * 100 : accuracy;
  const floored = Math.floor(pct);
  const clamped = clampInt(floored, 0, 100);
  return clamped - (clamped % 2);
};

export const getRankPointsDelta = (outcome: MatchOutcome, accuracy: number): number => {
  const a = roundAccuracyToEven(accuracy);

  if (outcome === 'draw') {
    return 5;
  }

  if (outcome === 'win') {
    if (a < 50) return 5;
    if (a < 60) return 5 + Math.floor((a - 50) / 2);
    if (a < 70) return 10 + Math.floor((a - 60) / 2);
    if (a < 80) return 15 + Math.floor((a - 70) / 2);
    if (a < 90) return 20 + Math.floor((a - 80) / 2);
    return 25 + Math.floor((a - 90) / 2);
  }

  if (a < 50) return -20;
  if (a < 60) return -15 + Math.floor((a - 50) / 2);
  if (a < 70) return -10 + Math.floor((a - 60) / 2);
  if (a < 80) return -5 + Math.floor((a - 70) / 2);
  if (a < 90) return Math.floor((a - 80) / 2);
  return 5 + Math.floor((a - 90) / 2);
};

export const getPointsForWin = (): number => {
  return 25;
};

export const getPointsForLoss = (): number => {
  return -20;
};