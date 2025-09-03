import React from 'react';
import { motion } from 'framer-motion';
import { Settings, LogOut, Edit, Play, Users, Target, BookOpen, Zap } from 'lucide-react';
import AnimatedBackground from './AnimatedBackground';
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
      <AnimatedBackground />
      
      {/* Top Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-6">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
        >
          A-Level Battle Arena
        </motion.h1>
        
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
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
          <div className="valorant-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-2xl font-bold">
                {userData.avatar || userData.username.charAt(0).toUpperCase()}
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
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Win Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{userData.totalMatches}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Matches</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{userData.wins}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Wins</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{userData.accuracy}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Accuracy</div>
            </div>
          </div>

          {/* Rank History */}
          <div className="valorant-card p-4">
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
            <h2 className="text-4xl font-bold mb-2">Choose Your Path</h2>
            <p className="text-muted-foreground text-lg max-w-md">
              Master A-Level Physics through competitive battles or structured learning
            </p>
          </div>

          {/* Game Mode Options */}
          <div className="space-y-4 w-full max-w-2xl">
            {/* Physics Study Mode */}
            <motion.button
              onClick={onSelectPhysicsMode}
              className="valorant-button w-full py-6 text-lg flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-accent"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <BookOpen className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold">Physics Study Mode</div>
                <div className="text-sm opacity-80">A1 & A2 • Chapter Progression • Rank-based Unlocks</div>
              </div>
              {userData.currentRank.tier === 'Sigma' && (
                <Zap className="w-6 h-6 text-yellow-400 animate-pulse" />
              )}
            </motion.button>

            {/* Battle Mode */}
            <motion.button
              onClick={onStartBattle}
              className="valorant-button w-full py-6 text-lg flex items-center justify-center gap-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold">1v1 Battle Arena</div>
                <div className="text-sm opacity-80">Competitive • Quick Match • Ranked</div>
              </div>
            </motion.button>

            <div className="grid grid-cols-2 gap-4">
              <button className="valorant-button-accent flex items-center justify-center gap-2 py-4">
                <Target className="w-5 h-5" />
                Practice
              </button>
              <button className="valorant-button-accent flex items-center justify-center gap-2 py-4">
                <Users className="w-5 h-5" />
                Guest Play
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;