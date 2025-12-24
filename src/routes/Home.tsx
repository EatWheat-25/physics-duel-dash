import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { RankMenu } from '@/components/RankMenu';
import { ChevronRight, Flame, LogOut, Settings, Shield, Sparkles, Trophy, Zap, Target, Award } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCharacter } from '@/hooks/useCharacter';
import { useIsAdmin } from '@/hooks/useUserRole';
import { getRankByPoints } from '@/types/ranking';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { selectedCharacter } = useCharacter();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const [rankMenuOpen, setRankMenuOpen] = useState(false);
  const [currentMMR, setCurrentMMR] = useState<number>(0);
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    document.title = 'Lobby | BattleNerds';
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchMMR = async () => {
      try {
        const { data } = await supabase
          .from('players')
          .select('mmr')
          .eq('id', user.id)
          .single();

        if (data?.mmr) {
          setCurrentMMR(data.mmr);
        }
      } catch (error) {
        console.error('Error fetching MMR:', error);
      }
    };

    fetchMMR();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('player-mmr-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.mmr) {
            setCurrentMMR(payload.new.mmr);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const navItems = [
    { label: 'LOBBY', path: '/', onClick: () => navigate('/') },
    { label: 'ARSENAL', path: '/loadout', onClick: () => navigate('/loadout') },
    { label: 'STORE', path: '/shop', onClick: () => navigate('/shop') },
    { label: 'SHARD CARD', path: '/profile', onClick: () => navigate('/profile') },
    { label: 'LEADERBOARD', onClick: () => setRankMenuOpen(true) },
  ] as const;

  const getNavActive = (item: (typeof navItems)[number]) => {
    if ('path' in item && item.path) return location.pathname === item.path;
    return rankMenuOpen;
  };

  const heroSrc = selectedCharacter?.avatar ?? '';
  const heroIsVideo = heroSrc.toLowerCase().endsWith('.mp4');
  const mmr = currentMMR || 1000;
  const rank = getRankByPoints(mmr);
  const level = Math.max(1, Math.floor(mmr / 100) + 1);
  const username = profile?.username || user?.email?.split('@')[0] || 'Guest';
  const initial = (username?.[0] || '?').toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.15) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Modern sleek header */}
      <header className="relative z-30 w-full px-6 pt-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50" />
                <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <div className="text-xl font-black text-white tracking-tight">BattleNerds</div>
                <div className="text-xs text-purple-300 font-medium">Play • Compete • Win</div>
              </div>
            </motion.div>

            {/* Center nav */}
            <nav className="hidden lg:flex items-center gap-2 bg-white/5 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10">
              {navItems.map((item, idx) => {
                const active = getNavActive(item);
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={item.onClick}
                    className={`relative px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      active ? 'text-white' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </motion.button>
                );
              })}
            </nav>

            {/* Right actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <button
                onClick={() => navigate('/profile')}
                className="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-black">
                  {initial}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white">{username}</div>
                  <div className="text-xs text-purple-300">Level {level}</div>
                </div>
              </button>

              {!isAdminLoading && isAdmin && (
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className="h-10 w-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all flex items-center justify-center"
                >
                  <Shield className="w-4 h-4 text-yellow-400" />
                </button>
              )}

              <button
                onClick={() => {}}
                className="h-10 w-10 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center"
              >
                <Settings className="w-4 h-4 text-white/80" />
              </button>

              <button
                onClick={signOut}
                className="h-10 w-10 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-red-500/20 transition-all flex items-center justify-center"
              >
                <LogOut className="w-4 h-4 text-white/80" />
              </button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="relative z-20 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Stats & Quick Actions */}
            <div className="lg:col-span-3 space-y-4">
              {/* Player Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-6"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 rounded-full blur-3xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                      <span className="text-xs font-bold text-violet-300">{rank.displayName.toUpperCase()}</span>
                    </div>
                    <Trophy className="w-5 h-5 text-yellow-400" />
                  </div>

                  <div className="flex flex-col items-center py-6">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full blur-lg opacity-50" />
                      <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <span className="text-3xl font-black text-white">{initial}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-black text-white mb-1">{username}</h3>
                    <p className="text-sm text-purple-300 mb-4">Level {level}</p>

                    <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                      <div 
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                        style={{ width: `${(mmr % 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/60">Next level in {100 - (mmr % 100)} XP</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                    <div className="text-center">
                      <div className="text-2xl font-black text-white">{mmr}</div>
                      <div className="text-xs text-purple-300">MMR</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-white">0</div>
                      <div className="text-xs text-purple-300">Wins</div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Quick Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-6"
              >
                <h4 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Quick Stats
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Win Rate</span>
                    <span className="text-sm font-bold text-white">0%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Games Played</span>
                    <span className="text-sm font-bold text-white">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Streak</span>
                    <span className="text-sm font-bold text-emerald-400">0 🔥</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Center: Main Action Area */}
            <div className="lg:col-span-6 space-y-6">
              {/* Hero Banner */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-600 p-8 min-h-[400px] flex flex-col justify-between"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6bTAgMTBjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
                
                <div className="relative z-10">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-bold text-white">Ready to Battle</span>
                    </div>
                    <h1 className="text-5xl font-black text-white mb-3 leading-tight">
                      Ready for Your<br />Next Challenge?
                    </h1>
                    <p className="text-lg text-white/80 max-w-md">
                      Jump into intense 1v1 battles and prove your skills!
                    </p>
                  </motion.div>
                </div>

                <div className="relative z-10 space-y-3">
                  <motion.button
                    onClick={() => (window.location.href = '/matchmaking-new')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-5 rounded-2xl bg-white text-purple-600 font-black text-xl flex items-center justify-center gap-3 shadow-2xl hover:shadow-purple-500/50 transition-all"
                  >
                    <Zap className="w-6 h-6" />
                    START BATTLE
                  </motion.button>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      onClick={() => navigate('/modes')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold text-sm hover:bg-white/20 transition-all"
                    >
                      Select Mode
                    </motion.button>
                    <motion.button
                      onClick={() => (window.location.href = '/dev/db-test')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Flame className="w-4 h-4" />
                      Winner Demo
                    </motion.button>
                  </div>
                </div>
              </motion.div>

              {/* Mode Selection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 gap-4"
              >
                <button
                  onClick={() => navigate('/modes')}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-xl border border-blue-500/30 p-6 hover:from-blue-600/30 hover:to-cyan-600/30 transition-all"
                >
                  <Target className="w-8 h-8 text-blue-400 mb-3" />
                  <h3 className="text-lg font-black text-white mb-1">Standard</h3>
                  <p className="text-sm text-white/60">Classic 1v1 mode</p>
                  <ChevronRight className="absolute top-6 right-6 w-5 h-5 text-white/40 group-hover:text-white/60 transition-all" />
                </button>

                <button
                  onClick={() => navigate('/battle/queue')}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600/20 to-red-600/20 backdrop-blur-xl border border-orange-500/30 p-6 hover:from-orange-600/30 hover:to-red-600/30 transition-all"
                >
                  <Flame className="w-8 h-8 text-orange-400 mb-3" />
                  <h3 className="text-lg font-black text-white mb-1">Ranked</h3>
                  <p className="text-sm text-white/60">Competitive play</p>
                  <ChevronRight className="absolute top-6 right-6 w-5 h-5 text-white/40 group-hover:text-white/60 transition-all" />
                </button>
              </motion.div>
            </div>

            {/* Right: Activity & News */}
            <div className="lg:col-span-3 space-y-4">
              {/* Leaderboard Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white/80 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    Leaderboard
                  </h4>
                  <button
                    onClick={() => setRankMenuOpen(true)}
                    className="text-xs font-bold text-violet-400 hover:text-violet-300"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((pos) => (
                    <div key={pos} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xs font-black">
                        {pos}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">Player {pos}</div>
                        <div className="text-xs text-white/60">{1000 + (4 - pos) * 100} MMR</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-6"
              >
                <h4 className="text-sm font-bold text-white/80 mb-4">Recent Activity</h4>
                <div className="space-y-3 text-sm text-white/60">
                  <p>No recent matches</p>
                  <p className="text-xs">Start battling to see your history!</p>
                </div>
              </motion.div>

              {/* Quick Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-2"
              >
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full py-3 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 text-sm font-bold hover:bg-white/10 transition-all"
                >
                  Customize Profile
                </button>
                <button
                  onClick={() => navigate('/progression')}
                  className="w-full py-3 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 text-sm font-bold hover:bg-white/10 transition-all"
                >
                  View Progression
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

        <BottomNav />
      <RankMenu open={rankMenuOpen} onOpenChange={setRankMenuOpen} currentMMR={currentMMR} />
    </div>
  );
}
