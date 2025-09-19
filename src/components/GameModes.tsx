import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

interface GameMode {
  id: string;
  title: string;
  description: string;
  isLimited?: boolean;
  requiresLevel?: number;
  backgroundImage: string;
  gradient: string;
}

const GameModes: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Lobby');

  const navigationTabs = ['Lobby', 'Arsenal', 'Store', 'Shard Card', 'Leaderboard'];

  const gameModes: GameMode[] = [
    {
      id: 'chaos-clash',
      title: 'CHAOS CLASH',
      description: 'Ultimate mayhem battle',
      gradient: 'from-red-500 via-orange-500 to-yellow-500',
      backgroundImage: 'linear-gradient(135deg, hsl(0 84% 60%), hsl(25 95% 63%))',
    },
    {
      id: 'custom-deathmatch',
      title: 'CUSTOM DEATHMATCH',
      description: 'Create your own rules',
      gradient: 'from-purple-500 via-pink-500 to-red-500',
      backgroundImage: 'linear-gradient(135deg, hsl(280 100% 56%), hsl(328 100% 50%))',
    },
    {
      id: 'outbreak',
      title: 'OUTBREAK',
      description: 'Survive the infection',
      gradient: 'from-green-400 via-emerald-500 to-teal-600',
      backgroundImage: 'linear-gradient(135deg, hsl(120 60% 50%), hsl(180 75% 45%))',
    },
    {
      id: 'gear-up',
      title: 'GEAR UP',
      description: 'Equipment-focused battles',
      isLimited: true,
      gradient: 'from-blue-500 via-cyan-500 to-teal-500',
      backgroundImage: 'linear-gradient(135deg, hsl(194 100% 50%), hsl(188 100% 50%))',
    },
    {
      id: 'prop-hunt',
      title: 'PROP HUNT',
      description: 'Hide and seek with a twist',
      isLimited: true,
      gradient: 'from-indigo-500 via-purple-500 to-pink-500',
      backgroundImage: 'linear-gradient(135deg, hsl(260 75% 50%), hsl(320 68% 62%))',
    },
    {
      id: 'standard',
      title: 'STANDARD',
      description: 'Classic ranked gameplay',
      requiresLevel: 15,
      gradient: 'from-yellow-400 via-orange-500 to-red-500',
      backgroundImage: 'linear-gradient(135deg, hsl(60 100% 50%), hsl(0 84% 60%))',
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl" 
             style={{ background: 'hsl(328 100% 50%)' }}></div>
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 rounded-full blur-3xl" 
             style={{ background: 'hsl(188 100% 50%)' }}></div>
        <div className="absolute top-2/3 left-2/3 w-64 h-64 rounded-full blur-3xl" 
             style={{ background: 'hsl(60 100% 50%)' }}></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navigation */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          {/* Navigation Tabs */}
          <div className="flex gap-8">
            {navigationTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-lg font-bold uppercase tracking-wider transition-all duration-300 relative ${
                  activeTab === tab
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-2 left-0 right-0 h-1 rounded-full"
                    style={{ background: 'hsl(328 100% 50%)' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* XP Bar */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-white/80">XP</span>
            <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r transition-all duration-1000"
                style={{ 
                  width: '0%',
                  background: 'linear-gradient(90deg, hsl(60 100% 50%), hsl(328 100% 50%))'
                }}
              ></div>
            </div>
            <span className="text-sm font-bold text-white">0%</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Mode Cards Grid */}
          <div className="flex-1 p-8">
            <div className="grid grid-cols-3 gap-6 max-w-6xl mx-auto">
              {gameModes.map((mode, index) => (
                <motion.div
                  key={mode.id}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`relative aspect-video rounded-2xl cursor-pointer overflow-hidden group transition-all duration-300 ${
                    selectedMode === mode.id ? 'ring-4 ring-white scale-105' : 'hover:scale-105'
                  }`}
                  style={{
                    background: mode.backgroundImage,
                  }}
                >
                  {/* Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  
                  {/* Content */}
                  <div className="absolute inset-0 p-6 flex flex-col justify-between">
                    {/* Top Labels */}
                    <div className="flex justify-between">
                      {mode.isLimited && (
                        <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                          LIMITED-TIME
                        </span>
                      )}
                      {mode.requiresLevel && (
                        <span className="px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
                          LEVEL {mode.requiresLevel}+
                        </span>
                      )}
                      {selectedMode === mode.id && (
                        <motion.span 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-4 py-2 bg-white text-black font-bold text-sm rounded-full"
                        >
                          SELECTED
                        </motion.span>
                      )}
                    </div>

                    {/* Mode Title */}
                    <div>
                      <h3 className="text-2xl font-black text-white mb-2 drop-shadow-lg">
                        {mode.title}
                      </h3>
                      <p className="text-white/80 text-sm font-medium">
                        {mode.description}
                      </p>
                    </div>
                  </div>

                  {/* Hover Glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                       style={{
                         background: `radial-gradient(circle at center, hsla(328, 100%, 50%, 0.2), transparent 70%)`,
                         boxShadow: '0 0 60px hsla(328, 100%, 50%, 0.3)'
                       }}></div>
                </motion.div>
              ))}
            </div>

            {/* Quick Play Bar */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-12 max-w-6xl mx-auto"
            >
              <div className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl p-6 text-center">
                <h4 className="text-2xl font-black text-black mb-2">QUICK PLAY</h4>
                <p className="text-black/80 font-medium">Jump into a match instantly</p>
              </div>
            </motion.div>

            {/* Start Button */}
            {selectedMode && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="flex justify-center mt-8"
              >
                <button className="px-12 py-4 bg-gradient-to-r from-pink-500 to-red-500 text-white font-black text-xl rounded-2xl hover:scale-105 transition-all duration-300 flex items-center gap-3 shadow-2xl"
                        style={{
                          background: 'linear-gradient(135deg, hsl(328 100% 50%), hsl(0 84% 60%))',
                          boxShadow: '0 0 40px hsla(328, 100%, 50%, 0.4)'
                        }}>
                  <Play className="w-6 h-6" />
                  START BATTLE
                </button>
              </motion.div>
            )}
          </div>

          {/* Side Panel - Shard Clash */}
          <div className="w-80 p-8 border-l border-white/10">
            <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 rounded-2xl p-6 h-full">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-black text-white mb-2">SHARD CLASH</h3>
                <p className="text-white/80 text-sm">Collect and battle with shards</p>
              </div>
              
              <div className="space-y-4">
                <div className="bg-black/30 rounded-xl p-4">
                  <h4 className="text-white font-bold mb-2">Next Event</h4>
                  <p className="text-white/70 text-sm">Starting in 2h 45m</p>
                </div>
                
                <div className="bg-black/30 rounded-xl p-4">
                  <h4 className="text-white font-bold mb-2">Rewards</h4>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-yellow-400 rounded-lg"></div>
                    <div className="w-8 h-8 bg-blue-400 rounded-lg"></div>
                    <div className="w-8 h-8 bg-purple-400 rounded-lg"></div>
                  </div>
                </div>
                
                <button className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors">
                  ENTER SHARD CLASH
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameModes;