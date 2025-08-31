import React, { useState } from "react";
import Dashboard from "@/components/Dashboard";
import BattlePageNew from "@/components/BattlePageNew";
import PostMatchResults from "@/components/PostMatchResults";
import RankUpModal from "@/components/RankUpModal";
import { getRandomQuestions } from "@/data/questions";
import { useRanking } from "@/hooks/useRanking";
import { RankName, getRankByPoints, getPointsForWin, getPointsForLoss } from "@/types/ranking";

interface MatchStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  playerScore: number;
  opponentScore: number;
  pointsEarned: number;
  won: boolean;
}

const Index = () => {
  const [page, setPage] = useState<"dashboard" | "battle" | "results">("dashboard");
  const [battleQuestions] = useState(() => getRandomQuestions(8));
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const { userData, updateAfterBattle } = useRanking();
  
  // Rank up modal state
  const [showRankUpModal, setShowRankUpModal] = useState(false);
  const [rankUpData, setRankUpData] = useState<{ newRank: RankName; pointsGained: number } | null>(null);

  const handleBattleEnd = (won: boolean, stats: MatchStats) => {
    const previousRank = userData.currentRank;
    const pointsGained = won ? getPointsForWin(userData.winStreak) : getPointsForLoss();
    
    // Create final match stats with points
    const finalStats: MatchStats = {
      ...stats,
      pointsEarned: pointsGained
    };
    
    setMatchStats(finalStats);
    
    // Update battle results
    updateAfterBattle(won);
    
    // Check for rank up
    setTimeout(() => {
      const newPoints = Math.max(0, userData.currentPoints + pointsGained);
      const newRank = getRankByPoints(newPoints);
      
      if (previousRank !== newRank.name && won) {
        setRankUpData({ newRank: newRank.name, pointsGained });
        setShowRankUpModal(true);
      }
    }, 100);
    
    setPage("results");
  };

  return (
    <>
      {page === "dashboard" && (
        <Dashboard 
          onStartBattle={() => setPage("battle")} 
          userData={userData}
        />
      )}
      
      {page === "battle" && (
        <BattlePageNew 
          onGoBack={() => setPage("dashboard")} 
          questions={battleQuestions}
          onBattleEnd={handleBattleEnd}
        />
      )}
      
      {page === "results" && matchStats && (
        <PostMatchResults
          matchStats={matchStats}
          userData={userData}
          onContinue={() => setPage("dashboard")}
          onPlayAgain={() => setPage("battle")}
        />
      )}
      
      {/* Rank Up Modal */}
      {rankUpData && (
        <RankUpModal
          isOpen={showRankUpModal}
          onClose={() => {
            setShowRankUpModal(false);
            setRankUpData(null);
          }}
          newRank={rankUpData.newRank}
          pointsGained={rankUpData.pointsGained}
        />
      )}
    </>
  );
};

export default Index;
