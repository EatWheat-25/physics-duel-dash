import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { HeaderUserMenu } from '@/components/hub/HeaderUserMenu';
import { RankMenu } from '@/components/RankMenu';
import { Button } from '@/components/ui/button';
import { ChevronRight, Flame, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCharacter } from '@/hooks/useCharacter';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { selectedCharacter } = useCharacter();
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

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Base gradient (dark grey + light blue) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgb(8, 12, 20) 0%, rgb(13, 23, 42) 46%, rgb(8, 13, 22) 100%)',
        }}
      />

      {/* Curvy glow layers */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(900px 520px at 72% 22%, rgba(59, 130, 246, 0.28) 0%, transparent 60%)',
            'radial-gradient(820px 520px at 12% 86%, rgba(14, 165, 233, 0.18) 0%, transparent 62%)',
            'radial-gradient(760px 520px at 44% -10%, rgba(99, 102, 241, 0.18) 0%, transparent 62%)',
            'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, transparent 45%, rgba(255, 255, 255, 0.03) 100%)',
          ].join(','),
        }}
      />

      {/* Subtle diagonal “energy” sweep */}
      <div
        className="absolute -inset-24 rotate-[-12deg] opacity-40 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.12) 35%, rgba(99, 102, 241, 0.12) 55%, transparent 80%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Top bar */}
      <header className="relative z-20 w-full px-4 sm:px-6 pt-4">
        <div
          className="flex items-center justify-between rounded-2xl px-4 sm:px-6 py-3"
          style={{
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(99,102,241,0.25))',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <Sparkles className="w-4 h-4 text-white/90" />
              </div>
              <div className="leading-tight">
                <div className="text-white font-black tracking-widest uppercase text-sm sm:text-base">
                  BattleNerds
                </div>
                <div className="text-[10px] text-white/60 tracking-[0.22em] uppercase hidden sm:block">
                  Lobby
                </div>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-2" aria-label="Primary navigation">
              {navItems.map((item) => {
                const active = getNavActive(item);
                return (
                  <Button
                    key={item.label}
                    variant="ghost"
                    size="sm"
                    onClick={item.onClick}
                    className="h-10 px-4 rounded-full font-semibold tracking-widest uppercase text-[11px] text-white/80 hover:text-white"
                    style={{
                      background: active ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                      border: active ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.12)',
                      boxShadow: active ? '0 12px 30px rgba(59,130,246,0.12)' : undefined,
                    }}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Compact user summary (kept minimal; HeaderUserMenu keeps actual actions) */}
            <div
              className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] text-white/70 uppercase tracking-widest">Player</span>
                <span className="text-sm font-bold text-white">
                  {profile?.username || user?.email?.split('@')[0] || 'Guest'}
                </span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col leading-tight items-end">
                <span className="text-[11px] text-white/70 uppercase tracking-widest">MMR</span>
                <span className="text-sm font-bold text-white">{currentMMR || 1000}</span>
              </div>
            </div>

            <HeaderUserMenu />
          </div>
        </div>
      </header>

      {/* Main lobby layout */}
      <main className="relative z-10 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-6 pb-28 lg:pb-10">
          <div className="grid gap-6 lg:grid-cols-[420px_1fr_360px] lg:items-stretch">
            {/* Left: action area (bottom-left placement on desktop) */}
            <section className="order-2 lg:order-1 flex flex-col justify-end gap-4">
              <motion.button
                type="button"
                onClick={() => navigate('/modes')}
                className="group w-full text-left rounded-3xl p-5"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(15,23,42,0.78) 0%, rgba(30,41,59,0.62) 70%, rgba(15,23,42,0.78) 100%)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  boxShadow: '0 14px 44px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(18px)',
                }}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                aria-label="Select mode"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] text-white/60 uppercase tracking-[0.22em]">
                      Mode
                    </div>
                    <div className="mt-1 text-2xl font-black text-white uppercase tracking-widest">
                      STANDARD
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-white/70 group-hover:text-white transition-colors">
                    <span className="text-sm font-bold uppercase tracking-widest hidden sm:inline">
                      Change
                    </span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-sm text-white/70">
                  Fast 1v1 battles with quick math rounds.
                </div>
              </motion.button>

              <motion.div
                whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              >
                <Button
                  onClick={() => (window.location.href = '/matchmaking-new')}
                  className="w-full px-8 py-8 text-3xl font-black uppercase tracking-widest rounded-3xl"
                  style={{
                    background: 'linear-gradient(135deg, #a3e635, #22c55e, #a3e635)',
                    backgroundSize: '200% 200%',
                    color: '#06110a',
                    border: '2px solid rgba(255,255,255,0.22)',
                    boxShadow:
                      '0 18px 60px rgba(34,197,94,0.24), 0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
                    animation: prefersReducedMotion ? undefined : 'gradient-shift 3s ease infinite',
                  }}
                  aria-label="Start matchmaking"
                >
                  START
                </Button>
              </motion.div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setRankMenuOpen(true)}
                  variant="ghost"
                  className="flex-1 gap-2 font-bold uppercase tracking-wider text-white/90 hover:text-white rounded-2xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    backdropFilter: 'blur(14px)',
                  }}
                  aria-label="View ranking system"
                >
                  <Trophy className="w-4 h-4" />
                  Ranks
                </Button>
                <Button
                  onClick={() => (window.location.href = '/dev/db-test')}
                  variant="ghost"
                  className="flex-1 gap-2 font-bold uppercase tracking-wider text-white/90 hover:text-white rounded-2xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    backdropFilter: 'blur(14px)',
                  }}
                  aria-label="Winner demo"
                >
                  <Flame className="w-4 h-4" />
                  Winner Demo
                </Button>
              </div>
            </section>

            {/* Center: character hero */}
            <section className="order-1 lg:order-2 relative min-h-[420px] lg:min-h-[680px] flex items-end justify-center">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-sky-400/20 blur-3xl" />
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[360px] h-[220px] rounded-[999px] bg-indigo-400/10 blur-2xl" />
              </div>

              <motion.div
                className="relative w-full max-w-[520px] sm:max-w-[620px] lg:max-w-[760px]"
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              >
                {heroSrc ? (
                  heroIsVideo ? (
                    <video
                      src={heroSrc}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto object-contain"
                      style={{
                        filter:
                          'drop-shadow(0 30px 60px rgba(0,0,0,0.6)) drop-shadow(0 0 50px rgba(59,130,246,0.18))',
                      }}
                    />
                  ) : (
                    <img
                      src={heroSrc}
                      alt={selectedCharacter?.name || 'Selected character'}
                      className="w-full h-auto object-contain"
                      style={{
                        filter:
                          'drop-shadow(0 30px 60px rgba(0,0,0,0.6)) drop-shadow(0 0 50px rgba(59,130,246,0.18))',
                      }}
                    />
                  )
                ) : null}

                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                      background: 'rgba(2, 6, 23, 0.55)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    <div className="text-[11px] text-white/60 uppercase tracking-[0.22em]">
                      Selected
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white uppercase tracking-widest">
                      {selectedCharacter?.name || 'Robo Genius'}
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Right: widgets */}
            <aside className="order-3 flex flex-col gap-4">
              <motion.button
                type="button"
                onClick={() => navigate('/progression')}
                className="w-full text-left rounded-3xl overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
                }}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                aria-label="Battle pass"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] text-white/60 uppercase tracking-[0.22em]">
                        Battle Pass
                      </div>
                      <div className="mt-1 text-xl font-black text-white uppercase tracking-widest">
                        Season Rewards
                      </div>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest text-white"
                      style={{
                        background: 'rgba(59, 130, 246, 0.22)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                      }}
                    >
                      LVL 2
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-[42%] rounded-full bg-sky-400/70" />
                    </div>
                    <div className="mt-2 text-sm text-white/70">42% to next reward</div>
                  </div>
                </div>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => navigate('/challenges')}
                className="w-full text-left rounded-3xl p-5"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
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
                    <div className="text-[11px] text-white/60 uppercase tracking-[0.22em]">
                      Challenges
                    </div>
                    <div className="mt-1 text-xl font-black text-white uppercase tracking-widest">
                      Daily Ops
                    </div>
                  </div>
                  <div className="text-sm font-bold text-white/90">3/5</div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-[60%] rounded-full bg-indigo-400/70" />
                  </div>
                  <span className="text-xs text-white/60 uppercase tracking-widest">60%</span>
                </div>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => navigate('/battle/queue')}
                className="w-full text-left rounded-3xl p-5"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
                }}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                aria-label="Activity"
              >
                <div className="text-[11px] text-white/60 uppercase tracking-[0.22em]">Activity</div>
                <div className="mt-1 text-xl font-black text-white uppercase tracking-widest">
                  Queue Status
                </div>
                <div className="mt-3 text-sm text-white/70">
                  Jump in and find an opponent. Live matchmaking updates.
                </div>
              </motion.button>
            </aside>
          </div>
        </div>
      </main>

      {/* Mobile-only bottom nav (keeps desktop closer to “game lobby” reference) */}
      <div className="relative z-20 lg:hidden">
        <BottomNav />
      </div>

      <RankMenu open={rankMenuOpen} onOpenChange={setRankMenuOpen} currentMMR={currentMMR} />
    </div>
  );
}
