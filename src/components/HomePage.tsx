import React from "react";
import { motion } from "framer-motion";

interface HomePageProps {
  startGame: () => void;
  rank: string;
  progress: number;
}

const ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

const HomePage: React.FC<HomePageProps> = ({ startGame, rank, progress }) => {
  const getRankEmoji = (rank: string) => {
    switch (rank) {
      case "Bronze": return "🥉";
      case "Silver": return "🥈";
      case "Gold": return "🥇";
      case "Platinum": return "💎";
      case "Diamond": return "💠";
      default: return "🏆";
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-foreground p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mb-8"
      >
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-battle-secondary bg-clip-text text-transparent">
          ⚡ A-Level Battle Arena
        </h1>
        <p className="text-lg max-w-md opacity-90">
          Challenge your friends in 1v1 A-Level Physics battles. Answer correctly to push your progress bar and climb the ranks!
        </p>
      </motion.div>

      {/* Rank Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="battle-card p-8 mb-8 w-full max-w-sm"
      >
        <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Your Rank</h2>
        <div className="text-4xl font-bold mb-4 flex items-center justify-center gap-2">
          <span>{getRankEmoji(rank)}</span>
          <span className="bg-gradient-to-r from-primary to-battle-secondary bg-clip-text text-transparent">
            {rank}
          </span>
        </div>
        
        <div className="w-full bg-white/10 rounded-full h-4 mb-2 overflow-hidden">
          <motion.div
            className="progress-bar rank-progress"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, delay: 0.5 }}
          />
        </div>
        <p className="text-sm opacity-80">
          {progress}% to {ranks[ranks.indexOf(rank) + 1] || "Max Rank"}
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        onClick={startGame}
        className="battle-button text-xl"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        🚀 Start Battle
      </motion.button>
    </div>
  );
};

export default HomePage;