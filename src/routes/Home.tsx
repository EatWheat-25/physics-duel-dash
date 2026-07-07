import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { RankMenu } from '@/components/RankMenu';
import { ChevronRight, History, LogOut, Plus, Settings, Shield, Sparkles, Trophy, X } from 'lucide-react';
import { StudyPatternBackground } from '@/components/StudyPatternBackground';
import { RollingNumber } from '@/components/battle/RollingNumber';
import {
  PREMIUM_EASE,
  fadeDown,
  fadeLeft,
  fadeRight,
  hoverLift,
  staggerContainer,
  tapPress,
} from '@/lib/motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCharacter } from '@/hooks/useCharacter';
import { useIsAdmin } from '@/hooks/useUserRole';
import { getRankByPoints } from '@/types/ranking';
import { useMatchmakingPrefs } from '@/store/useMatchmakingPrefs';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { selectedCharacter } = useCharacter();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { subject: mmSubject, level: mmLevel } = useMatchmakingPrefs();
  const { status: matchmakingStatus, startMatchmaking, leaveQueue } = useMatchmaking();
  const [rankMenuOpen, setRankMenuOpen] = useState(false);
  const [currentMMR, setCurrentMMR] = useState<number>(0);
  const [queueTime, setQueueTime] = useState(0);
  const initialOnboardingStatus =
    profile?.onboarding_completed ? 'complete' : profile ? 'incomplete' : 'unknown';
  const [onboardingStatus, setOnboardingStatus] = useState<
    'unknown' | 'complete' | 'incomplete'
  >(initialOnboardingStatus);
  const prefersReducedMotion = useReducedMotion();

  // Spring-smoothed 3D tilt + cursor sheen for the player card.
  const cardRef = useRef<HTMLDivElement>(null);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(30);
  const sheenOpacity = useMotionValue(0);
  const springTiltX = useSpring(tiltX, { stiffness: 220, damping: 28, mass: 0.8 });
  const springTiltY = useSpring(tiltY, { stiffness: 220, damping: 28, mass: 0.8 });
  const springSheenOpacity = useSpring(sheenOpacity, { stiffness: 180, damping: 26 });
  const sheenBackground = useMotionTemplate`radial-gradient(420px 320px at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.10) 0%, transparent 65%)`;

  const handleCardMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height;
      const MAX_TILT = 4;
      tiltX.set((0.5 - py) * MAX_TILT * 2);
      tiltY.set((px - 0.5) * MAX_TILT * 2);
      sheenX.set(px * 100);
      sheenY.set(py * 100);
      sheenOpacity.set(1);
    },
    [prefersReducedMotion, tiltX, tiltY, sheenX, sheenY, sheenOpacity]
  );

  const handleCardMouseLeave = useCallback(() => {
    tiltX.set(0);
    tiltY.set(0);
    sheenOpacity.set(0);
  }, [tiltX, tiltY, sheenOpacity]);

  useEffect(() => {
    if (onboardingStatus !== 'complete') return;
    document.title = 'Lobby | BattleNerds';
  }, [onboardingStatus]);

  useEffect(() => {
    if (!user) {
      setOnboardingStatus('unknown');
      return;
    }

    if (profile?.onboarding_completed) {
      setOnboardingStatus('complete');
      return;
    }

    if (profile && !profile.onboarding_completed) {
      setOnboardingStatus('incomplete');
      return;
    }

    // Profile may not be loaded yet; double-check in DB to avoid misrouting onboarded users.
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error('Error checking onboarding status:', error);
          setOnboardingStatus('incomplete');
          return;
        }

        setOnboardingStatus(data?.onboarding_completed ? 'complete' : 'incomplete');
      } catch (err) {
        if (cancelled) return;
        console.error('Error checking onboarding status:', err);
        setOnboardingStatus('incomplete');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    if (onboardingStatus !== 'complete') return;
    
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
  }, [user, onboardingStatus]);

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
  const username = profile?.username ?? user?.email?.split('@')[0] ?? 'Player';
  const initial = (username?.[0] || '?').toUpperCase();
  const hasMatchmakingPrefs = Boolean(mmSubject && mmLevel);
  const subjectLabel = mmSubject
    ? mmSubject === 'math'
      ? 'Mathematics'
      : mmSubject === 'chemistry'
        ? 'Chemistry'
        : 'Physics'
    : '';
  const levelLabel = mmLevel ? (mmLevel === 'Both' ? 'AS + A2' : mmLevel) : '';

  useEffect(() => {
    if (onboardingStatus !== 'complete') return;
    if (matchmakingStatus !== 'searching') {
      setQueueTime(0);
      return;
    }

    setQueueTime(0);
    const interval = setInterval(() => {
      setQueueTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [matchmakingStatus, onboardingStatus]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (onboardingStatus === 'unknown') {
    return <LoadingScreen />;
  }

  if (onboardingStatus === 'incomplete') {
    return <Navigate to="/onboarding" replace />;
  }

  const handleStartMatchmaking = () => {
    if (matchmakingStatus === 'searching') return;

    if (!hasMatchmakingPrefs) {
      navigate('/matchmaking-new');
      return;
    }

    const subject = mmSubject as string;
    let level = mmLevel as string;
    // Keep normalization consistent with LobbyNew
    if (level === 'Both') level = 'A2';

    startMatchmaking(subject, level);
  };

  const handleCancelMatchmaking = async () => {
    await leaveQueue();
    setQueueTime(0);
  };

  return (
    <div className="relative h-full overflow-hidden text-white font-sans flex flex-col">
      {/* Study Icons Pattern Background */}
      <StudyPatternBackground variant="battleNerds" />

      {/* Top bar (centered nav like reference) */}
      <motion.header
        className="relative z-30 w-full px-4 sm:px-6 lg:px-8 pt-5 shrink-0"
        variants={fadeDown}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="visible"
      >
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
              <div className="font-semibold text-sm sm:text-base">BattleNerds</div>
              <div className="text-xs text-white/60">Lobby</div>
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
                  className={`group relative py-2 text-sm font-medium transition-colors ${
                    active ? 'text-white' : 'text-white/70 hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {!active && (
                    <span
                      className="absolute -inset-x-4 -inset-y-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      aria-hidden="true"
                    />
                  )}
                  {active && (
                    <motion.span
                      layoutId="homeNavPill"
                      className="absolute -inset-x-4 -inset-y-2 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(163,230,53,0.22)',
                        boxShadow: '0 0 28px rgba(163,230,53,0.10)',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                      aria-hidden="true"
                    />
                  )}
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="homeNavUnderline"
                      className="absolute left-0 right-0 -bottom-1 mx-auto h-0.5 w-10 rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(163,230,53,0), rgba(163,230,53,1), rgba(163,230,53,0))',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
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
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                }}
              >
                {initial}
              </div>
              <div className="leading-tight text-left">
                <div className="text-sm font-bold text-white">{username}</div>
                <div className="text-xs text-white/60">Lv {level}</div>
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
      </motion.header>

      {/* Valorant-style queue status popup (top-center) */}
      <AnimatePresence>
        {matchmakingStatus === 'searching' && (
          <div className="fixed inset-x-0 top-20 z-40 flex justify-center pointer-events-none">
            <motion.div
              className="pointer-events-auto flex items-center gap-4 rounded-2xl px-6 py-3"
              style={{
                background: 'rgba(15, 23, 42, 0.82)',
                border: '1px solid rgba(163, 230, 53, 0.28)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 18px 55px rgba(0,0,0,0.55), 0 0 36px rgba(163,230,53,0.10)',
              }}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              role="status"
              aria-live="polite"
            >
              {/* Radar pulse */}
              <span className="relative inline-flex h-5 w-5 items-center justify-center">
                <span className="absolute h-2.5 w-2.5 rounded-full bg-lime-400" />
                {!prefersReducedMotion && (
                  <>
                    <motion.span
                      className="absolute h-2.5 w-2.5 rounded-full border border-lime-400"
                      animate={{ scale: [1, 3.2], opacity: [0.8, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <motion.span
                      className="absolute h-2.5 w-2.5 rounded-full border border-lime-400"
                      animate={{ scale: [1, 3.2], opacity: [0.8, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
                    />
                  </>
                )}
              </span>

              <div className="leading-tight text-left">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">
                  Finding Match
                </div>
                <div className="text-xl font-bold text-white tabular-nums">
                  {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelMatchmaking}
                className="ml-2 h-8 w-8 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
                aria-label="Cancel matchmaking"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="relative z-20 flex-1 min-h-0">
        {/* Keep the lobby clean like the reference (no large character overlay) */}

        {/* Left stack — pinned to viewport left edge */}
        <motion.div
          className="hidden lg:flex fixed left-4 xl:left-6 2xl:left-8 top-24 xl:top-28 w-[240px] xl:w-[260px] flex-col gap-3 z-20"
          variants={staggerContainer(0.06, 0.15)}
          initial={prefersReducedMotion ? false : 'hidden'}
          animate="visible"
        >
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
            variants={fadeLeft}
            whileHover={prefersReducedMotion ? undefined : hoverLift}
            whileTap={prefersReducedMotion ? undefined : tapPress}
            aria-label="Selected mode"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-lime-400/70" />
            <div className="text-sm font-semibold text-white">UNRATED</div>
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
            variants={fadeLeft}
            whileHover={prefersReducedMotion ? undefined : hoverLift}
            whileTap={prefersReducedMotion ? undefined : tapPress}
            aria-label="Open leaderboard"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-sky-400/70" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{rank.displayName}</div>
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
            variants={fadeLeft}
            whileHover={prefersReducedMotion ? undefined : hoverLift}
            whileTap={prefersReducedMotion ? undefined : tapPress}
            aria-label="Review last game"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-white/30" />
            <div className="text-sm font-semibold text-white">VICTORY</div>
            <div className="text-xs text-white/55 mt-1">Review Last Game</div>
          </motion.button>
        </motion.div>

        {/* Center player card — always centered in viewport */}
        <div
          className="fixed left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-[clamp(260px,38vh,360px)] max-w-[min(90vw,calc(100vw-560px))] aspect-[5/7] z-10"
          style={{ perspective: 1100 }}
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 1, delay: 0.2 }}
            className="relative h-full w-full"
          >
            {/* Ambient breathing glow behind the card */}
            <motion.div
              className="absolute -inset-3 rounded-[2rem] pointer-events-none"
              style={{ background: rank.gradient, filter: 'blur(28px)' }}
              initial={{ opacity: 0.3 }}
              animate={prefersReducedMotion ? { opacity: 0.35 } : { opacity: [0.28, 0.5, 0.28] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />

            <motion.div
              ref={cardRef}
              className="relative h-full w-full"
              style={{
                rotateX: springTiltX,
                rotateY: springTiltY,
                transformStyle: 'preserve-3d',
              }}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
            {/* Gradient outline wrapper (clean, premium) */}
            <div
              className="relative h-full w-full rounded-3xl p-[1px]"
              style={{
                background: rank.gradient,
                boxShadow:
                  '0 22px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              {/* Matte surface */}
              <div
                className="relative h-full w-full rounded-[calc(1.5rem-1px)] overflow-hidden"
                style={{
                  background: 'rgba(15, 23, 42, 0.78)',
                  backdropFilter: 'blur(18px)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -18px 30px rgba(0,0,0,0.35)',
                }}
              >
                {/* Soft toon-shading (robot vibe) */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-30"
                  style={{
                    background: [
                      'radial-gradient(500px 380px at 18% 20%, rgba(56, 189, 248, 0.16) 0%, transparent 60%)',
                      'radial-gradient(460px 360px at 82% 30%, rgba(147, 197, 253, 0.10) 0%, transparent 58%)',
                      'radial-gradient(520px 420px at 50% 88%, rgba(56, 189, 248, 0.10) 0%, transparent 62%)',
                    ].join(','),
                  }}
                />

                {/* Matte grain (subtle) */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none">
                  <filter id="homeCardNoise">
                    <feTurbulence
                      type="fractalNoise"
                      baseFrequency="0.75"
                      numOctaves="3"
                      stitchTiles="stitch"
                    />
                    <feColorMatrix type="saturate" values="0" />
                  </filter>
                  <rect width="100%" height="100%" filter="url(#homeCardNoise)" />
                </svg>

                {/* Robot watermark (inspired, original vector) */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.10]"
                  viewBox="0 0 100 140"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Head */}
                  <rect x="18" y="18" width="64" height="46" rx="18" fill="rgba(56,189,248,0.08)" />
                  <rect x="22" y="22" width="56" height="38" rx="14" fill="rgba(255,255,255,0.04)" />
                  {/* Ears */}
                  <circle cx="16" cy="41" r="10" fill="rgba(56,189,248,0.06)" />
                  <circle cx="84" cy="41" r="10" fill="rgba(56,189,248,0.06)" />
                  <circle cx="16" cy="41" r="6" fill="rgba(255,255,255,0.04)" />
                  <circle cx="84" cy="41" r="6" fill="rgba(255,255,255,0.04)" />

                  {/* Eyes */}
                  <rect x="38" y="36" width="8" height="14" rx="4" fill="rgba(255,255,255,0.55)" />
                  <rect x="54" y="36" width="8" height="14" rx="4" fill="rgba(255,255,255,0.55)" />

                  {/* Body */}
                  <rect x="28" y="66" width="44" height="44" rx="18" fill="rgba(56,189,248,0.05)" />
                  <rect x="32" y="70" width="36" height="36" rx="14" fill="rgba(255,255,255,0.03)" />

                  {/* Antenna (to avoid copying the reference) */}
                  <path d="M50 14 v-6" stroke="rgba(56,189,248,0.35)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="50" cy="6" r="3" fill="rgba(56,189,248,0.30)" />

                  {/* Outline strokes */}
                  <rect x="18" y="18" width="64" height="46" rx="18" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="2" />
                  <rect x="28" y="66" width="44" height="44" rx="18" fill="none" stroke="rgba(56,189,248,0.28)" strokeWidth="2" />
                </svg>

                {/* Etched inner border + corner ticks */}
                <div
                  className="absolute inset-2 rounded-2xl pointer-events-none"
                  style={{
                    border: `1px solid ${rank.color}`,
                    opacity: 0.2,
                  }}
                />
                <div className="absolute inset-[10px] rounded-[18px] border border-white/5 pointer-events-none" />
                <div
                  className="absolute left-3 top-3 h-3 w-3 pointer-events-none"
                  style={{
                    borderLeft: `2px solid ${rank.color}`,
                    borderTop: `2px solid ${rank.color}`,
                    opacity: 0.35,
                  }}
                />
                <div
                  className="absolute right-3 top-3 h-3 w-3 pointer-events-none"
                  style={{
                    borderRight: `2px solid ${rank.color}`,
                    borderTop: `2px solid ${rank.color}`,
                    opacity: 0.35,
                  }}
                />
                <div
                  className="absolute left-3 bottom-3 h-3 w-3 pointer-events-none"
                  style={{
                    borderLeft: `2px solid ${rank.color}`,
                    borderBottom: `2px solid ${rank.color}`,
                    opacity: 0.35,
                  }}
                />
                <div
                  className="absolute right-3 bottom-3 h-3 w-3 pointer-events-none"
                  style={{
                    borderRight: `2px solid ${rank.color}`,
                    borderBottom: `2px solid ${rank.color}`,
                    opacity: 0.35,
                  }}
                />

                <div className="relative p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white/80 truncate">
                        {rank.displayName}
                      </div>
                      <div className="mt-1 text-xs text-white/55">Level {level}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white tabular-nums">
                        <RollingNumber value={mmr} duration={0.9} delay={0.5} cycles={1} stagger={0.05} />
                      </div>
                      <div className="text-xs text-white/55">MMR</div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-center">
                    <div
                      className="h-20 w-20 rounded-full flex items-center justify-center"
                      style={{
                        background:
                          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 65%, rgba(0,0,0,0.15) 100%)',
                        border: `1px solid ${rank.color}`,
                        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                      }}
                    >
                      <span className="text-3xl font-bold text-white">{initial}</span>
                    </div>
                  </div>

                  <div className="mt-6 text-center">
                    <div className="text-2xl font-bold text-white">{username}</div>
                    <div className="text-sm text-white/55">{rank.displayName}</div>
                  </div>

                  <div className="mt-auto pt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => navigate('/profile')}
                      className="text-xs font-medium transition-colors text-white/60 hover:text-white"
                    >
                      Customize Card
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/progression')}
                      className="text-xs font-medium transition-colors text-white/60 hover:text-white"
                    >
                      View Progression
                    </button>
                  </div>
                </div>

                {/* Cursor-following light sheen */}
                <motion.div
                  className="absolute inset-0 rounded-[calc(1.5rem-1px)] pointer-events-none"
                  style={{ background: sheenBackground, opacity: springSheenOpacity }}
                  aria-hidden="true"
                />
              </div>
            </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Right widgets — pinned to viewport right edge */}
        <motion.div
          className="hidden lg:flex fixed right-4 xl:right-6 2xl:right-8 top-24 xl:top-28 w-[300px] xl:w-[340px] flex-col gap-3 z-20"
          variants={staggerContainer(0.06, 0.15)}
          initial={prefersReducedMotion ? false : 'hidden'}
          animate="visible"
        >
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
            variants={fadeRight}
            whileHover={prefersReducedMotion ? undefined : hoverLift}
            whileTap={prefersReducedMotion ? undefined : tapPress}
            aria-label="Battle pass"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-white/60">Battle Pass</div>
                  <div className="mt-1 text-lg font-bold text-white">Season Rewards</div>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-semibold text-white"
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
            onClick={() => navigate('/campaign')}
            className="w-full text-left rounded-2xl p-4"
            style={{
              background: 'rgba(15, 23, 42, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
            }}
            variants={fadeRight}
            whileHover={prefersReducedMotion ? undefined : hoverLift}
            whileTap={prefersReducedMotion ? undefined : tapPress}
            aria-label="Campaign mode"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-white/60">Campaign</div>
                <div className="mt-1 text-lg font-bold text-white">Topic Ranked Run</div>
              </div>
              <div
                className="px-3 py-1 rounded-full text-[10px] font-semibold text-white"
                style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                NEW
              </div>
            </div>
            <div className="mt-3 text-sm text-white/65">
              Pick a subject, lock a topic, and climb that campaign ladder.
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
            variants={fadeRight}
            whileHover={prefersReducedMotion ? undefined : hoverLift}
            whileTap={prefersReducedMotion ? undefined : tapPress}
            aria-label="Challenges"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-white/60">Challenges</div>
                <div className="mt-1 text-lg font-bold text-white">Daily Ops</div>
              </div>
              <div className="text-sm font-semibold text-white/90">3/5</div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[60%] rounded-full bg-indigo-400/70" />
              </div>
              <span className="text-xs text-white/60">60%</span>
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
            variants={fadeRight}
            whileHover={prefersReducedMotion ? undefined : hoverLift}
            whileTap={prefersReducedMotion ? undefined : tapPress}
            aria-label="Activity"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-white/60">Activity</div>
                <div className="mt-1 text-lg font-bold text-white">Queue</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/60" />
            </div>
            <div className="mt-3 text-sm text-white/65">Jump in and find an opponent.</div>
          </motion.button>
        </motion.div>

        {/* Bottom-left actions — pinned to viewport bottom-left edge */}
        <motion.div
          className="fixed left-4 xl:left-6 2xl:left-8 bottom-4 xl:bottom-8 w-[min(560px,calc(100vw-2rem))] lg:w-[min(560px,calc(100vw-640px))] z-20"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: PREMIUM_EASE, delay: 0.35 }}
        >
          <div className="grid grid-cols-1 gap-2">
            <motion.button
              type="button"
              onClick={() => navigate('/campaign')}
              className="w-full inline-flex items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left"
              style={{
                background: '#facc15',
                color: '#0b1220',
                border: '1px solid rgba(0,0,0,0.35)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
              }}
              whileHover={prefersReducedMotion ? undefined : hoverLift}
              whileTap={prefersReducedMotion ? undefined : tapPress}
              aria-label="Campaign mode"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.32em] opacity-70">
                  Campaign
                </div>
                <div className="mt-2 text-2xl font-black uppercase tracking-[0.08em]">
                  Choose Topic And Play
                </div>
                <div className="mt-2 text-sm font-medium opacity-75">
                  Physics, chemistry, or math with A1/A2 and a dedicated campaign rank.
                </div>
              </div>
              <span className="text-2xl font-black opacity-80">»</span>
            </motion.button>
          </div>

          {hasMatchmakingPrefs && (
            <div className="mt-3 flex items-stretch gap-3">
              <motion.button
                type="button"
                onClick={() => navigate('/matchmaking-new?step=subject')}
                className="flex-1 w-full px-5 py-4 rounded-2xl text-left"
                style={{
                  background: 'rgba(15, 23, 42, 0.58)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 14px 44px rgba(0,0,0,0.4)',
                }}
                whileHover={prefersReducedMotion ? undefined : hoverLift}
                whileTap={prefersReducedMotion ? undefined : tapPress}
                aria-label="Change subject and grade"
              >
                <div className="text-xs text-white/60">Selected</div>
                <div className="mt-0.5 text-base font-semibold text-white">
                  {subjectLabel} <span className="text-white/40">•</span> {levelLabel}
                </div>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => navigate('/matchmaking-new?step=subject')}
                className="px-7 py-4 rounded-2xl text-sm font-extrabold tracking-widest"
                style={{
                  background: 'linear-gradient(135deg, #a3e635, #22c55e)',
                  color: '#0b1220',
                  border: '1px solid rgba(0,0,0,0.45)',
                  boxShadow: '0 14px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
                }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                aria-label="Change subject and grade"
              >
                CHANGE
              </motion.button>
            </div>
          )}

          <div className="mt-3 flex items-stretch gap-3">
            {/* START (primary) */}
            <motion.button
              onClick={handleStartMatchmaking}
              disabled={matchmakingStatus === 'searching'}
              className="relative overflow-hidden flex-1 min-w-[260px] px-8 py-6 text-2xl sm:text-3xl font-bold rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #a3e635, #22c55e)',
                color: '#0b1220',
                border: '1px solid rgba(0,0,0,0.45)',
                boxShadow: '0 18px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
                opacity: matchmakingStatus === 'searching' ? 0.85 : 1,
              }}
              animate={
                prefersReducedMotion || matchmakingStatus === 'searching'
                  ? { scale: 1 }
                  : { scale: [1, 1.01, 1] }
              }
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={prefersReducedMotion || matchmakingStatus === 'searching' ? undefined : { y: -2 }}
              whileTap={prefersReducedMotion || matchmakingStatus === 'searching' ? undefined : { scale: 0.99 }}
              aria-label="Start matchmaking"
            >
              {/* One-time gradient shimmer after the entrance settles */}
              {!prefersReducedMotion && matchmakingStatus !== 'searching' && (
                <motion.span
                  className="absolute inset-y-0 w-1/3 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                  }}
                  initial={{ left: '-40%' }}
                  animate={{ left: '120%' }}
                  transition={{ duration: 0.9, ease: PREMIUM_EASE, delay: 1.0 }}
                  aria-hidden="true"
                />
              )}

              <AnimatePresence mode="wait" initial={false}>
                {matchmakingStatus === 'searching' ? (
                  <motion.span
                    key="searching"
                    className="relative z-10 inline-flex items-center justify-center gap-3 text-lg sm:text-xl"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: PREMIUM_EASE }}
                  >
                    {/* Radar pulse */}
                    <span className="relative inline-flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-2.5 w-2.5 rounded-full bg-[#0b1220]" />
                      {!prefersReducedMotion && (
                        <>
                          <motion.span
                            className="absolute h-2.5 w-2.5 rounded-full border-2 border-[#0b1220]"
                            animate={{ scale: [1, 3], opacity: [0.7, 0] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                          />
                          <motion.span
                            className="absolute h-2.5 w-2.5 rounded-full border-2 border-[#0b1220]"
                            animate={{ scale: [1, 3], opacity: [0.7, 0] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
                          />
                        </>
                      )}
                    </span>
                    <span>SEARCHING</span>
                    <span className="text-base sm:text-lg font-semibold tabular-nums opacity-80">
                      {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
                    </span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="start"
                    className="relative z-10 inline-block"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: PREMIUM_EASE }}
                  >
                    START
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Slot 1: Career */}
            <motion.button
              type="button"
              onClick={() => navigate('/career')}
              className="h-[76px] w-[76px] rounded-2xl flex flex-col items-center justify-center gap-1"
              style={{
                background: 'rgba(15, 23, 42, 0.58)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 14px 44px rgba(0,0,0,0.35)',
              }}
              whileHover={prefersReducedMotion ? undefined : hoverLift}
              whileTap={prefersReducedMotion ? undefined : tapPress}
              aria-label="Career"
            >
              <History className="w-5 h-5 text-white/85" />
              <span className="text-[10px] font-semibold text-white/70">Career</span>
            </motion.button>

            {/* Slot 2: Placeholder */}
            <motion.button
              type="button"
              disabled
              className="h-[76px] w-[76px] rounded-2xl flex flex-col items-center justify-center gap-1 opacity-70 cursor-not-allowed"
              style={{
                background: 'rgba(15, 23, 42, 0.58)',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 14px 44px rgba(0,0,0,0.25)',
              }}
              aria-label="Coming soon"
            >
              <Plus className="w-5 h-5 text-white/70" />
              <span className="text-[10px] font-semibold text-white/60">Soon</span>
            </motion.button>

            {/* Slot 3: Placeholder / Cancel while searching */}
            {matchmakingStatus === 'searching' ? (
              <motion.button
                type="button"
                onClick={handleCancelMatchmaking}
                className="h-[76px] w-[76px] rounded-2xl flex flex-col items-center justify-center gap-1"
                style={{
                  background: 'rgba(15, 23, 42, 0.58)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 14px 44px rgba(0,0,0,0.35)',
                }}
                whileHover={prefersReducedMotion ? undefined : hoverLift}
                whileTap={prefersReducedMotion ? undefined : tapPress}
                aria-label="Cancel matchmaking"
              >
                <X className="w-5 h-5 text-white/85" />
                <span className="text-[10px] font-semibold text-white/70">Cancel</span>
              </motion.button>
            ) : (
              <motion.button
                type="button"
                disabled
                className="h-[76px] w-[76px] rounded-2xl flex flex-col items-center justify-center gap-1 opacity-70 cursor-not-allowed"
                style={{
                  background: 'rgba(15, 23, 42, 0.58)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 14px 44px rgba(0,0,0,0.25)',
                }}
                aria-label="Coming soon"
              >
                <Plus className="w-5 h-5 text-white/70" />
                <span className="text-[10px] font-semibold text-white/60">Soon</span>
              </motion.button>
            )}
          </div>

        </motion.div>

      </main>
      <RankMenu open={rankMenuOpen} onOpenChange={setRankMenuOpen} currentMMR={currentMMR} />
    </div>
  );
}
