import { useState, useCallback } from 'react';
import { UserRankData, RankHistory, getRankByPoints, getPointsForWin, getPointsForLoss, RankName } from '@/types/ranking';

// Mock initial user data
const initialUserData: UserRankData = {
  username: "PhysicsWarrior",
  currentPoints: 1250, // Gold rank
  currentRank: 'Gold',
  winStreak: 5,
  totalMatches: 28,
  wins: 20,
  losses: 8,
  accuracy: 87,
  avatar: undefined,
  history: [
    {
      id: '1',
      date: new Date(Date.now() - 86400000), // 1 day ago
      outcome: 'win',
      pointsChange: 27,
      previousRank: 'Gold',
      newRank: 'Gold',
    },
    {
      id: '2',
      date: new Date(Date.now() - 172800000), // 2 days ago
      outcome: 'win',
      pointsChange: 25,
      previousRank: 'Gold',
      newRank: 'Gold',
    },
    {
      id: '3',
      date: new Date(Date.now() - 259200000), // 3 days ago
      outcome: 'loss',
      pointsChange: -15,
      previousRank: 'Gold',
      newRank: 'Gold',
    },
    {
      id: '4',
      date: new Date(Date.now() - 345600000), // 4 days ago
      outcome: 'win',
      pointsChange: 25,
      previousRank: 'Silver',
      newRank: 'Gold',
    },
    {
      id: '5',
      date: new Date(Date.now() - 432000000), // 5 days ago
      outcome: 'win',
      pointsChange: 25,
      previousRank: 'Silver',
      newRank: 'Silver',
    },
  ]
};

export const useRanking = () => {
  const [userData, setUserData] = useState<UserRankData>(initialUserData);

  const updateAfterBattle = useCallback((won: boolean) => {
    setUserData(prevData => {
      const pointsChange = won ? getPointsForWin(prevData.winStreak) : getPointsForLoss();
      const newPoints = Math.max(0, prevData.currentPoints + pointsChange);
      const newRank = getRankByPoints(newPoints);
      const previousRank = prevData.currentRank;
      
      const newWinStreak = won ? prevData.winStreak + 1 : 0;
      const newWins = won ? prevData.wins + 1 : prevData.wins;
      const newLosses = won ? prevData.losses : prevData.losses + 1;
      const newTotalMatches = prevData.totalMatches + 1;
      const newAccuracy = Math.round((newWins / newTotalMatches) * 100);

      const historyEntry: RankHistory = {
        id: Date.now().toString(),
        date: new Date(),
        outcome: won ? 'win' : 'loss',
        pointsChange,
        previousRank,
        newRank: newRank.name,
      };

      return {
        ...prevData,
        currentPoints: newPoints,
        currentRank: newRank.name,
        winStreak: newWinStreak,
        totalMatches: newTotalMatches,
        wins: newWins,
        losses: newLosses,
        accuracy: newAccuracy,
        history: [historyEntry, ...prevData.history].slice(0, 10), // Keep last 10 matches
      };
    });
  }, []);

  const rankUp = useCallback(() => {
    // This will be called when a rank animation completes
    console.log(`Congratulations! You've reached ${userData.currentRank}!`);
  }, [userData.currentRank]);

  return {
    userData,
    updateAfterBattle,
    rankUp,
  };
};