import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { RankMenu } from '@/components/RankMenu';
import { ChevronRight, History, LogOut, Plus, Settings, Shield, Trophy, X } from 'lucide-react';
import { StudyPatternBackground } from '@/components/StudyPatternBackground';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCharacter } from '@/hooks/useCharacter';
import { useIsAdmin } from '@/hooks/useUserRole';
import { getRankByPoints } from '@/types/ranking';
import { useMatchmakingPrefs } from '@/store/useMatchmakingPrefs';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { LoadingScreen } from '@/components/LoadingScreen';
import { BrandMark } from '@/components/BrandMark';

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
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

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

      {/* Top bar */}
      <header className="relative z-30 w-full shrink-0">
        {/* Thin dark strip for contrast against the wallpaper */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 via-black/55 to-transparent backdrop-blur-xl"
          aria-hidden="true"
        />

        <div className="relative px-4 sm:px-6 pt-5">
          <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-[180px]">
            <BrandMark />
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
                  <span
                    className={`absolute -inset-x-4 -inset-y-2 rounded-full transition-opacity ${
                      active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    style={{
                      background: active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
                      border: active
                        ? '1px solid hsl(var(--bn-secondary) / 0.22)'
                        : '1px solid rgba(255,255,255,0.10)',
                      boxShadow: active ? '0 0 28px hsl(var(--bn-secondary) / 0.10)' : undefined,
                    }}
                    aria-hidden="true"
                  />
                  {item.label}
                  {active && (
                    <span
                      className="absolute left-0 right-0 -bottom-1 mx-auto h-0.5 w-10 rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, hsl(var(--bn-secondary) / 0), hsl(var(--bn-secondary)), hsl(var(--bn-secondary) / 0))',
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
        </div>
      </header>

      <main className="relative z-20 flex-1 min-h-0">
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
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              style={{ background: 'hsl(var(--bn-secondary) / 0.7)' }}
            />
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
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Open leaderboard"
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              style={{ background: 'hsl(var(--bn-secondary) / 0.7)' }}
            />
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
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            aria-label="Review last game"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-white/30" />
            <div className="text-sm font-semibold text-white">VICTORY</div>
            <div className="text-xs text-white/55 mt-1">Review Last Game</div>
          </motion.button>
        </div>

        {/* Center player card (Lobby layout) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[clamp(280px,40vh,360px)] max-w-[90vw] aspect-[5/7]">
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="relative h-full w-full"
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
                      <div className="text-2xl font-bold text-white tabular-nums">{mmr}</div>
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
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
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
        </div>

        {/* Bottom-left actions (START + quick actions) */}
        <div className="absolute left-6 bottom-8 w-[560px] max-w-[calc(100vw-3rem)]">
          <motion.button
            type="button"
            onClick={() => navigate('/modes')}
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold"
            style={{
              background: 'hsl(var(--bn-secondary))',
              color: 'hsl(var(--bn-primary-deep))',
              border: '1px solid rgba(0,0,0,0.35)',
              boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
            }}
            whileHover={prefersReducedMotion ? undefined : { y: -1 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            aria-label="Standard mode"
          >
            STANDARD <span className="opacity-80">»</span>
          </motion.button>

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
                whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
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
                  background:
                    'linear-gradient(135deg, hsl(var(--bn-secondary)), hsl(var(--bn-secondary-deep)))',
                  color: 'hsl(var(--bn-primary-deep))',
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

          {matchmakingStatus === 'searching' && (
            <div className="mt-3 text-xs text-white/70 tabular-nums">
              Searching… {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
            </div>
          )}

          <div className="mt-3 flex items-stretch gap-3">
            {/* START (primary) */}
            <motion.button
              onClick={handleStartMatchmaking}
              disabled={matchmakingStatus === 'searching'}
              className="flex-1 min-w-[260px] px-8 py-6 text-2xl sm:text-3xl font-bold rounded-2xl"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--bn-secondary)), hsl(var(--bn-secondary-deep)))',
                color: 'hsl(var(--bn-primary-deep))',
                border: '1px solid rgba(0,0,0,0.45)',
                boxShadow: '0 18px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
                opacity: matchmakingStatus === 'searching' ? 0.75 : 1,
              }}
              whileHover={prefersReducedMotion || matchmakingStatus === 'searching' ? undefined : { scale: 1.01 }}
              whileTap={prefersReducedMotion || matchmakingStatus === 'searching' ? undefined : { scale: 0.99 }}
              aria-label="Start matchmaking"
            >
              {matchmakingStatus === 'searching' ? 'SEARCHING…' : 'START'}
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
              whileHover={prefersReducedMotion ? undefined : { y: -1 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
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
                whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
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
        </div>

      </main>
      <RankMenu open={rankMenuOpen} onOpenChange={setRankMenuOpen} currentMMR={currentMMR} />
    </div>
  );
}
