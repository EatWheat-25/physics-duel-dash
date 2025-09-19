import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, LogOut, Play, Users, Target, BookOpen, Trophy, Star, ChevronRight, User, Bell } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const selectedSubject = searchParams.get('subject');
  const selectedMode = searchParams.get('mode');

  const handleStartSelectedMode = () => {
    if (selectedSubject && selectedMode) {
      navigate('/matchmaking', { 
        state: { 
          subject: selectedSubject, 
          mode: selectedMode 
        } 
      });
    }
  };

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
            {/* Left Section - Game Mode Selection */}
            <div className="flex-1 p-8">
              <div className="max-w-md">
                {/* Modes Selection Card */}
                {selectedSubject && selectedMode ? (
                  <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="mb-6 p-6 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-300"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <Target className="w-8 h-8 text-white" />
                      <div>
                        <h3 className="text-xl font-bold text-white">SELECTED MODE</h3>
                        <p className="text-white/80 text-sm">{selectedSubject.toUpperCase()} - {selectedMode.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="w-full h-24 bg-black/20 rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-white font-medium">Ready to Battle!</span>
                    </div>
                  </motion.div>
                ) : (
                  <Link to="/modes">
                    <motion.div
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.6 }}
                      className="mb-6 p-6 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 border-2 border-yellow-300 cursor-pointer hover:scale-105 transition-transform duration-200"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <BookOpen className="w-8 h-8 text-white" />
                        <div>
                          <h3 className="text-xl font-bold text-white">MODES</h3>
                          <p className="text-white/80 text-sm">Choose Math or Physics</p>
                        </div>
                      </div>
                      <div className="w-full h-24 bg-black/20 rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-white/60 text-sm">Select Your Battle Mode</span>
                      </div>
                    </motion.div>
                  </Link>
                )}

                {/* Start Button */}
                {selectedSubject && selectedMode ? (
                  <motion.button
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStartSelectedMode}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-lime-400 text-black font-bold text-xl rounded-lg border-2 border-lime-300 hover:from-green-400 hover:to-lime-300 transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    <Play className="w-6 h-6" />
                    START BATTLE
                  </motion.button>
                ) : (
                    <Link to="/modes">
                      <motion.button
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-xl rounded-lg border-2 border-blue-300 hover:from-blue-400 hover:to-purple-400 transition-all duration-200 flex items-center justify-center gap-3"
                      >
                        <Play className="w-6 h-6" />
                        START
                      </motion.button>
                    </Link>
                )}
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