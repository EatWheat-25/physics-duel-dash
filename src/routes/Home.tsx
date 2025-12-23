import { useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { RankMenu } from '@/components/RankMenu';
import { ChevronRight, Flame, LogOut, Settings, Shield, Sparkles, Trophy } from 'lucide-react';
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

  // 3D card tilt + interactive holographic glare
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const glareX = useMotionValue(52);
  const glareY = useMotionValue(30);
  const tiltXSpring = useSpring(tiltX, { stiffness: 220, damping: 22, mass: 0.65 });
  const tiltYSpring = useSpring(tiltY, { stiffness: 220, damping: 22, mass: 0.65 });

  const glare = useMotionTemplate`
    radial-gradient(560px 240px at ${glareX}% ${glareY}%, rgba(88,196,255,0.22), transparent 60%),
    radial-gradient(520px 240px at ${glareX}% ${glareY}%, rgba(154,91,255,0.16), transparent 62%)
  `;

  const onCardPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    // Card tilt (subtle, premium)
    const rotateY = (px - 0.5) * 10; // -5..5
    const rotateX = (0.5 - py) * 10; // -5..5
    tiltX.set(rotateX);
    tiltY.set(rotateY);

    glareX.set(Math.max(0, Math.min(100, px * 100)));
    glareY.set(Math.max(0, Math.min(100, py * 100)));
  };

  const onCardPointerLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
    glareX.set(52);
    glareY.set(30);
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      {/* Dark/blue blurred lobby background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgb(7, 10, 16) 0%, rgb(8, 14, 24) 38%, rgb(6, 10, 18) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(900px 520px at 18% 88%, rgba(56, 189, 248, 0.16) 0%, transparent 62%)',
            'radial-gradient(900px 520px at 78% 24%, rgba(99, 102, 241, 0.18) 0%, transparent 62%)',
            'radial-gradient(700px 420px at 52% 56%, rgba(148, 163, 184, 0.06) 0%, transparent 60%)',
            'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 35%, rgba(255,255,255,0.02) 100%)',
          ].join(','),
          filter: 'blur(0.2px)',
        }}
      />
      {/* Note: keep background clean like the reference (no extra grid layer here) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(900px 600px at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.7) 100%)',
        }}
      />

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
                      border: active ? '1px solid rgba(88,196,255,0.20)' : '1px solid rgba(255,255,255,0.10)',
                      boxShadow: active ? '0 0 28px rgba(88,196,255,0.10)' : undefined,
                    }}
                    aria-hidden="true"
                  />
                  {item.label}
                  {active && (
                    <span
                      className="absolute left-0 right-0 -bottom-1 mx-auto h-0.5 w-10 rounded-full"
                      style={{
                        background: 'var(--gradient-neon)',
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

        {/* Center player card (portrait trading-card shape) */}
        <div className="absolute left-1/2 top-[46%] sm:top-[50%] lg:top-[54%] -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[340px] lg:w-[360px] aspect-[4/5]">
          <div className="relative" style={{ perspective: 1100 }}>
            <motion.div
              onPointerMove={onCardPointerMove}
              onPointerLeave={onCardPointerLeave}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              className="lobby-3d h-full overflow-hidden"
              style={{
                rotateX: tiltXSpring,
                rotateY: tiltYSpring,
                borderRadius: 14,
                background: 'rgba(18, 25, 38, 0.62)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(22px)',
                boxShadow: '0 22px 70px rgba(0,0,0,0.55)',
              }}
            >
              {/* Interactive glare (pointer-based) */}
              <motion.div className="absolute inset-0 pointer-events-none" style={{ background: glare, opacity: 0.55 }} />

              {/* Inner frame */}
              <div className="absolute inset-3 rounded-[12px] border border-white/10 pointer-events-none" />
              <div
                className="absolute inset-6 rounded-[10px] pointer-events-none"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              />

              {/* Corner ticks */}
              <div className="absolute left-4 top-4 h-4 w-4 border-l border-t border-white/20 pointer-events-none" />
              <div className="absolute right-4 top-4 h-4 w-4 border-r border-t border-white/20 pointer-events-none" />
              <div className="absolute left-4 bottom-4 h-4 w-4 border-l border-b border-white/20 pointer-events-none" />
              <div className="absolute right-4 bottom-4 h-4 w-4 border-r border-b border-white/20 pointer-events-none" />

              <div className="relative z-10 p-6 sm:p-7 h-full flex flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <span
                      className="inline-flex items-center rounded px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em]"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                      }}
                    >
                      {rank.displayName.toUpperCase()}
                    </span>
                    <span
                      className="inline-flex items-center rounded px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em]"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                      }}
                    >
                      LV&nbsp;{level}
                    </span>
                  </div>

                  <div className="text-right">
                    <div
                      className="text-3xl font-black"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif', letterSpacing: '0.02em' }}
                    >
                      {mmr}
                    </div>
                    <div className="text-[10px] text-white/55 uppercase tracking-[0.28em]">MMR</div>
                  </div>
                </div>

                {/* Main portrait area */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  {/* Avatar plate */}
                  <div
                    className="relative h-28 w-28 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      boxShadow:
                        '0 18px 40px rgba(0,0,0,0.5), 0 0 35px rgba(88,196,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      className="absolute inset-[-2px] rounded-full opacity-70 pointer-events-none"
                      style={{
                        background: 'var(--gradient-neon)',
                        filter: 'blur(10px)',
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), transparent 60%)',
                      }}
                    />
                    <span
                      className="relative z-10 text-4xl font-black"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                    >
                      {initial}
                    </span>
                  </div>
                  <div className="mt-6 text-center">
                    <div
                      className="text-2xl font-black"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif', letterSpacing: '0.03em' }}
                    >
                      {username}
                    </div>
                    <div className="mt-2 text-sm text-white/65 tech-text">
                      {selectedCharacter?.name || 'Selected Agent'} • {rank.displayName}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className="w-full rounded px-3 py-3 text-[10px] font-black uppercase tracking-[0.28em]"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                    }}
                  >
                    Customize
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/progression')}
                    className="w-full rounded px-3 py-3 text-[10px] font-black uppercase tracking-[0.28em]"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                    }}
                  >
                    Progress
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Shadow “lift” */}
            <div
              className="absolute -inset-6 -z-10 rounded-[32px] blur-3xl opacity-40 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 40% 30%, rgba(88,196,255,0.22), transparent 55%), radial-gradient(circle at 70% 70%, rgba(154,91,255,0.18), transparent 55%)',
              }}
            />
          </div>
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
        <div className="hidden sm:block absolute left-6 bottom-44 w-[280px] sm:w-[320px]">
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
            STANDARD <span className="text-white/80">»</span>
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

        {/* Mobile action cluster (keeps bottom nav usable) */}
        <div className="sm:hidden fixed left-4 right-4 bottom-[132px] z-40">
          <div className="lobby-card">
            <div className="relative z-10 p-4">
              <div className="flex items-center justify-between gap-3">
                <motion.button
                  type="button"
                  onClick={() => navigate('/modes')}
                  className="lobby-chip"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
                  STANDARD »
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setRankMenuOpen(true)}
                  className="lobby-chip"
                  style={{ borderColor: 'rgba(88, 196, 255, 0.22)' }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
                  RANKS
                </motion.button>
              </div>

              <motion.button
                type="button"
                onClick={() => (window.location.href = '/matchmaking-new')}
                className="cyber-button w-full mt-3 px-6 py-5 text-xl flex items-center justify-center gap-3"
                style={{ color: 'white' }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              >
                <Sparkles className="w-5 h-5" />
                START
              </motion.button>

              <motion.button
                type="button"
                onClick={() => (window.location.href = '/dev/db-test')}
                className="w-full mt-3 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.28em] flex items-center justify-center gap-2"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.04) 60%, rgba(255, 255, 255, 0.06) 100%)',
                  border: '1px solid rgba(154, 91, 255, 0.22)',
                  backdropFilter: 'blur(18px)',
                }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              >
                <Flame className="w-4 h-4" />
                WINNER DEMO
              </motion.button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
      <RankMenu open={rankMenuOpen} onOpenChange={setRankMenuOpen} currentMMR={currentMMR} />
    </div>
  );
}
