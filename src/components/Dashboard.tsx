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
    <div className="min-h-screen text-foreground overflow-hidden relative">
      {/* Vibrant Diagonal Stripe Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-purple-600 to-orange-400">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(45deg, 
            transparent 25%, 
            rgba(255,255,255,0.1) 25%, 
            rgba(255,255,255,0.1) 50%, 
            transparent 50%, 
            transparent 75%, 
            rgba(255,255,255,0.1) 75%
          )`,
          backgroundSize: '60px 60px'
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(-45deg, 
            rgba(255,193,7,0.3) 0%, 
            rgba(233,30,99,0.3) 50%, 
            rgba(156,39,176,0.3) 100%
          )`
        }} />
      </div>

      {/* Top Navigation Bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-white">BATTLE ARENA</h1>
          
          {/* Navigation Items */}
          <div className="flex items-center gap-6">
            {mainMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedTab(item.id)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  selectedTab === item.id 
                    ? 'text-yellow-400 border-b-2 border-yellow-400' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* User Info & Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm text-white">
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>{userData.currentPoints}</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4 text-green-400" />
              <span>{userData.accuracy}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center text-sm font-bold text-white">
              {userData.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-white font-medium">{userData.username}</span>
          </div>
          
          <button className="p-2 hover:bg-white/10 rounded transition-colors">
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-[calc(100vh-80px)]">
        {selectedTab === "PLAY" && (
          <>
            {/* Game Mode Selection Grid */}
            <div className="flex-1 p-8">
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="text-center mb-8"
              >
                <h2 className="text-4xl font-bold mb-2 text-white">SELECT GAME MODE</h2>
                <p className="text-white/70">Choose your battle arena and dominate</p>
              </motion.div>

              {/* Mathematics Modes */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-3xl">📚</span>
                  MATHEMATICS BATTLES
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      id: "A1-Only",
                      title: "A1 ONLY",
                      subtitle: "AS LEVEL",
                      icon: "📚",
                      gradient: "from-emerald-500 to-teal-600",
                      difficulty: "BEGINNER",
                      players: "2.1M+"
                    },
                    {
                      id: "All-Maths", 
                      title: "A1 + A2 MIXED",
                      subtitle: "FULL A-LEVEL",
                      icon: "📊",
                      gradient: "from-purple-500 to-pink-600", 
                      difficulty: "EXPERT",
                      players: "986K+"
                    },
                    {
                      id: "A2-Only",
                      title: "A2 ONLY",
                      subtitle: "ADVANCED",
                      icon: "∫",
                      gradient: "from-orange-500 to-red-600",
                      difficulty: "ADVANCED", 
                      players: "1.8M+"
                    },
                    {
                      id: "A2-Integration",
                      title: "A2 PAPER 3",
                      subtitle: "INTEGRATION",
                      icon: "∬",
                      gradient: "from-violet-500 to-purple-600",
                      difficulty: "EXPERT",
                      players: "542K+"
                    }
                  ].map((mode, index) => (
                    <motion.div
                      key={mode.id}
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:border-white/40 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                      onClick={() => onStartMathBattle(mode.id as any)}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-2xl">{mode.icon}</div>
                          <div className={`px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${mode.gradient} text-white`}>
                            {mode.difficulty}
                          </div>
                        </div>
                        
                        <h4 className="text-lg font-bold text-white mb-1">{mode.title}</h4>
                        <p className="text-sm text-white/60 mb-3">{mode.subtitle}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                            <span className="text-xs text-white/60">{mode.players}</span>
                          </div>
                          <button className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors">
                            <Play className="w-3 h-3 text-white" />
                            <span className="text-xs font-semibold text-white">PLAY</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Physics Modes */}
              <div>
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-3xl">⚡</span>
                  PHYSICS BATTLES
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      id: "A1",
                      title: "A1 ONLY",
                      subtitle: "AS LEVEL",
                      icon: "⚡",
                      gradient: "from-yellow-500 to-orange-600",
                      difficulty: "BEGINNER",
                      players: "1.9M+"
                    },
                    {
                      id: "A2",
                      title: "A1 + A2 MIXED", 
                      subtitle: "FULL A-LEVEL",
                      icon: "🔬",
                      gradient: "from-purple-500 to-pink-600",
                      difficulty: "EXPERT",
                      players: "845K+"
                    },
                    {
                      id: "A2_ONLY",
                      title: "A2 ONLY",
                      subtitle: "ADVANCED",
                      icon: "⚛️",
                      gradient: "from-blue-500 to-indigo-600",
                      difficulty: "ADVANCED",
                      players: "1.2M+"
                    }
                  ].map((mode, index) => (
                    <motion.div
                      key={mode.id}
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                      className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:border-white/40 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                      onClick={() => onStartPhysicsBattle(mode.id as any)}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-2xl">{mode.icon}</div>
                          <div className={`px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${mode.gradient} text-white`}>
                            {mode.difficulty}
                          </div>
                        </div>
                        
                        <h4 className="text-lg font-bold text-white mb-1">{mode.title}</h4>
                        <p className="text-sm text-white/60 mb-3">{mode.subtitle}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                            <span className="text-xs text-white/60">{mode.players}</span>
                          </div>
                          <button className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors">
                            <Play className="w-3 h-3 text-white" />
                            <span className="text-xs font-semibold text-white">PLAY</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Section - Battle Pass & Activities */}
            <div className="w-96 p-8 space-y-6">
              {/* Battle Pass */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 border border-blue-300"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center text-white font-bold">
                    22
                  </div>
                  <span className="text-white font-bold">BATTLE PASS</span>
                </div>
                <div className="w-full h-16 bg-black/30 rounded-lg"></div>
              </motion.div>

              {/* Challenges */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-bold">CHALLENGES</span>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white" />
                    <span className="text-white text-sm">3/5</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-white/20 rounded-full">
                    <div className="h-full w-3/5 bg-green-400 rounded-full"></div>
                  </div>
                </div>
              </motion.div>

              {/* Activity */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-bold">ACTIVITY</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg"></div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">Daily Challenge</p>
                      <p className="text-white/60 text-xs">Solve 5 problems</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg"></div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">Weekly Goal</p>
                      <p className="text-white/60 text-xs">Win 3 battles</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Performance Stats */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-white/20"
              >
                <h4 className="text-white font-bold mb-4">PERFORMANCE</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/70 text-sm">Win Streak</span>
                    <span className="text-green-400 font-bold">{userData.winStreak}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70 text-sm">Total Matches</span>
                    <span className="text-white font-bold">{userData.totalMatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70 text-sm">Current Rank</span>
                    <RankBadge rank={userData.currentRank} size="sm" />
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}

        {selectedTab !== "PLAY" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-4xl font-bold mb-4 text-white">Coming Soon</h3>
              <p className="text-xl text-white/80">{selectedTab} section is under development</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;