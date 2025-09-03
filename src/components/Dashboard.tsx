import React from 'react';
import { motion } from 'framer-motion';
import { Settings, LogOut, Edit, Play, Users, Target, BookOpen, Zap, Swords, Trophy } from 'lucide-react';
import CyberBackground from './CyberBackground';
import RankBadge from './RankBadge';
import RankProgressBar from './RankProgressBar';
import RankHistory from './RankHistory';
import { UserRankData } from '@/types/ranking';

interface DashboardProps {
  onStartBattle: () => void;
  onSelectPhysicsMode: () => void;
  userData: UserRankData;
}

const Dashboard: React.FC<DashboardProps> = ({ onStartBattle, onSelectPhysicsMode, userData }) => {
  return (
    <div className="min-h-screen relative">
      <CyberBackground />
      
      {/* Top Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-6">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold"
          style={{
            background: 'var(--gradient-cyber)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 20px rgba(0, 229, 255, 0.3)'
          }}
        >
          A-LEVEL BATTLE ARENA
        </motion.h1>
        
        <div className="flex items-center gap-4">
          <button className="p-3 rounded-xl glassmorphism hover:bg-white/10 transition-all duration-300 group">
            <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
          <button className="p-3 rounded-xl glassmorphism hover:bg-red-500/20 transition-all duration-300">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="relative z-10 flex gap-8 p-6 max-w-7xl mx-auto">
        {/* Left Panel - Profile & Stats */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-80 space-y-6"
        >
          {/* Profile Card */}
          <div className="cyber-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold relative">
                <div 
                  className="absolute inset-0 rounded-full"
                  style={{ 
                    background: 'var(--gradient-cyber)',
                    boxShadow: 'var(--shadow-cyber-glow)'
                  }}
                />
                <span className="relative z-10" style={{ textShadow: '0 0 10px rgba(0, 0, 0, 0.8)' }}>
                  {userData.avatar || userData.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold">{userData.username}</h2>
                  <button className="p-1 rounded-md hover:bg-white/20 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <RankBadge rank={userData.currentRank} size="md" />
              </div>
            </div>

            {/* Rank Progress */}
            <RankProgressBar currentPoints={userData.currentPoints} showAnimation={true} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="stat-card">
              <div className="stat-number">{userData.winStreak}</div>
              <div className="stat-label">Win Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{userData.totalMatches}</div>
              <div className="stat-label">Total Matches</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{userData.wins}</div>
              <div className="stat-label">Wins</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{userData.accuracy}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
          </div>

          {/* Rank History */}
          <div className="cyber-card p-4">
            <RankHistory history={userData.history} />
          </div>
        </motion.div>

        {/* Right Panel - Main Content */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="flex-1 flex flex-col items-center justify-center space-y-8"
        >
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-bold mb-4" style={{
              background: 'var(--gradient-cyber)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Choose Your Path
            </h2>
            <p className="text-muted-foreground text-lg max-w-md">
              Master A-Level Physics through competitive battles or structured learning
            </p>
          </div>

          {/* Game Mode Options */}
          <div className="space-y-6 w-full max-w-2xl">
            {/* Physics Study Mode */}
            <motion.button
              onClick={onSelectPhysicsMode}
              className="cyber-button w-full py-8 text-lg flex items-center justify-between px-8"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-4">
                <BookOpen className="w-8 h-8" />
                <div className="text-left">
                  <div className="font-bold text-xl">Physics Study Mode</div>
                  <div className="text-sm opacity-80 font-normal">A1 & A2 • Chapter Progression • Rank-based Unlocks</div>
                </div>
              </div>
              {userData.currentRank.tier === 'Sigma' && (
                <Zap className="w-8 h-8 animate-pulse" style={{ color: 'hsl(var(--rank-sigma))' }} />
              )}
            </motion.button>

            {/* Battle Mode */}
            <motion.button
              onClick={onStartBattle}
              className="cyber-button-neon w-full py-8 text-lg flex items-center justify-between px-8"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-4">
                <Swords className="w-8 h-8" />
                <div className="text-left">
                  <div className="font-bold text-xl">1v1 Battle Arena</div>
                  <div className="text-sm opacity-80 font-normal">Competitive • Quick Match • Ranked</div>
                </div>
              </div>
              <Trophy className="w-8 h-8" />
            </motion.button>

            <div className="grid grid-cols-2 gap-6">
              <motion.button 
                className="cyber-button-neon flex items-center justify-center gap-3 py-6"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Target className="w-6 h-6" />
                Practice Mode
              </motion.button>
              <motion.button 
                className="glassmorphism flex items-center justify-center gap-3 py-6 px-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-white/10"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Users className="w-6 h-6" />
                Guest Play
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;