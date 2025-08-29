export type RankName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster' | 'Legendary';

export interface Rank {
  name: RankName;
  minPoints: number;
  maxPoints: number;
  emoji: string;
  color: string;
  gradient: string;
  glowColor: string;
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

export const RANKS: Record<RankName, Rank> = {
  Bronze: {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 499,
    emoji: '🥉',
    color: 'hsl(30 50% 50%)',
    gradient: 'linear-gradient(135deg, hsl(30 50% 50%), hsl(30 60% 60%))',
    glowColor: 'hsl(30 50% 50% / 0.4)',
  },
  Silver: {
    name: 'Silver',
    minPoints: 500,
    maxPoints: 999,
    emoji: '🥈',
    color: 'hsl(0 0% 70%)',
    gradient: 'linear-gradient(135deg, hsl(0 0% 70%), hsl(0 0% 80%))',
    glowColor: 'hsl(0 0% 70% / 0.4)',
  },
  Gold: {
    name: 'Gold',
    minPoints: 1000,
    maxPoints: 1699,
    emoji: '🥇',
    color: 'hsl(45 100% 60%)',
    gradient: 'linear-gradient(135deg, hsl(45 100% 60%), hsl(45 100% 70%))',
    glowColor: 'hsl(45 100% 60% / 0.4)',
  },
  Platinum: {
    name: 'Platinum',
    minPoints: 1700,
    maxPoints: 2499,
    emoji: '💠',
    color: 'hsl(200 80% 60%)',
    gradient: 'linear-gradient(135deg, hsl(200 80% 60%), hsl(200 90% 70%))',
    glowColor: 'hsl(200 80% 60% / 0.4)',
  },
  Diamond: {
    name: 'Diamond',
    minPoints: 2500,
    maxPoints: 3499,
    emoji: '💎',
    color: 'hsl(180 100% 70%)',
    gradient: 'linear-gradient(135deg, hsl(180 100% 70%), hsl(180 100% 80%))',
    glowColor: 'hsl(180 100% 70% / 0.4)',
  },
  Master: {
    name: 'Master',
    minPoints: 3500,
    maxPoints: 4999,
    emoji: '🟣',
    color: 'hsl(280 100% 70%)',
    gradient: 'linear-gradient(135deg, hsl(280 100% 70%), hsl(280 100% 80%))',
    glowColor: 'hsl(280 100% 70% / 0.4)',
  },
  Grandmaster: {
    name: 'Grandmaster',
    minPoints: 5000,
    maxPoints: 7499,
    emoji: '🔥',
    color: 'hsl(0 100% 65%)',
    gradient: 'linear-gradient(135deg, hsl(0 100% 65%), hsl(15 100% 70%))',
    glowColor: 'hsl(0 100% 65% / 0.4)',
  },
  Legendary: {
    name: 'Legendary',
    minPoints: 7500,
    maxPoints: 99999,
    emoji: '🌌',
    color: 'hsl(270 100% 80%)',
    gradient: 'linear-gradient(135deg, hsl(270 100% 80%), hsl(300 100% 85%))',
    glowColor: 'hsl(270 100% 80% / 0.4)',
  },
};

export const getRankByPoints = (points: number): Rank => {
  const ranks = Object.values(RANKS);
  return ranks.find(rank => points >= rank.minPoints && points <= rank.maxPoints) || RANKS.Bronze;
};

export const getRankProgress = (points: number): number => {
  const rank = getRankByPoints(points);
  const progress = ((points - rank.minPoints) / (rank.maxPoints - rank.minPoints)) * 100;
  return Math.min(Math.max(progress, 0), 100);
};

export const getPointsForWin = (winStreak: number): number => {
  const basePoints = 25;
  const streakBonus = Math.min(winStreak * 2, 15); // Max 15 bonus points
  return basePoints + streakBonus;
};

export const getPointsForLoss = (): number => {
  return -15;
};