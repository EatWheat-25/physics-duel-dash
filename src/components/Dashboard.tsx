import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, LogOut, Play, Users, Target, BookOpen, Trophy, Star, ChevronRight, User, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import CyberBackground from './CyberBackground';
import RankBadge from './RankBadge';
import { UserRankData } from '@/types/ranking';

interface DashboardProps {
  onStartBattle: () => void;
  onStartMathBattle: (level: 'A1' | 'A2_ONLY' | 'A2') => void;
  onStartPhysicsBattle: (level: 'A1' | 'A2_ONLY' | 'A2') => void;
  userData: UserRankData;
}

const Dashboard: React.FC<DashboardProps> = ({ onStartBattle, onStartMathBattle, onStartPhysicsBattle, userData }) => {
  const [selectedTab, setSelectedTab] = useState("PLAY");

  const mainMenuItems = [
    { id: "PLAY", label: "PLAY" },
    { id: "CAREER", label: "CAREER" },
    { id: "BATTLEPASS", label: "PROGRESSION" }, 
    { id: "COLLECTION", label: "ACHIEVEMENTS" },
    { id: "AGENTS", label: "RANKINGS" },
    { id: "STORE", label: "STORE" }
  ];

  const gameModes = [
    {
      id: "A1",
      title: "A1 ONLY", 
      subtitle: "AS LEVEL MATH",
      icon: "🔢",
      gradient: "from-blue-500 to-purple-600"
    },
    {
      id: "A2", 
      title: "A1 + A2 MIXED",
      subtitle: "FULL A LEVEL", 
      icon: "📊",
      gradient: "from-purple-500 to-pink-600"
    },
    {
      id: "A2_ONLY",
      title: "A2 ONLY",
      subtitle: "ADVANCED MATH",
      icon: "∫", 
      gradient: "from-pink-500 to-red-600"
    }
  ];

  const physicsMode = [
    { id: "A1", icon: "⚡", gradient: "from-yellow-500 to-orange-600" },
    { id: "A2", icon: "🔬", gradient: "from-green-500 to-blue-600" }, 
    { id: "A2_ONLY", icon: "⚛️", gradient: "from-purple-500 to-indigo-600" }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Top Right Stats */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <span>1/2</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <span>{userData.currentPoints}</span>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" />
          <span>{userData.accuracy}</span>
        </div>
        <button className="p-2 hover:bg-muted/20 rounded transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
      </div>

      <div className="flex min-h-screen">
        {/* Left Navigation - Valorant Style */}
        <div className="w-80 bg-card/10 backdrop-blur-sm border-r border-border/20 flex flex-col p-6">
          {/* Logo */}
          <div className="mb-12">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              BATTLE ARENA
            </h1>
            <p className="text-muted-foreground text-sm">A-LEVEL MATHEMATICS</p>
          </div>

          {/* Navigation Menu */}
          <div className="flex-1 space-y-3">
            {mainMenuItems.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                onClick={() => setSelectedTab(item.id)}
                className={`w-full text-left p-4 text-2xl font-bold tracking-wider transition-all duration-300 relative group ${
                  selectedTab === item.id 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-1 h-8 transition-all duration-300 ${
                    selectedTab === item.id ? 'bg-primary' : 'bg-transparent'
                  }`} />
                  {item.label}
                </div>
                {selectedTab === item.id && (
                  <motion.div
                    layoutId="activeMenuItem"
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <ChevronRight className="w-6 h-6 text-primary" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-12">
          {selectedTab === "PLAY" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-6xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  READY TO BATTLE
                </h2>
                <p className="text-xl text-muted-foreground mb-12">
                  Choose your subject and dominate the arena
                </p>
                <Link to="/subject-selection">
                  <motion.button
                    className="cyber-button flex items-center gap-4 px-12 py-6 text-2xl font-bold"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play className="w-8 h-8" />
                    START BATTLE
                  </motion.button>
                </Link>
              </div>
            </div>
          )}

          {selectedTab !== "PLAY" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-3xl font-bold mb-4 text-muted-foreground">Coming Soon</h3>
                <p className="text-lg text-muted-foreground">{selectedTab} section is under development</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-96 p-6 space-y-6">
          {/* Player Info */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="cyber-card p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-xl font-bold">
                {userData.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold">{userData.username}</h3>
                <RankBadge rank={userData.currentRank} size="sm" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{userData.currentPoints} / 100</span>
              </div>
              <div className="w-full bg-muted/20 rounded h-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded"
                  initial={{ width: 0 }}
                  animate={{ width: `${userData.currentPoints}%` }}
                  transition={{ duration: 1.2, delay: 0.8 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="cyber-card p-6"
          >
            <h4 className="text-lg font-bold mb-4">PERFORMANCE</h4>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Win Streak</span>
                <span className="font-bold text-primary">{userData.winStreak}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Matches</span>
                <span className="font-bold">{userData.totalMatches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="font-bold text-accent">{userData.accuracy}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;