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
import { useIsAdmin } from '@/hooks/useUserRole';
import { Button } from './ui/button';
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
  const { isAdmin } = useIsAdmin();
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
    <div className="min-h-screen text-foreground overflow-hidden relative bg-background">
      {/* Removed Space Background for solid dark theme */}

      {/* Dark Navigation Header */}
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 mx-4 mt-4 px-8 py-4 rounded-3xl bg-card border border-border"
      >
        <div className="flex items-center justify-between relative">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-background font-bold" />
              </div>
              <h1 className="text-2xl font-black text-foreground tracking-tight" style={{ fontFamily: 'Roboto, sans-serif' }}>BATTLE NERDS</h1>
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
                  className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-xl relative overflow-hidden ${
                    selectedTab === item.id 
                      ? 'text-background bg-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
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
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border"
              >
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-foreground text-sm">{userData.currentPoints}</span>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border"
              >
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-foreground text-sm">{userData.accuracy}%</span>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border"
              >
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-foreground text-sm">{userData.winStreak}</span>
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
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-muted border border-border"
            >
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-black text-background">
                {userData.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-foreground font-bold text-xs leading-tight">no</span>
                <span className="text-foreground font-bold text-xs leading-tight">brrainer</span>
              </div>
            </motion.div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button 
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/80 border border-border transition-all duration-300"
                >
                  <Settings className="w-5 h-5 text-foreground" />
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
            
            {isAdmin && (
              <Button
                onClick={() => navigate('/admin/questions')}
                variant="default"
                size="sm"
                className="ml-2 text-white"
              >
                Admin Dashboard
              </Button>
            )}
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
                      className="p-6 cursor-pointer group rounded-2xl border border-border bg-card"
                    >
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <Target className="w-8 h-8 text-foreground" />
                          <h3 className="text-lg font-bold text-foreground uppercase tracking-wide">{selectedSubject} :: {selectedMode.replace('_', ' ')}</h3>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      <div className="text-xs text-muted-foreground uppercase tracking-wider text-center">
                        ◦ CLICK TO CHANGE ◦
                      </div>
                    </motion.div>
                  </Link>
                ) : (
                  <Link to="/modes">
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-6 cursor-pointer group rounded-2xl border border-border bg-card"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="relative">
                          <BookOpen className="w-8 h-8 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-foreground mb-1">SELECT PROTOCOL</h3>
                          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">MATH :: PHYSICS</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      <div className="relative h-32 rounded-xl overflow-hidden border border-border mb-4 bg-muted/50">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Rocket className="w-8 h-8 text-foreground mx-auto mb-2" />
                            <span className="text-foreground font-medium">Choose Your Path</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground uppercase tracking-wider text-center">
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
                    className="w-full py-5 text-lg font-bold relative group rounded-xl bg-accent text-background hover:bg-accent/90 transition-colors"
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
                      className="w-full py-5 font-bold text-lg rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all duration-300 flex items-center justify-center gap-4"
                      style={{ fontFamily: 'Roboto, sans-serif' }}
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
                className="p-6 rounded-2xl border border-border bg-card"
              >
                <h4 className="text-xl font-bold text-foreground mb-6 uppercase tracking-wide">PROGRESS TRACKER</h4>
                
                {/* Subject Progress with Ranks */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                    <span className="text-foreground font-bold text-sm uppercase">MATH</span>
                    <span className="text-xs text-muted-foreground">• {currentRank.displayName}</span>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                    <span className="text-foreground font-bold text-sm uppercase">PHYSICS</span>
                    <span className="text-xs text-muted-foreground">• {currentRank.displayName}</span>
                  </div>
                </div>
              </motion.div>



              {/* Analytics */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="p-6 rounded-2xl border border-border bg-card"
              >
                <h4 className="text-xl font-bold text-foreground mb-6 uppercase tracking-wide">ANALYTICS</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted border border-border">
                    <div className="text-2xl font-bold text-foreground mb-1">{userData.winStreak}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">STREAK</div>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-muted border border-border">
                    <div className="text-2xl font-bold text-foreground mb-1">{userData.totalMatches}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">BATTLES</div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 rounded-lg bg-muted border border-border flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Current Rank</span>
                  <RankBadge rank={userData.currentRank} size="sm" />
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
      
      {/* Character Selection Modal */}
      <CharacterSelection />
    </div>
  );
};

export default Dashboard;