import React, { useState } from "react";
import { motion } from "framer-motion";
import { Play, Trophy, Target, Users, Settings, Star } from "lucide-react";

interface HomePageProps {
  startGame: () => void;
  rank: string;
  progress: number;
}

const ranks = ["Bronze", "Silver", "Gold", "Diamond", "Unbeatable", "Pocket Calculator"];

const gameModes = [
  {
    id: "A1-Only",
    title: "A1 ONLY",
    subtitle: "AS Level Mathematics",
    description: "Master the fundamentals",
    difficulty: "BEGINNER",
    color: "from-emerald-500 to-teal-600",
    icon: "📚",
    players: "2.1M+"
  },
  {
    id: "A2-Only", 
    title: "A2 ONLY",
    subtitle: "A2 Level Mathematics",
    description: "Advanced challenges",
    difficulty: "ADVANCED",
    color: "from-orange-500 to-red-600",
    icon: "🔥",
    players: "1.8M+"
  },
  {
    id: "All-Maths",
    title: "ALL MATHS",
    subtitle: "Complete A-Level",
    description: "Ultimate challenge",
    difficulty: "EXPERT",
    color: "from-purple-500 to-pink-600",
    icon: "⚡",
    players: "986K+"
  }
];

const HomePage: React.FC<HomePageProps> = ({ startGame, rank, progress }) => {
  const [selectedMode, setSelectedMode] = useState("All-Maths");

  const getRankEmoji = (rank: string) => {
    switch (rank) {
      case "Bronze": return "🥉";
      case "Silver": return "🥈";
      case "Gold": return "🥇";
      case "Diamond": return "💎";
      case "Unbeatable": return "🔮";
      case "Pocket Calculator": return "🏆";
      default: return "🏆";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/90 text-foreground overflow-hidden">
      {/* Cyber Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 min-h-screen flex">
        {/* Left Sidebar - Player Info & Navigation */}
        <motion.div 
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-80 border-r border-border/50 bg-card/30 backdrop-blur-sm p-6 flex flex-col"
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              BATTLE ARENA
            </h1>
            <p className="text-muted-foreground text-sm">A-Level Mathematics</p>
          </div>

          {/* Player Card */}
          <div className="cyber-card p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-xl">
                {getRankEmoji(rank)}
              </div>
              <div>
                <h3 className="font-bold text-lg">Player</h3>
                <p className="text-muted-foreground text-sm">{rank} Rank</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-muted/20 rounded-full h-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.2, delay: 0.5 }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Next: {ranks[ranks.indexOf(rank) + 1] || "Max Rank"}
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="cyber-card p-3 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Wins</p>
              <p className="font-bold">127</p>
            </div>
            <div className="cyber-card p-3 text-center">
              <Target className="w-5 h-5 mx-auto mb-1 text-accent" />
              <p className="text-xs text-muted-foreground">Accuracy</p>
              <p className="font-bold">89%</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-auto space-y-2">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20 transition-colors">
              <Users className="w-5 h-5" />
              <span>Friends</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20 transition-colors">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="p-8 border-b border-border/50"
          >
            <h2 className="text-4xl font-bold mb-2">SELECT GAME MODE</h2>
            <p className="text-muted-foreground">Choose your battlefield and prove your mathematical prowess</p>
          </motion.div>

          {/* Game Modes Grid */}
          <div className="flex-1 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {gameModes.map((mode, index) => (
                <motion.div
                  key={mode.id}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className={`cyber-card p-6 cursor-pointer transition-all duration-300 hover:scale-105 ${
                    selectedMode === mode.id ? 'ring-2 ring-primary shadow-lg shadow-primary/25' : ''
                  }`}
                  onClick={() => setSelectedMode(mode.id)}
                  whileHover={{ y: -5 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl">{mode.icon}</div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${mode.color} text-white`}>
                      {mode.difficulty}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-1">{mode.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{mode.subtitle}</p>
                  <p className="text-sm mb-4">{mode.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{mode.players}</span>
                    </div>
                    <Star className="w-4 h-4 text-yellow-500" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Play Button */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex justify-center"
            >
              <motion.button
                onClick={startGame}
                className="cyber-button flex items-center gap-4 px-12 py-4 text-xl font-bold"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Play className="w-6 h-6" />
                START BATTLE
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;