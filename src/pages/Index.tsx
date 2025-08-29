import React, { useState } from "react";
import Dashboard from "@/components/Dashboard";
import BattlePageNew from "@/components/BattlePageNew";
import RankUpModal from "@/components/RankUpModal";
import { getRandomQuestions } from "@/data/questions";
import { useRanking } from "@/hooks/useRanking";
import { RankName, getRankByPoints, getPointsForWin, getPointsForLoss } from "@/types/ranking";

const Index = () => {
  const [page, setPage] = useState<"dashboard" | "battle">("dashboard");
  const [battleQuestions] = useState(() => getRandomQuestions(8));
  const { userData, updateAfterBattle } = useRanking();
  
  // Rank up modal state
  const [showRankUpModal, setShowRankUpModal] = useState(false);
  const [rankUpData, setRankUpData] = useState<{ newRank: RankName; pointsGained: number } | null>(null);

  const handleBattleEnd = (won: boolean) => {
    const previousRank = userData.currentRank;
    const previousPoints = userData.currentPoints;
    const pointsGained = won ? getPointsForWin(userData.winStreak) : getPointsForLoss();
    const newPoints = Math.max(0, previousPoints + pointsGained);
    const newRank = getRankByPoints(newPoints);
    
    // Update battle results
    updateAfterBattle(won);
    
    // Check for rank up
    if (previousRank !== newRank.name && won) {
      setRankUpData({ newRank: newRank.name, pointsGained });
      setShowRankUpModal(true);
    }
  };

  return (
    <>
      {page === "dashboard" ? (
        <Dashboard 
          onStartBattle={() => setPage("battle")} 
          userData={userData}
        />
      ) : (
        <BattlePageNew 
          onGoBack={() => setPage("dashboard")} 
          questions={battleQuestions}
          onBattleEnd={handleBattleEnd}
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
