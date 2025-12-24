import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { RankMenu } from '@/components/RankMenu';
import { ChevronRight, Flame, LogOut, Settings, Shield, Sparkles, Trophy } from 'lucide-react';
import { SolarSystemBackground } from '@/components/SolarSystemBackground';
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
    <div className="relative min-h-screen overflow-hidden text-white">
      {/* Stylized Solar System Background */}
      <SolarSystemBackground />

      {/* Top bar (centered nav like reference) */}
      <header className="relative z-30 w-full px-4 sm:px-6 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-[180px]">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <Sparkles className="w-4 h-4 text-white/90" />
            </div>
            <div className="leading-tight">
              <div className="font-black tracking-widest uppercase text-sm sm:text-base">BattleNerds</div>
              <div className="text-[10px] text-white/55 tracking-[0.24em] uppercase">Lobby</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center justify-center gap-8" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = getNavActive(item);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`group relative py-2 text-[11px] font-black uppercase tracking-[0.28em] transition-colors ${
                    active ? 'text-white' : 'text-white/70 hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={`absolute -inset-x-4 -inset-y-2 rounded-full transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    style={{
                      background: active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(163,230,53,0.22)' : '1px solid rgba(255,255,255,0.10)',
                      boxShadow: active ? '0 0 28px rgba(163,230,53,0.10)' : undefined,
                    }}
                    aria-hidden="true"
                  />
                  {item.label}
                  {active && (
                    <span
                      className="absolute left-0 right-0 -bottom-1 mx-auto h-0.5 w-10 rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(163,230,53,0), rgba(163,230,53,1), rgba(163,230,53,0))',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-2 min-w-[180px]">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-2xl"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(18px)',
              }}
              aria-label="Open profile"
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-black"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                }}
              >
                {initial}
              </div>
              <div className="leading-tight text-left">
                <div className="text-sm font-bold text-white">{username}</div>
                <div className="text-[10px] text-white/60 tracking-[0.22em] uppercase">Lv {level}</div>
              </div>
            </button>

            {!isAdminLoading && isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="h-11 w-11 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  backdropFilter: 'blur(18px)',
                }}
                aria-label="Admin dashboard"
              >
                <Shield className="w-4 h-4 text-yellow-200" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {}}
              className="h-11 w-11 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(18px)',
              }}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4 text-white/90" />
            </button>

            <button
              type="button"
              onClick={signOut}
              className="h-11 w-11 rounded-2xl flex items-center justify-center"
          style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(18px)',
              }}
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 text-white/90" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-20 min-h-[calc(100vh-120px)]">
        {/* Keep the lobby clean like the reference (no large character overlay) */}

        {/* Left stack (reference-style tiles) */}
        <div className="hidden lg:flex absolute left-6 top-28 w-[260px] flex-col gap-3">
          <motion.button
            type="button"
            onClick={() => navigate('/modes')}
            className="relative w-full rounded-2xl px-4 py-4 text-left"
            style={{
              background: 'rgba(15, 23, 42, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Selected mode"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-lime-400/70" />
            <div className="text-sm font-black uppercase tracking-widest text-white">UNRATED</div>
            <div className="text-xs text-white/55 mt-1">Selected Mode</div>
          </motion.button>

          <motion.button
            type="button"
              onClick={() => setRankMenuOpen(true)}
            className="relative w-full rounded-2xl px-4 py-4 text-left"
            style={{
              background: 'rgba(15, 23, 42, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Open leaderboard"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-sky-400/70" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-white">
                  {rank.displayName.toUpperCase()}
                </div>
                <div className="text-xs text-white/55 mt-1">Grade Selected</div>
              </div>
              <Trophy className="w-4 h-4 text-white/80" />
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => navigate('/progression')}
            className="relative w-full rounded-2xl px-4 py-4 text-left"
            style={{
              background: 'rgba(15, 23, 42, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Review last game"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-white/30" />
            <div className="text-sm font-black uppercase tracking-widest text-white">VICTORY</div>
            <div className="text-xs text-white/55 mt-1">Review Last Game</div>
          </motion.button>
        </div>

        {/* Center player card (FLAT like reference) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[clamp(280px,40vh,360px)] max-w-[90vw] aspect-[5/7]">
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="relative rounded-3xl overflow-hidden h-full w-full"
            style={{
              background: 'linear-gradient(180deg, rgba(52, 64, 88, 0.70) 0%, rgba(23, 31, 48, 0.70) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(22px)',
              boxShadow: '0 22px 70px rgba(0,0,0,0.55)',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{
                background: 'radial-gradient(600px 260px at 50% 15%, rgba(255,255,255,0.10), transparent 60%)',
              }}
            />
            <div className="absolute inset-2 rounded-2xl border border-white/10 pointer-events-none" />

            <div className="p-6 h-full flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-white/60 font-black">
                    {rank.displayName.toUpperCase()}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/60 font-black">
                    LEVEL {level}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-2xl font-black text-white"
                    style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                  >
                    {mmr}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-white/60 font-black">MMR</div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center">
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <span className="text-3xl font-black text-white">{initial}</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="text-2xl font-black text-white">{username}</div>
                <div className="text-sm text-white/60">{rank.displayName}</div>
              </div>

              <div className="mt-auto pt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  Customize Card
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/progression')}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  View Progression
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right widgets (merge from bright reference; subtle in dark theme) */}
        <div className="hidden lg:flex absolute right-6 top-28 w-[340px] flex-col gap-3">
          <motion.button
            type="button"
            onClick={() => navigate('/progression')}
            className="w-full text-left rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(15, 23, 42, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Battle pass"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] text-white/55 uppercase tracking-[0.28em]">Battle Pass</div>
                  <div className="mt-1 text-lg font-black uppercase tracking-widest text-white">Season Rewards</div>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
                  style={{
                    background: 'rgba(56, 189, 248, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.28)',
                  }}
                >
                  LVL 2
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[42%] rounded-full bg-sky-400/70" />
                </div>
              </div>
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => navigate('/challenges')}
            className="w-full text-left rounded-2xl p-4"
            style={{
              background: 'rgba(15, 23, 42, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Challenges"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] text-white/55 uppercase tracking-[0.28em]">Challenges</div>
                <div className="mt-1 text-lg font-black uppercase tracking-widest text-white">Daily Ops</div>
              </div>
              <div className="text-sm font-black text-white/90">3/5</div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[60%] rounded-full bg-indigo-400/70" />
              </div>
              <span className="text-[10px] text-white/55 uppercase tracking-[0.28em]">60%</span>
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => navigate('/battle/queue')}
            className="w-full text-left rounded-2xl p-4"
            style={{
              background: 'rgba(15, 23, 42, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Activity"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] text-white/55 uppercase tracking-[0.28em]">Activity</div>
                <div className="mt-1 text-lg font-black uppercase tracking-widest text-white">Queue</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/60" />
            </div>
            <div className="mt-3 text-sm text-white/65">Jump in and find an opponent.</div>
          </motion.button>
        </div>

        {/* Bottom-left action stack (matches reference positioning) */}
        <div className="absolute left-6 bottom-44 w-[280px] sm:w-[320px]">
          <motion.button
            type="button"
            onClick={() => navigate('/modes')}
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-[11px] font-black uppercase tracking-[0.28em]"
            style={{
              background: '#facc15',
              color: '#0b1220',
              border: '1px solid rgba(0,0,0,0.35)',
              boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
              fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -1 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            aria-label="Standard mode"
          >
            STANDARD <span className="opacity-80">»</span>
          </motion.button>

          <motion.div
            className="mt-3"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
          >
            <motion.button
              onClick={() => (window.location.href = '/matchmaking-new')}
              className="w-full px-8 py-6 text-2xl sm:text-3xl font-black uppercase tracking-widest rounded"
              style={{
                background: 'linear-gradient(135deg, #a3e635, #22c55e)',
                color: '#0b1220',
                border: '1px solid rgba(0,0,0,0.45)',
                boxShadow: '0 18px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
                fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
              }}
              aria-label="Start matchmaking"
          >
            START
            </motion.button>
          </motion.div>

          <motion.button
            onClick={() => (window.location.href = '/dev/db-test')}
            className="mt-3 w-full px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-[0.28em] flex items-center justify-center gap-2"
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.04) 60%, rgba(255, 255, 255, 0.06) 100%)',
              border: '1px solid rgba(154, 91, 255, 0.22)',
              boxShadow: '0 18px 55px rgba(0,0,0,0.35), 0 0 30px rgba(154,91,255,0.10)',
              backdropFilter: 'blur(18px)',
            }}
            aria-label="Winner demo"
          >
            <Flame className="w-4 h-4 mr-2" />
            WINNER DEMO
          </motion.button>
        </div>

        {/* Mobile uses the dock nav; keep this screen consistent with the reference */}
      </main>

        <BottomNav />
      <RankMenu open={rankMenuOpen} onOpenChange={setRankMenuOpen} currentMMR={currentMMR} />
    </div>
  );
}
