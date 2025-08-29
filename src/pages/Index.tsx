import React, { useState } from "react";
import HomePage from "@/components/HomePage";
import BattlePage from "@/components/BattlePage";
import { getRandomQuestions } from "@/data/questions";

const Index = () => {
  const [page, setPage] = useState<"home" | "battle">("home");
  const [rank, setRank] = useState("Bronze");
  const [progress, setProgress] = useState(40);
  const [battleQuestions] = useState(() => getRandomQuestions(5));

  return page === "home" ? (
    <HomePage 
      startGame={() => setPage("battle")} 
      rank={rank}
      progress={progress}
    />
  ) : (
    <BattlePage 
      goHome={() => setPage("home")} 
      questions={battleQuestions}
    />
  );
};

export default Index;
