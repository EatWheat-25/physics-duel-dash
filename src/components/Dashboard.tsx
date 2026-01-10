import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Play, Users, Target, BookOpen, Trophy, Star, ChevronRight, Zap, Cpu, Brain, Rocket, Shield, Activity, LogOut, User } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import SpaceBackground from './SpaceBackground';
import RankBadge from './RankBadge';
import CharacterAvatar from './CharacterAvatar';
import CharacterSelection from './CharacterSelection';
import FortniteStyleShowcase from './FortniteStyleShowcase';
import { useCharacter } from '@/hooks/useCharacter';
import { UserRankData, getRankByPoints } from '@/types/ranking';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const { selectedCharacter, setCharacterSelectionOpen } = useCharacter();
  const { signOut } = useAuth();
  const currentRank = getRankByPoints(userData.currentPoints);
  
  const selectedSubject = searchParams.get('subject');
  const selectedMode = searchParams.get('mode');

  const handleStartSelectedMode = () => {
    if (selectedSubject && selectedMode) {
      // INSTANT START - NO DELAYS
      if (selectedSubject === 'math') {
        navigate('/battle', { state: { subject: 'math', chapter: selectedMode } });
      } else {
        navigate('/physics-battle', { state: { subject: 'physics', chapter: selectedMode } });
      }
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
      {/* Space Background */}
      <SpaceBackground />

      {/* White Navigation Header */}
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 mx-4 mt-4 px-8 py-4 rounded-[3rem] backdrop-blur-xl bg-white/10 border border-white/20"
        style={{ 
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
      >
        <div className="flex items-end justify-between relative">
          {/* Logo */}
          <div className="flex items-end gap-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-white font-bold" />
              </div>
              <h1
                className="text-3xl font-black text-white leading-none"
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                BATTLE NERDS
              </h1>
            </motion.div>
          
            {/* Navigation */}
            <div className="flex items-center gap-2">
              {mainMenuItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedTab(item.id)}
                  className={`px-5 py-2.5 text-sm font-black uppercase tracking-wider transition-all duration-300 rounded-2xl relative overflow-hidden ${
                    selectedTab === item.id 
                      ? 'text-gray-900 bg-white' 
                      : 'text-white hover:text-gray-900 hover:bg-white/90'
                  }`}
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                >
                  <span className="relative z-10">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </div>


          {/* User Stats */}
          <div className="flex items-center gap-6">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <motion.div 
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/20 backdrop-blur-sm"
              >
                <Trophy className="w-5 h-5 text-white" />
                <span className="font-black text-white text-base">{userData.currentPoints}</span>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/20 backdrop-blur-sm"
              >
                <Target className="w-5 h-5 text-white" />
                <span className="font-black text-white text-base">{userData.accuracy}%</span>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/20 backdrop-blur-sm"
              >
                <Zap className="w-5 h-5 text-white" />
                <span className="font-black text-white text-base">{userData.winStreak}</span>
              </motion.div>
            </div>
            
            {/* Character Avatar */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="relative"
            >
              <CharacterAvatar 
                character={selectedCharacter} 
                size="sm" 
                onClick={() => setCharacterSelectionOpen(true)}
              />
            </motion.div>
            
            {/* User Info */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/20 backdrop-blur-sm"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center text-base font-black text-white">
                {userData.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-white font-black text-base">{userData.username}</span>
            </motion.div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-3 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all duration-300"
                >
                  <Settings className="w-6 h-6 text-white" />
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      {/* Revolutionary Main Interface */}
      <div className="relative z-10 flex min-h-[calc(100vh-120px)]">
        {selectedTab === "PLAY" && (
          <>
            {/* Left Command Panel */}
            <div className="w-96 p-6">
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="max-w-md space-y-6"
              >
                {/* Mode Selection Panel */}
                {selectedSubject && selectedMode ? (
                  <Link to="/modes">
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-6 cursor-pointer group rounded-3xl border-2 border-white/50 backdrop-blur-xl bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4 flex-1">
                          <Target className="w-10 h-10 text-white" />
                          <h3 className="text-2xl font-black text-white uppercase tracking-wider">{selectedSubject} :: {selectedMode.replace('_', ' ')}</h3>
                        </div>
                        <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      <div className="text-xs text-white uppercase tracking-wider text-center">
                        ◦ CLICK TO CHANGE ◦
                      </div>
                    </motion.div>
                  </Link>
                ) : (
                  <Link to="/modes">
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-6 cursor-pointer group rounded-xl border-2 border-white/30 backdrop-blur-sm"
                      style={{ backgroundColor: 'rgba(15, 15, 25, 0.95)' }}
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="relative">
                          <BookOpen className="w-10 h-10 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1">SELECT PROTOCOL</h3>
                          <p className="text-white text-sm font-bold uppercase tracking-wider">MATH :: PHYSICS</p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      <div className="relative h-32 rounded-xl overflow-hidden border border-white/20 mb-4 bg-white/5">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Rocket className="w-8 h-8 text-white mx-auto mb-2" />
                            <span className="text-white font-medium">Choose Your Path</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-white uppercase tracking-wider text-center">
                        ◦ CLICK TO SELECT ◦
                      </div>
                    </motion.div>
                  </Link>
                )}

                {/* Launch Button */}
                {selectedSubject && selectedMode ? (
                  <motion.button
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStartSelectedMode}
                    className="w-full py-6 text-xl font-bold relative group rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                  >
                    <div className="flex items-center justify-center gap-4">
                      <Play className="w-8 h-8" />
                      <span>START LESSON</span>
                    </div>
                  </motion.button>
                ) : (
                  <Link to="/modes">
                    <motion.button
                      initial={{ x: -100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full py-6 font-bold text-xl rounded-xl border-2 border-primary/50 backdrop-blur-sm text-white hover:bg-primary/10 transition-all duration-300 flex items-center justify-center gap-4"
                      style={{ fontFamily: 'Roboto, sans-serif', backgroundColor: 'rgba(15, 15, 25, 0.95)' }}
                    >
                      <BookOpen className="w-8 h-8" />
                      <span>SELECT PROTOCOL</span>
                    </motion.button>
                  </Link>
                )}
              </motion.div>
            </div>

            {/* Center Section - Character Showcase */}
            <FortniteStyleShowcase 
              character={selectedCharacter} 
              onCharacterClick={() => setCharacterSelectionOpen(true)}
            />

            {/* Right Command Center */}
            <div className="w-96 p-6 space-y-6">
              {/* Progress Tracker */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="p-8 rounded-3xl border-2 border-white/50 backdrop-blur-xl bg-white/10"
              >
                <h4 className="text-2xl font-black text-white mb-6 uppercase tracking-wider">PROGRESS TRACKER</h4>
                
                {/* Subject Progress with Ranks */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/10 border border-white/20">
                    <span className="text-white font-bold text-sm uppercase">Math</span>
                    <span className="text-xs text-white/60">• {currentRank.displayName}</span>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/10 border border-white/20">
                    <span className="text-white font-bold text-sm uppercase">Physics</span>
                    <span className="text-xs text-white/60">• {currentRank.displayName}</span>
                  </div>
                </div>
              </motion.div>



              {/* Analytics */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="p-6 rounded-3xl border-2 border-white/50 backdrop-blur-xl bg-white/10"
              >
                <h4 className="text-2xl font-black text-white mb-6 uppercase tracking-wider">ANALYTICS</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-white/10 border border-white/20">
                    <div className="text-2xl font-bold text-white mb-1">{userData.winStreak}</div>
                    <div className="text-xs text-white/70 uppercase tracking-wider">Streak</div>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-white/10 border border-white/20">
                    <div className="text-2xl font-bold text-white mb-1">{userData.totalMatches}</div>
                    <div className="text-xs text-white/70 uppercase tracking-wider">Battles</div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 rounded-lg bg-white/10 border border-white/20 flex items-center justify-between">
                  <span className="text-white/70 text-sm font-medium">Current Rank</span>
                  <RankBadge rank={userData.currentRank} size="sm" />
                </div>
              </motion.div>
            </div>
          </>
        )}

        {selectedTab !== "PLAY" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-4xl font-bold mb-4 text-white">Coming Soon</h3>
              <p className="text-xl text-white/70">{selectedTab} section is under development</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Character Selection Modal */}
      <CharacterSelection />
    </div>
  );
};

export default Dashboard;