export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Unbeatable' | 'Pocket Calculator';
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

// Create all ranks with sub-ranks (removed Platinum, added Unbeatable & Pocket Calculator)
const createRanks = (): Rank[] => {
  const tiers: { tier: RankTier; emoji: string; color: string; gradient: string; glowColor: string }[] = [
    {
      tier: 'Bronze',
      emoji: '🥉',
      color: 'hsl(30 50% 50%)',
      gradient: 'linear-gradient(135deg, hsl(30 50% 50%), hsl(30 60% 60%))',
      glowColor: 'hsl(30 50% 50% / 0.4)',
    },
    {
      tier: 'Silver',
      emoji: '🥈',
      color: 'hsl(0 0% 70%)',
      gradient: 'linear-gradient(135deg, hsl(0 0% 70%), hsl(0 0% 80%))',
      glowColor: 'hsl(0 0% 70% / 0.4)',
    },
    {
      tier: 'Gold',
      emoji: '🥇',
      color: 'hsl(45 100% 60%)',
      gradient: 'linear-gradient(135deg, hsl(45 100% 60%), hsl(45 100% 70%))',
      glowColor: 'hsl(45 100% 60% / 0.4)',
    },
    {
      tier: 'Diamond',
      emoji: '💎',
      color: 'hsl(180 100% 70%)',
      gradient: 'linear-gradient(135deg, hsl(180 100% 70%), hsl(180 100% 80%))',
      glowColor: 'hsl(180 100% 70% / 0.4)',
    },
    {
      tier: 'Unbeatable',
      emoji: '🔥',
      color: 'hsl(0 100% 65%)',
      gradient: 'linear-gradient(135deg, hsl(0 100% 65%), hsl(20 100% 70%))',
      glowColor: 'hsl(0 100% 65% / 0.5)',
    },
    {
      tier: 'Pocket Calculator',
      emoji: '🧮',
      color: 'hsl(280 100% 80%)',
      gradient: 'linear-gradient(135deg, hsl(280 100% 80%), hsl(320 100% 90%), hsl(280 100% 80%))',
      glowColor: 'hsl(280 100% 80% / 0.6)',
    },
  ];

  const ranks: Rank[] = [];
  
  tiers.forEach((tierData, tierIndex) => {
    if (tierData.tier === 'Pocket Calculator') {
      // Pocket Calculator is elite rank for top 1,000 players only
      ranks.push({
        tier: tierData.tier,
        subRank: 1 as SubRank,
        minPoints: 1500, // 15 ranks * 100 points = 1500 (Unbeatable 3 max)
        maxPoints: 99999,
        emoji: tierData.emoji,
        color: tierData.color,
        gradient: tierData.gradient,
        glowColor: tierData.glowColor,
        displayName: 'POCKET CALCULATOR',
      });
    } else {
      for (let subRank = 1; subRank <= 3; subRank++) {
        const rankIndex = tierIndex * 3 + (subRank - 1);
        ranks.push({
          tier: tierData.tier,
          subRank: subRank as SubRank,
          minPoints: rankIndex * 100,
          maxPoints: (rankIndex + 1) * 100 - 1,
          emoji: tierData.emoji,
          color: tierData.color,
          gradient: tierData.gradient,
          glowColor: tierData.glowColor,
          displayName: `${tierData.tier} ${subRank}`,
        });
      }
    }
  });

  return ranks;
};

export const RANKS = createRanks();

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
  const currentIndex = RANKS.findIndex(rank => 
    rank.tier === currentRank.tier && rank.subRank === currentRank.subRank
  );
  return currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
};

export const rankNameToString = (rank: RankName): string => {
  return `${rank.tier} ${rank.subRank}`;
};