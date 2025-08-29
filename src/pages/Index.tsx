import React, { useState } from "react";
import Dashboard from "@/components/Dashboard";
import BattlePageNew from "@/components/BattlePageNew";
import { getRandomQuestions } from "@/data/questions";

const Index = () => {
  const [page, setPage] = useState<"dashboard" | "battle">("dashboard");
  const [battleQuestions] = useState(() => getRandomQuestions(8));

  // Mock user data
  const user = {
    username: "PhysicsWarrior",
    rank: "Gold",
    progress: 73,
    winStreak: 5,
    totalMatches: 28,
    accuracy: 87,
  };

  return page === "dashboard" ? (
    <Dashboard 
      onStartBattle={() => setPage("battle")} 
      user={user}
    />
  ) : (
    <BattlePageNew 
      onGoBack={() => setPage("dashboard")} 
      questions={battleQuestions}
    />
  );
};

export default Index;
