import { useState, useCallback, useEffect } from 'react';
import { UserRankData, RankHistory, getRankByPoints, getPointsForWin, getPointsForLoss, RankName } from '@/types/ranking';
import { useAuth } from '@/contexts/AuthContext';

const initialUserData: UserRankData = {
  username: "Player",
  currentPoints: 0,
  currentRank: { tier: 'Bronze', subRank: 1 },
  winStreak: 0,
  totalMatches: 0,
  wins: 0,
  losses: 0,
  accuracy: 0,
  avatar: undefined,
  history: []
};

export const useRanking = () => {
  const [userData, setUserData] = useState<UserRankData>(initialUserData);
  const { profile } = useAuth();

  // Update username when profile loads
  useEffect(() => {
    if (profile?.username) {
      setUserData(prevData => ({
        ...prevData,
        username: profile.username
      }));
    }
  }, [profile]);

  const updateAfterBattle = useCallback((won: boolean) => {
    setUserData(prevData => {
      const pointsChange = won ? getPointsForWin() : getPointsForLoss();
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
        newRank: { tier: newRank.tier, subRank: newRank.subRank },
      };

      return {
        ...prevData,
        currentPoints: newPoints,
        currentRank: { tier: newRank.tier, subRank: newRank.subRank },
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
    console.log(`Congratulations! You've reached ${userData.currentRank.tier} ${userData.currentRank.subRank}!`);
  }, [userData.currentRank]);

  return {
    userData,
    updateAfterBattle,
    rankUp,
  };
};