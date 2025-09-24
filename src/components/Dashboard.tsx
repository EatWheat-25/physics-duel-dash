import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Play, Users, Target, BookOpen, Trophy, Star, ChevronRight, Zap, Cpu, Brain, Rocket, Shield, Activity } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import CyberpunkBackground from './CyberpunkBackground';
import RankBadge from './RankBadge';
import CharacterAvatar from './CharacterAvatar';
import CharacterSelection from './CharacterSelection';
import FortniteStyleShowcase from './FortniteStyleShowcase';
import { useCharacter } from '@/hooks/useCharacter';
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
  const { selectedCharacter, setCharacterSelectionOpen } = useCharacter();
  
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
      {/* Next-Gen Cyberpunk Background */}
      <CyberpunkBackground />

      {/* Ultra-Tech Navigation Header */}
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 cyber-panel mx-4 mt-4 px-8 py-4 border-0"
        style={{ 
          background: 'var(--panel-bg)',
          borderBottom: '2px solid var(--panel-border)'
        }}
      >
        <div className="flex items-center justify-between">
          {/* Futuristic Logo */}
          <div className="flex items-center gap-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Cpu className="w-6 h-6 text-background font-bold" style={{ filter: 'var(--glow-primary)' }} />
              </div>
              <h1 className="text-2xl font-bold futuristic-heading">NEURAL ACADEMY</h1>
            </motion.div>
          
            {/* Holographic Navigation */}
            <div className="flex items-center gap-2">
              {mainMenuItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedTab(item.id)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-lg relative overflow-hidden ${
                    selectedTab === item.id 
                      ? 'text-primary bg-primary/10 border border-primary/30' 
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <span className="relative z-10">{item.label}</span>
                  {selectedTab === item.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary/20 border border-primary/50 rounded-lg"
                      style={{ boxShadow: '0 0 20px hsl(180, 100%, 50%, 0.3)' }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Enhanced User Stats */}
          <div className="flex items-center gap-6">
            {/* Glowing Stats */}
            <div className="flex items-center gap-6 text-sm">
              <motion.div 
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20"
              >
                <Trophy className="w-4 h-4 text-primary" style={{ filter: 'var(--glow-primary)' }} />
                <span className="font-bold text-primary">{userData.currentPoints}</span>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/10 border border-secondary/20"
              >
                <Target className="w-4 h-4 text-secondary" />
                <span className="font-bold text-secondary">{userData.accuracy}%</span>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20"
              >
                <Zap className="w-4 h-4 text-accent" />
                <span className="font-bold text-accent">{userData.winStreak}</span>
              </motion.div>
            </div>
            
            {/* Enhanced Character Avatar */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="relative"
            >
              <CharacterAvatar 
                character={selectedCharacter} 
                size="sm" 
                onClick={() => setCharacterSelectionOpen(true)}
              />
              <div className="absolute -inset-2 rounded-full border border-primary/30 animate-pulse opacity-50" />
            </motion.div>
            
            {/* Holographic User Info */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-sm font-bold text-background relative">
                {userData.username.charAt(0).toUpperCase()}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary to-secondary opacity-20 blur-sm" />
              </div>
              <span className="text-foreground font-bold">{userData.username}</span>
            </motion.div>
            
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 transition-all duration-300"
            >
              <Settings className="w-5 h-5 text-secondary" />
            </motion.button>
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
                {/* Enhanced Mode Selection Panel */}
                {selectedSubject && selectedMode ? (
                  <Link to="/modes">
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="cyber-panel p-6 cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="relative">
                          <Target className="w-10 h-10 text-primary" style={{ filter: 'var(--glow-primary)' }} />
                          <motion.div
                            className="absolute -inset-2 rounded-full border border-primary/30"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold futuristic-heading mb-1">COMBAT MODE ACTIVE</h3>
                          <p className="text-primary text-sm font-bold uppercase tracking-wider">{selectedSubject} :: {selectedMode.replace('_', ' ')}</p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-primary group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      <div className="relative h-32 rounded-xl overflow-hidden border border-primary/20 mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Brain className="w-8 h-8 text-primary mx-auto mb-2" />
                            <span className="text-foreground font-bold">NEURAL LINK ESTABLISHED</span>
                          </div>
                        </div>
                        
                        {/* Animated Tech Lines */}
                        <motion.div
                          className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
                          animate={{ scaleX: [0, 1, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                      
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        ◦ READY FOR DEPLOYMENT ◦
                      </div>
                    </motion.div>
                  </Link>
                ) : (
                  <Link to="/modes">
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="cyber-panel p-6 cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="relative">
                          <BookOpen className="w-10 h-10 text-accent" />
                          <motion.div
                            className="absolute -inset-2 rounded-full border border-accent/30"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold futuristic-heading mb-1">SELECT PROTOCOL</h3>
                          <p className="text-accent text-sm font-bold uppercase tracking-wider">MATH :: PHYSICS</p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-accent group-hover:translate-x-1 transition-transform" />
                      </div>
                      
                      <div className="relative h-32 rounded-xl overflow-hidden border border-accent/20 mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-primary/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Rocket className="w-8 h-8 text-accent mx-auto mb-2" />
                            <span className="text-muted-foreground font-medium">Initialize Combat Systems</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        ◦ AWAITING SELECTION ◦
                      </div>
                    </motion.div>
                  </Link>
                )}

                {/* Ultra-Tech Launch Button */}
                {selectedSubject && selectedMode ? (
                  <motion.button
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStartSelectedMode}
                    className="w-full cyber-button py-6 text-xl relative group"
                  >
                    <div className="flex items-center justify-center gap-4">
                      <Play className="w-8 h-8" />
                      <span>INITIATE COMBAT</span>
                      <Shield className="w-8 h-8" />
                    </div>
                    
                    {/* Animated Border Effect */}
                    <motion.div
                      className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary via-secondary to-accent opacity-0 group-hover:opacity-30 blur-sm"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    />
                  </motion.button>
                ) : (
                  <Link to="/modes">
                    <motion.button
                      initial={{ x: -100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full py-6 bg-gradient-to-r from-secondary/20 to-accent/20 text-secondary-foreground font-bold text-xl rounded-xl border-2 border-secondary/30 hover:border-secondary/50 transition-all duration-300 flex items-center justify-center gap-4 relative overflow-hidden"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      <Cpu className="w-8 h-8" />
                      <span>ACTIVATE SYSTEMS</span>
                      
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary/10 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      />
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
              {/* Neural Progress Tracker */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="cyber-panel p-6 relative overflow-hidden"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-background font-bold text-lg">
                      22
                    </div>
                    <motion.div
                      className="absolute -inset-2 rounded-xl border border-primary/30"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold futuristic-heading">NEURAL PROGRESS</h4>
                    <p className="text-primary text-sm font-medium">Level 22 • Elite Protocol</p>
                  </div>
                </div>
                
                <div className="relative h-20 rounded-xl bg-gradient-to-r from-background/50 to-primary/10 border border-primary/20 overflow-hidden">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-primary/30 to-secondary/30"
                    initial={{ width: 0 }}
                    animate={{ width: '78%' }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-xl font-bold text-foreground">78%</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">COMPLETION</div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Combat Objectives */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="cyber-panel p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-8 h-8 text-accent" style={{ filter: 'var(--glow-accent)' }} />
                  <div>
                    <h4 className="text-lg font-bold futuristic-heading">OBJECTIVES</h4>
                    <p className="text-accent text-sm">Combat Missions</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-lg bg-accent/10 border border-accent/20">
                    <Users className="w-4 h-4 text-accent" />
                    <span className="text-accent font-bold text-sm">3/5</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <div className="flex-1">
                      <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-primary to-secondary"
                          initial={{ width: 0 }}
                          animate={{ width: '60%' }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                    <span className="text-primary font-bold text-xs">60%</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                    <div className="flex-1">
                      <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-secondary to-accent"
                          initial={{ width: 0 }}
                          animate={{ width: '85%' }}
                          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                    </div>
                    <span className="text-secondary font-bold text-xs">85%</span>
                  </div>
                </div>
              </motion.div>

              {/* Mission Intel */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="cyber-panel p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Activity className="w-8 h-8 text-accent" />
                  <h4 className="text-lg font-bold futuristic-heading">MISSION INTEL</h4>
                </div>
                
                <div className="space-y-4">
                  <motion.div 
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-background" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-foreground text-sm">Neural Sync</p>
                      <p className="text-muted-foreground text-xs">Solve 5 complex equations</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </motion.div>
                  
                  <motion.div 
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 p-3 rounded-lg bg-secondary/5 border border-secondary/20 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-background" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-foreground text-sm">Combat Streak</p>
                      <p className="text-muted-foreground text-xs">Win 3 consecutive battles</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Performance Analytics */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="cyber-panel p-6"
              >
                <h4 className="text-lg font-bold futuristic-heading mb-6">COMBAT ANALYTICS</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-2xl font-bold text-primary mb-1">{userData.winStreak}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Streak</div>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                    <div className="text-2xl font-bold text-secondary mb-1">{userData.totalMatches}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Battles</div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-between">
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