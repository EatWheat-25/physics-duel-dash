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

      <div className="relative z-10 flex flex-col md:flex-row gap-6 p-6 max-w-7xl mx-auto">
        {/* Compact Left Sidebar - Player Summary */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full md:w-80 md:max-w-80"
        >
          {/* Compact Player Summary Card */}
          <div className="glassmorphism rounded-2xl p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 max-h-64">
            {/* Avatar + Username + Rank */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold bg-gradient-to-br from-primary/20 to-primary/40 border border-primary/20">
                <span className="text-primary">
                  {userData.avatar || userData.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold truncate">{userData.username}</h3>
                <div className="mt-1">
                  <RankBadge rank={userData.currentRank} size="sm" />
                </div>
              </div>
            </div>

            {/* Thin Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{userData.currentPoints} / 100</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${userData.currentPoints}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>

            {/* Mini Stats Row */}
            <div className="flex items-center justify-between text-center">
              <div className="flex-1">
                <div className="text-lg font-bold">{userData.winStreak}</div>
                <div className="text-xs text-muted-foreground">Streak</div>
              </div>
              <div className="w-px h-8 bg-border mx-2" />
              <div className="flex-1">
                <div className="text-lg font-bold">{userData.totalMatches}</div>
                <div className="text-xs text-muted-foreground">Matches</div>
              </div>
              <div className="w-px h-8 bg-border mx-2" />
              <div className="flex-1">
                <div className="text-lg font-bold">{userData.accuracy}%</div>
                <div className="text-xs text-muted-foreground">Accuracy</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Panel - Tile Dashboard */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="flex-1"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
            {/* Top Row - Quick Actions */}
            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Edit className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Profile</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Settings className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Settings</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trophy className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Recent Matches</span>
            </motion.button>

            <motion.button 
              onClick={onStartBattle}
              className="dashboard-tile-primary"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Swords className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Quick Play</span>
            </motion.button>

            {/* Study Tiles */}
            <motion.button 
              onClick={onSelectPhysicsMode}
              className="dashboard-tile-accent"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <BookOpen className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">A1 Ranked</span>
            </motion.button>

            <motion.button 
              onClick={onSelectPhysicsMode}
              className="dashboard-tile-accent"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <BookOpen className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">A2 Ranked</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Target className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Topic Drills</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Zap className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Weak Areas</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Custom Quiz</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <BookOpen className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Formulas</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trophy className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Daily Challenge</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trophy className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Leaderboards</span>
            </motion.button>

            {/* Battle/Social Tiles */}
            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Swords className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Create Room</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Join Code</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Users className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Friends</span>
            </motion.button>

            <motion.button 
              className="dashboard-tile-small"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-xs font-medium">Help</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;