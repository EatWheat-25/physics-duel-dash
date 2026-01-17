import React, { useState } from "react";
import { motion } from "framer-motion";
import { Play, Trophy, Target, Users, Settings, Star, User, Bell, ChevronRight } from "lucide-react";
import DarkModeToggle from './DarkModeToggle';

interface HomePageProps {
  startGame: () => void;
  rank: string;
  progress: number;
}

const ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ruby"];

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
  const [selectedMode, setSelectedMode] = useState("PLAY");

  const getRankEmoji = (rank: string) => {
    switch (rank) {
      case "Bronze": return "🥉";
      case "Silver": return "🥈";
      case "Gold": return "🥇";
      case "Platinum": return "🟪";
      case "Diamond": return "💎";
      case "Ruby": return "♦️";
      default: return "🏆";
    }
  };

  const mainMenuItems = [
    { id: "PLAY", label: "PLAY", active: true },
    { id: "CAREER", label: "CAREER", active: false },
    { id: "BATTLEPASS", label: "PROGRESSION", active: false },
    { id: "COLLECTION", label: "ACHIEVEMENTS", active: false },
    { id: "AGENTS", label: "RANKINGS", active: false },
    { id: "STORE", label: "STORE", active: false }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-game-void to-background text-foreground overflow-hidden relative">
      <DarkModeToggle />
      
      {/* Dark tech atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-t from-game-void/50 via-transparent to-game-void/30 pointer-events-none" />
      
      {/* Subtle particle effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-game-neon rounded-full animate-float opacity-40"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${Math.random() * 15 + 10}s`,
              filter: 'blur(0.5px)'
            }}
          />
        ))}
      </div>
      <div className="absolute top-0 right-0 z-50 p-4 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Star className="w-4 h-4 text-yellow-500" />
          <span>1/2</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-primary" />
          <span>0</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Target className="w-4 h-4 text-accent" />
          <span>40</span>
        </div>
        <button className="p-2 hover:bg-muted/20 rounded">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Enhanced Futuristic Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated Circuit Grid */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(90deg, hsl(188, 100%, 42%, 0.1) 1px, transparent 1px),
              linear-gradient(0deg, hsl(193, 100%, 50%, 0.1) 1px, transparent 1px),
              linear-gradient(45deg, hsl(175, 100%, 45%, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px, 60px 60px, 120px 120px',
            animation: 'gridMove 25s linear infinite'
          }} />
        </div>
        
        {/* Floating Holographic Orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-30"
          style={{
            background: `radial-gradient(circle, hsl(188, 100%, 42%, 0.2) 0%, hsl(193, 100%, 50%, 0.1) 40%, transparent 70%)`,
            filter: 'blur(40px)',
            animation: 'float 8s ease-in-out infinite'
          }} 
        />
        <div className="absolute bottom-1/3 left-1/5 w-80 h-80 rounded-full opacity-25"
          style={{
            background: `radial-gradient(circle, hsl(193, 100%, 50%, 0.15) 0%, hsl(175, 100%, 45%, 0.08) 50%, transparent 80%)`,
            filter: 'blur(35px)',
            animation: 'float 10s ease-in-out infinite reverse'
          }} 
        />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-20"
          style={{
            background: `radial-gradient(circle, hsl(175, 100%, 45%, 0.12) 0%, transparent 60%)`,
            filter: 'blur(30px)',
            animation: 'pulse 6s ease-in-out infinite'
          }} 
        />
        
        {/* Geometric Tech Elements */}
        <div className="absolute top-1/6 right-1/6 w-32 h-32 border border-primary/20 rotate-45"
          style={{ animation: 'spin 20s linear infinite' }} 
        />
        <div className="absolute bottom-1/4 right-1/3 w-24 h-24 border-2 border-accent/15 rotate-12"
          style={{ animation: 'spin 15s linear infinite reverse' }} 
        />
        <div className="absolute top-2/3 left-1/6 w-16 h-16 border border-primary/25"
          style={{ animation: 'pulse 4s ease-in-out infinite' }} 
        />
        
        {/* Scanning Lines */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
            style={{ animation: 'scanLine 8s ease-in-out infinite' }} 
          />
          <div className="absolute bottom-0 right-0 w-px h-full bg-gradient-to-t from-transparent via-primary/30 to-transparent"
            style={{ animation: 'scanLineVertical 12s ease-in-out infinite' }} 
          />
        </div>
        
        {/* Data Stream Effect */}
        <div className="absolute top-1/4 left-0 w-2 h-full opacity-30">
          <div className="w-full h-8 bg-gradient-to-b from-primary/40 to-transparent"
            style={{ animation: 'dataStream 3s linear infinite' }} 
          />
        </div>
        <div className="absolute top-1/3 right-0 w-1 h-full opacity-25">
          <div className="w-full h-12 bg-gradient-to-b from-accent/30 to-transparent"
            style={{ animation: 'dataStream 4s linear infinite reverse' }} 
          />
        </div>
        
        {/* Holographic Panels */}
        <div className="absolute top-1/5 left-1/4 w-48 h-32 rounded-lg opacity-10"
          style={{
            background: `linear-gradient(135deg, hsl(188, 100%, 42%, 0.15), hsl(193, 100%, 50%, 0.08))`,
            backdropFilter: 'blur(20px)',
            border: '1px solid hsl(188, 100%, 42%, 0.2)',
            animation: 'float 6s ease-in-out infinite'
          }} 
        />
        <div className="absolute bottom-1/5 right-1/4 w-32 h-24 rounded opacity-8"
          style={{
            background: `linear-gradient(45deg, hsl(175, 100%, 45%, 0.12), transparent)`,
            backdropFilter: 'blur(15px)',
            border: '1px solid hsl(175, 100%, 45%, 0.15)',
            animation: 'float 8s ease-in-out infinite reverse'
          }} 
        />
      </div>

      <div className="flex min-h-screen">
        {/* Left Navigation Menu */}
        <div className="w-80 bg-card/20 backdrop-blur-sm border-r border-border/30 flex flex-col">
          {/* Logo Area */}
          <div className="p-6 border-b border-border/20">
            <h1 className="text-2xl font-bold futuristic-heading">
              ROBOT ACADEMY
            </h1>
            <p className="text-muted-foreground text-sm tech-text">AI MATHEMATICS WARFARE</p>
          </div>

          {/* Main Navigation */}
          <div className="flex-1 p-6">
            <div className="space-y-2">
              {mainMenuItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  onClick={() => setSelectedMode(item.id)}
                  className={`w-full text-left p-4 text-2xl font-bold tracking-wider transition-all duration-300 relative group tech-text ${
                    selectedMode === item.id 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 transition-all duration-300 ${
                      selectedMode === item.id ? 'bg-primary' : 'bg-transparent'
                    }`} />
                    {item.label}
                  </div>
                  {selectedMode === item.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <ChevronRight className="w-6 h-6 text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Central Content Area */}
        <div className="flex-1 relative">
          {/* Hero Section */}
          <div className="h-full flex flex-col justify-center p-12 relative">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="max-w-2xl"
            >
              <h2 className="text-6xl font-bold mb-6 leading-tight futuristic-heading">
                AI-POWERED
                <br />
                <span className="futuristic-heading">
                  MATH BATTLES
                </span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-lg tech-text">
                Team up with advanced AI companions in futuristic mathematics warfare. 
                Calculate, strategize, dominate.
              </p>
              
              <motion.button
                onClick={startGame}
                className="cyber-button flex items-center gap-4 px-8 py-4 text-xl font-bold"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play className="w-6 h-6" />
                START BATTLE
              </motion.button>
            </motion.div>

            {/* Geometric Decoration */}
            <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-10">
              <div className="w-64 h-64 border border-primary rotate-45"></div>
              <div className="w-48 h-48 border border-accent rotate-12 absolute top-8 left-8"></div>
            </div>
          </div>
        </div>

        {/* Right Panels */}
        <div className="w-96 p-6 space-y-6">
          {/* Rank Progress Panel */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="cyber-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold futuristic-heading">CURRENT RANK</h3>
              <div className="text-sm text-muted-foreground tech-text">
                {progress}% TO GO
              </div>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded bg-gradient-to-r from-primary to-accent flex items-center justify-center text-2xl">
                {getRankEmoji(rank)}
              </div>
              <div>
                <div className="text-2xl font-bold futuristic-heading">{rank.toUpperCase()}</div>
                <div className="text-sm text-muted-foreground tech-text">
                  Next: {ranks[ranks.indexOf(rank) + 1]?.toUpperCase() || "MAX RANK"}
                </div>
              </div>
            </div>

            <div className="w-full bg-muted/20 rounded h-2 mb-2">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent rounded"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, delay: 0.8 }}
              />
            </div>
          </motion.div>

          {/* Game Modes Panel */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="cyber-card p-6"
          >
            <h3 className="text-lg font-bold mb-4 futuristic-heading">SELECT MODE</h3>
            <div className="space-y-3">
              {gameModes.map((mode, index) => (
                <div
                  key={mode.id}
                  className="flex items-center justify-between p-3 rounded bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl">{mode.icon}</div>
                    <div>
                      <div className="font-bold text-sm tech-text">{mode.title}</div>
                      <div className="text-xs text-muted-foreground">{mode.subtitle}</div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${mode.color} text-white`}>
                    {mode.difficulty}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Stats Panel */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="cyber-card p-6"
          >
            <h3 className="text-lg font-bold mb-4 futuristic-heading">PERFORMANCE</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground tech-text">Total Wins</span>
                <span className="font-bold futuristic-heading">127</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground tech-text">Win Rate</span>
                <span className="font-bold text-primary futuristic-heading">89%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground tech-text">Best Streak</span>
                <span className="font-bold text-accent futuristic-heading">12</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;