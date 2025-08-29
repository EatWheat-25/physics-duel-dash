import React from 'react';
import { motion } from 'framer-motion';
import { Settings, LogOut, Edit, Play, Users, Target } from 'lucide-react';
import AnimatedBackground from './AnimatedBackground';

interface DashboardProps {
  onStartBattle: () => void;
  user: {
    username: string;
    rank: string;
    progress: number;
    winStreak: number;
    totalMatches: number;
    accuracy: number;
    avatar?: string;
  };
}

const rankEmojis = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
  Platinum: '💎',
  Diamond: '💠',
};

const Dashboard: React.FC<DashboardProps> = ({ onStartBattle, user }) => {
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
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-2xl font-bold">
                {user.avatar || user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{user.username}</h2>
                  <button className="p-1 rounded-md hover:bg-white/20 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <div className="rank-badge">
                  {rankEmojis[user.rank as keyof typeof rankEmojis]} {user.rank}
                </div>
              </div>
            </div>

            {/* Rank Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Rank Progress</span>
                <span>{user.progress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${user.progress}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  style={{ boxShadow: 'var(--shadow-cyan-glow)' }}
                />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <div className="stat-number">{user.winStreak}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Win Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{user.totalMatches}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Matches</div>
            </div>
            <div className="stat-card col-span-2">
              <div className="stat-number">{user.accuracy}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Accuracy</div>
            </div>
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
            <h2 className="text-4xl font-bold mb-2">Ready for Battle?</h2>
            <p className="text-muted-foreground text-lg max-w-md">
              Test your A-Level Physics knowledge in intense 1v1 battles. 
              Push the tug-of-war bar to victory!
            </p>
          </div>

          {/* Play Options */}
          <div className="space-y-4 w-full max-w-md">
            <motion.button
              onClick={onStartBattle}
              className="valorant-button w-full py-6 text-lg flex items-center justify-center gap-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-6 h-6" />
              1v1 Battle
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