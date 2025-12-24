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
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Dark professional background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-black to-zinc-950" />
      
      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Minimal accent glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />

      {/* Tactical professional header */}
      <header className="relative z-30 border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-white tracking-tight">BATTLENERDS</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Competitive Arena</div>
              </div>
            </div>

            {/* Center nav - minimalist */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const active = getNavActive(item);
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`relative px-6 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                      active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/profile')}
                className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="h-8 w-8 bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold">
                  {initial}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">{username}</div>
                  <div className="text-xs text-zinc-500">LVL {level}</div>
                </div>
              </button>

              {!isAdminLoading && isAdmin && (
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className="h-10 w-10 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors flex items-center justify-center"
                >
                  <Shield className="w-4 h-4 text-yellow-500" />
                </button>
              )}

              <button
                onClick={() => {}}
                className="h-10 w-10 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <Settings className="w-4 h-4 text-zinc-400" />
              </button>

              <button
                onClick={signOut}
                className="h-10 w-10 bg-white/5 border border-white/10 hover:bg-red-500/20 transition-colors flex items-center justify-center"
              >
                <LogOut className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-20 px-8 py-12">
        <div className="max-w-[1600px] mx-auto">
          {/* Hero Section - Clean and Direct */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* Player Stats Card - Left */}
            <div className="lg:col-span-1">
              <div className="bg-zinc-900/50 border border-white/10 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Rank</div>
                    <div className="text-sm font-bold text-cyan-400">{rank.displayName.toUpperCase()}</div>
                  </div>
                  <Trophy className="w-5 h-5 text-zinc-600" />
                </div>

                <div className="flex flex-col items-center py-6 border-y border-white/10">
                  <div className="h-24 w-24 bg-zinc-800 border-2 border-cyan-500/20 flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold text-white">{initial}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{username}</h3>
                  <p className="text-sm text-zinc-500">Level {level}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="text-center p-3 bg-black/50 border border-white/5">
                    <div className="text-2xl font-bold text-white">{mmr}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">MMR</div>
                  </div>
                  <div className="text-center p-3 bg-black/50 border border-white/5">
                    <div className="text-2xl font-bold text-white">0</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">Wins</div>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium text-white"
                  >
                    Customize Profile
                  </button>
                  <button
                    onClick={() => navigate('/progression')}
                    className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium text-white"
                  >
                    View Stats
                  </button>
                </div>
              </div>
            </div>

            {/* Main Action - Center */}
            <div className="lg:col-span-2">
              <div className="relative bg-zinc-900/30 border border-white/10 p-12 min-h-[500px] flex flex-col justify-between">
                {/* Subtle accent line */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                
                <div>
                  <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 mb-6">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Ready</span>
                  </div>
                  <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                    Enter the<br />Arena
                  </h1>
                  <p className="text-lg text-zinc-400 max-w-xl">
                    Test your skills in competitive 1v1 battles. Climb the ranks and prove yourself.
                  </p>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => (window.location.href = '/matchmaking-new')}
                    className="group w-full py-6 bg-cyan-500 hover:bg-cyan-400 border-2 border-cyan-400 transition-colors flex items-center justify-center gap-3"
                  >
                    <span className="text-xl font-bold text-black uppercase tracking-wider">Start Match</span>
                    <ChevronRight className="w-6 h-6 text-black group-hover:translate-x-1 transition-transform" />
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => navigate('/modes')}
                      className="py-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-semibold text-white uppercase tracking-wider"
                    >
                      Game Modes
                    </button>
                    <button
                      onClick={() => (window.location.href = '/dev/db-test')}
                      className="py-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-semibold text-white uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <Flame className="w-4 h-4" />
                      Demo
                    </button>
                  </div>
                </div>
              </div>

              {/* Mode Cards */}
              <div className="grid grid-cols-2 gap-6 mt-8">
                <button
                  onClick={() => navigate('/modes')}
                  className="group text-left p-6 bg-zinc-900/50 border border-white/10 hover:border-cyan-500/50 transition-all"
                >
                  <Target className="w-8 h-8 text-zinc-600 group-hover:text-cyan-500 mb-4 transition-colors" />
                  <h3 className="text-lg font-bold text-white mb-2">Standard</h3>
                  <p className="text-sm text-zinc-500">Classic competitive mode</p>
                </button>

                <button
                  onClick={() => navigate('/battle/queue')}
                  className="group text-left p-6 bg-zinc-900/50 border border-white/10 hover:border-orange-500/50 transition-all"
                >
                  <Flame className="w-8 h-8 text-zinc-600 group-hover:text-orange-500 mb-4 transition-colors" />
                  <h3 className="text-lg font-bold text-white mb-2">Ranked</h3>
                  <p className="text-sm text-zinc-500">Climb the leaderboard</p>
                </button>
              </div>
            </div>
          </div>

          {/* Leaderboard Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-zinc-900/30 border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Recent Activity</h3>
                <button className="text-xs text-cyan-400 hover:text-cyan-300 uppercase tracking-wider">View All</button>
              </div>
              <div className="text-center py-12">
                <Target className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-600">No matches yet</p>
                <p className="text-xs text-zinc-700 mt-1">Your match history will appear here</p>
              </div>
            </div>

            <div className="bg-zinc-900/30 border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                  Top Players
                </h3>
                <button
                  onClick={() => setRankMenuOpen(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 uppercase tracking-wider"
                >
                  Full Board
                </button>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((pos) => (
                  <div key={pos} className="flex items-center gap-3 p-3 bg-black/30 border border-white/5">
                    <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
                      {pos}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">Player {pos}</div>
                      <div className="text-xs text-zinc-600">{1500 - pos * 50} MMR</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

        <BottomNav />
      <RankMenu open={rankMenuOpen} onOpenChange={setRankMenuOpen} currentMMR={currentMMR} />
    </div>
  );
}
