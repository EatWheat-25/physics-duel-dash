import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Starfield } from '@/components/Starfield';
import { PlayerCard } from '@/components/PlayerCard';
import { useAuth } from '@/contexts/AuthContext';
import { Settings } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'FRAGPUNK | Lobby';
  }, []);

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white font-sans overflow-hidden relative">
      <Starfield />
      
      {/* Top Navigation Bar */}
      <header className="relative z-30 w-full border-b border-white/10 bg-[#1e1e1e]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold tracking-wider">FRAGPUNK</div>
          
          <nav className="flex items-center gap-8">
            <a href="#" className="text-green-500 border-b-2 border-green-500 pb-1 text-sm font-medium uppercase tracking-wider">LOBBY</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">ARSENAL</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider relative">
              STORE
              <span className="absolute -top-1 -right-2 w-2 h-2 bg-orange-500 rounded-full" />
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">SHARD CARD</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">LEADERBOARD</a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded hover:bg-white/5 transition-colors">
              <Settings className="w-5 h-5 text-white/60" />
            </button>
            <div className="px-4 py-2 bg-blue-600 rounded text-sm font-medium">M Maniac LV. 12</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          
          {/* Left Sidebar */}
          <aside className="col-span-3 space-y-3">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-white/5 border-l-4 border-green-500 rounded-lg p-4 relative cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" />
              <div className="text-xs text-white/50 mb-1">Selected Mode</div>
              <div className="text-green-500 font-bold uppercase">UNRATED</div>
            </motion.div>
            
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border-l-4 border-blue-500 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div className="text-xs text-white/50 mb-1">Grade Selected</div>
              <div className="text-white font-medium">PLATINUM I</div>
            </motion.div>
            
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 border-l-4 border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <div className="text-xs text-white/50 mb-1">Review Last Game</div>
              <div className="text-white font-medium">VICTORY</div>
            </motion.div>
          </aside>

          {/* Center - Player Card */}
          <div className="col-span-6 flex flex-col items-center justify-center">
            {user && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
              >
                <PlayerCard playerId={user.id} isCurrentUser={true} />
              </motion.div>
            )}
          </div>

          {/* Right Sidebar - Match Info */}
          <aside className="col-span-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">MISSION DATA</div>
              <div className="space-y-2 text-xs font-mono text-white/60">
                <div className="flex justify-between">
                  <span>STATUS:</span>
                  <span className="text-green-500">READY</span>
                </div>
                <div className="flex justify-between">
                  <span>QUEUE:</span>
                  <span className="text-white">0 PLAYERS</span>
                </div>
                <div className="flex justify-between">
                  <span>REGION:</span>
                  <span className="text-white">AUTO</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1e1e1e]/80 backdrop-blur-md border-t border-white/10 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider"
            >
              PRACTICE
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider"
            >
              MODULES
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/matchmaking-new')}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors text-sm uppercase tracking-wider shadow-lg shadow-green-500/20"
            >
              BATTLE!
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider"
            >
              PROGRESSION
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider"
            >
              SHOP
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}