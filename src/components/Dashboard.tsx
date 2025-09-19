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
      {/* Beautiful Premium Background */}
      <div className="premium-grid"></div>
      
      {/* Subtle floating elements */}
      <div className="floating-element floating-blue w-32 h-32 top-1/4 left-1/4" style={{ animationDelay: '0s' }}></div>
      <div className="floating-element floating-purple w-24 h-24 top-3/4 right-1/3" style={{ animationDelay: '4s' }}></div>
      <div className="floating-element floating-blue w-28 h-28 bottom-1/4 right-1/4" style={{ animationDelay: '2s' }}></div>

      {/* Top Navigation Bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-6 bg-white/80 backdrop-blur-sm border-b border-border shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-foreground">BATTLE ARENA</h1>
          
          {/* Navigation Items */}
          <div className="flex items-center gap-6">
            {mainMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedTab(item.id)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  selectedTab === item.id 
                    ? 'text-accent-blue border-b-2 border-accent-blue' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* User Info & Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm text-foreground">
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-accent-amber" />
              <span>{userData.currentPoints}</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4 text-accent-emerald" />
              <span>{userData.accuracy}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-accent-blue to-accent-purple flex items-center justify-center text-sm font-bold text-white">
              {userData.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-foreground font-medium">{userData.username}</span>
          </div>
          
          <button className="p-2 hover:bg-grey-100 rounded transition-colors">
            <Settings className="w-5 h-5 text-foreground" />
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
                    className="mb-6 premium-card p-6 bg-gradient-to-r from-accent-emerald/10 to-accent-blue/10 border-accent-emerald/20"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <Target className="w-8 h-8 text-accent-emerald" />
                      <div>
                        <h3 className="text-xl font-bold text-foreground">SELECTED MODE</h3>
                        <p className="text-muted-foreground text-sm">{selectedSubject.toUpperCase()} - {selectedMode.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="w-full h-24 bg-grey-100 rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-foreground font-medium">Ready to Battle!</span>
                    </div>
                  </motion.div>
                ) : (
                  <Link to="/modes">
                    <motion.div
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.6 }}
                      className="mb-6 premium-card p-6 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 border-accent-blue/20 cursor-pointer hover:scale-105 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <BookOpen className="w-8 h-8 text-accent-blue" />
                        <div>
                          <h3 className="text-xl font-bold text-foreground">MODES</h3>
                          <p className="text-muted-foreground text-sm">Choose Math or Physics</p>
                        </div>
                      </div>
                      <div className="w-full h-24 bg-grey-100 rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">Select Your Battle Mode</span>
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
                    className="w-full py-4 premium-button bg-gradient-to-r from-accent-emerald to-accent-blue text-white font-bold text-xl rounded-lg hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-3"
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
                      className="w-full py-4 premium-button bg-gradient-to-r from-accent-blue to-accent-purple text-white font-bold text-xl rounded-lg hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-3"
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
                className="premium-card bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 p-6 border-accent-blue/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-accent-blue/20 rounded flex items-center justify-center text-accent-blue font-bold">
                    22
                  </div>
                  <span className="text-foreground font-bold">BATTLE PASS</span>
                </div>
                <div className="w-full h-16 bg-grey-100 rounded-lg"></div>
              </motion.div>

              {/* Challenges */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="premium-card p-6 bg-white/60"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-foreground font-bold">CHALLENGES</span>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground text-sm">3/5</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-grey-200 rounded-full">
                    <div className="h-full w-3/5 bg-accent-emerald rounded-full"></div>
                  </div>
                </div>
              </motion.div>

              {/* Activity */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="premium-card p-6 bg-white/60"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Star className="w-5 h-5 text-accent-amber" />
                  <span className="text-foreground font-bold">ACTIVITY</span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-accent-amber/20 to-accent-amber/10 rounded-lg flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-accent-amber" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground text-sm font-medium">Daily Challenge</p>
                      <p className="text-muted-foreground text-xs">Solve 5 problems</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-accent-purple/20 to-accent-blue/10 rounded-lg flex items-center justify-center">
                      <Target className="w-6 h-6 text-accent-purple" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground text-sm font-medium">Weekly Goal</p>
                      <p className="text-muted-foreground text-xs">Win 3 battles</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Performance Stats */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="premium-card p-6 bg-white/60"
              >
                <h4 className="text-foreground font-bold mb-4">PERFORMANCE</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Win Streak</span>
                    <span className="text-accent-emerald font-bold">{userData.winStreak}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Total Matches</span>
                    <span className="text-foreground font-bold">{userData.totalMatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Current Rank</span>
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
              <h3 className="text-4xl font-bold mb-4 text-foreground">Coming Soon</h3>
              <p className="text-xl text-muted-foreground">{selectedTab} section is under development</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;