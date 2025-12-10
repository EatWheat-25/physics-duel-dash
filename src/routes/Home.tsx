import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, Pencil, Crosshair, LayoutGrid, Swords, TrendingUp, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { getRankByPoints } from '@/types/ranking';

interface PlayerData {
  username: string;
  displayName: string | null;
  mmr: number;
  rank: { tier: string; subRank: number; displayName?: string };
  level: number;
}

export default function Home() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);

  useEffect(() => {
    document.title = 'Battle Nerds | Lobby';
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchPlayerData = async () => {
      try {
        const { data: player } = await supabase
          .from('players')
          .select('mmr')
          .eq('id', user.id)
          .single();

        if (player) {
          const mmr = player.mmr || 1000;
          const rank = getRankByPoints(mmr);
          const level = Math.floor(mmr / 100) + 1;

          setPlayerData({
            username: profile?.username || 'Player',
            displayName: profile?.display_name || profile?.username || 'Player',
            mmr,
            rank,
            level,
          });
        }
      } catch (error) {
        // Default data if fetch fails
        setPlayerData({
          username: profile?.username || 'Player',
          displayName: profile?.display_name || profile?.username || 'Player',
          mmr: 1000,
          rank: { tier: 'Diamond', subRank: 2 },
          level: 12,
        });
      }
    };

    fetchPlayerData();
  }, [user, profile]);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white font-sans overflow-hidden relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e]" />
      
      {/* Top Navigation Bar */}
      <header className="relative z-30 w-full">
        <div className="w-full px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold tracking-wider text-white">BATTLE NERDS</div>
          
          <nav className="flex items-center gap-10">
            <a href="#" className="relative text-white text-sm font-semibold uppercase tracking-wider pb-3">
              LOBBY
              <span className="absolute bottom-0 left-0 w-full h-1 bg-[#4ade80] rounded-full" />
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-semibold uppercase tracking-wider">ARSENAL</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-semibold uppercase tracking-wider relative">
              STORE
              <span className="absolute -top-1 -right-3 w-2.5 h-2.5 bg-orange-500 rounded-full" />
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-semibold uppercase tracking-wider">SHARD CARD</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-semibold uppercase tracking-wider">LEADERBOARD</a>
          </nav>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/5 rounded transition-colors">
              <Pencil className="w-5 h-5 text-white/60" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded">
              <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-xs font-bold">M</div>
              <span className="text-sm font-medium">Maniac</span>
              <span className="text-xs text-white/70">LV. 12</span>
            </div>
            <button className="p-2 hover:bg-white/5 rounded transition-colors">
              <Settings className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full px-8 pt-4 pb-32">
        <div className="flex">
          
          {/* Left Sidebar */}
          <aside className="w-56 space-y-2 pt-4">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="border-l-4 border-[#c9e838] pl-4 py-3 relative cursor-pointer group"
            >
              <div className="absolute top-3 right-0 w-2 h-2 bg-[#c9e838] rounded-full" />
              <div className="text-xs text-white/50 mb-0.5">Selected Mode</div>
              <div className="text-[#c9e838] font-bold uppercase text-lg">UNRATED</div>
            </motion.div>
            
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="border-l-4 border-blue-500 pl-4 py-3 cursor-pointer group hover:bg-white/5 transition-colors"
            >
              <div className="text-xs text-white/50 mb-0.5">Grade Selected</div>
              <div className="text-white font-bold uppercase text-lg">PLATINUM I</div>
            </motion.div>
            
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="border-l-4 border-white/20 pl-4 py-3 cursor-pointer group hover:bg-white/5 transition-colors"
            >
              <div className="text-xs text-white/50 mb-0.5">Review Last Game</div>
              <div className="text-white/70 font-bold uppercase text-lg">VICTORY</div>
            </motion.div>
          </aside>

          {/* Center - Player Card */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-[320px]"
            >
              {/* Player Card */}
              <div 
                className="relative rounded-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, rgba(45, 55, 72, 0.9) 0%, rgba(26, 32, 44, 0.95) 100%)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
              >
                {/* Card Header */}
                <div className="flex justify-between items-start px-5 pt-4 pb-2">
                  <div className="text-red-500 font-bold text-sm uppercase tracking-wide">
                    DIAMOND 2
                  </div>
                  <div className="text-center">
                    <div className="text-white/40 text-xs uppercase tracking-wider">LEVEL 12</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">{playerData?.mmr || 1000}</div>
                    <div className="text-white/40 text-xs uppercase">MMR</div>
                  </div>
                </div>

                {/* Avatar */}
                <div className="flex justify-center py-8">
                  <div className="w-28 h-28 rounded-full bg-[#2d3748] flex items-center justify-center border-4 border-[#3d4a5c]">
                    <span className="text-4xl font-bold text-white/80">
                      {playerData?.displayName?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                </div>

                {/* Player Info */}
                <div className="text-center pb-4">
                  <div className="text-2xl font-bold text-white mb-1">
                    {playerData?.displayName || 'Ali Raza'}
                  </div>
                  <div className="text-white/50 text-sm">
                    {playerData?.rank?.displayName || 'Platinum I'}
                  </div>
                </div>

                {/* Card Footer Links */}
                <div className="flex justify-center gap-6 pb-5 text-xs text-white/40">
                  <button className="hover:text-white/60 transition-colors">Customize Card</button>
                  <button className="hover:text-white/60 transition-colors">View Progression</button>
                </div>
              </div>

              {/* Progress Bar Below Card */}
              <div className="mt-6 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" />
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Bottom Left Buttons */}
      <div className="fixed bottom-24 left-8 z-20 space-y-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="block px-4 py-1.5 border-2 border-[#c9e838] text-[#c9e838] rounded text-xs font-bold uppercase tracking-wider hover:bg-[#c9e838]/10 transition-colors"
        >
          STANDARD &gt;&gt;
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/matchmaking-new')}
          className="block w-40 py-4 bg-[#c9e838] hover:bg-[#d4f041] text-black font-black text-2xl uppercase rounded-lg transition-colors shadow-lg shadow-[#c9e838]/30"
        >
          START
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="block w-40 py-3 border-2 border-white/30 text-white/70 rounded-lg text-sm font-bold uppercase tracking-wider hover:border-white/50 hover:text-white transition-colors"
        >
          WINNER DEMO
        </motion.button>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="flex justify-center items-end gap-8 pb-6">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
          >
            <Crosshair className="w-6 h-6" />
            <span className="text-xs font-medium uppercase">PRACTICE</span>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-xs font-medium uppercase">MODULES</span>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/matchmaking-new')}
            className="flex flex-col items-center gap-1 text-orange-500"
          >
            <div className="p-2 bg-orange-500 rounded-lg">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-bold uppercase">BATTLE!</span>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs font-medium uppercase">PROGRESSION</span>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
          >
            <ShoppingBag className="w-6 h-6" />
            <span className="text-xs font-medium uppercase">SHOP</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}