import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

type MatchupSide = {
  label: string; // e.g. 'YOU' | 'OPPONENT'
  username: string;
  rank?: string; // e.g. 'Gold III'
  level?: number; // player level
  mmr?: number; // player MMR
  color?: string; // player card color (e.g. '#10B981' for green)
};

type MatchupPayload = {
  left: MatchupSide;
  right: MatchupSide;
  center?: {
    title?: string; // defaults to 'VS'
    subtitle?: string; // optional smaller line under the title
  };
};

type StartMatchOptions = {
  message?: string;
  /**
   * Optional subject name used to theme the shutter visuals (e.g. 'physics', 'math', 'chemistry', 'english').
   * This does NOT affect animation timing — only styling.
   */
  subject?: string;
  /**
   * Optional matchup payload to show "YOU vs OPPONENT" full-door info and a VS lockup in the center.
   */
  matchup?: MatchupPayload;
  /**
   * Legacy fixed loading delay. If `waitFor` is provided, this becomes the default `minLoadingMs`
   * (unless `minLoadingMs` is explicitly provided).
   */
  loadingMs?: number;
  /**
   * Minimum time (in ms) to keep the shutter closed AFTER `onClosed()` has been called.
   * Useful to avoid a jarring instant open on very fast loads.
   */
  minLoadingMs?: number;
  /**
   * Maximum time (in ms) to keep the shutter closed while waiting for `waitFor`.
   * Safety fallback so the UI can't get stuck closed forever.
   */
  maxLoadingMs?: number;
  /**
   * Optional gate to wait on (e.g., "first question loaded"). When provided, the shutter will not
   * open until the promise resolves OR `maxLoadingMs` elapses.
   */
  waitFor?: Promise<void>;
  onClosed?: () => void;
};

type ElevatorShutterContextValue = {
  startMatch: (options?: StartMatchOptions) => Promise<void>;
  isRunning: boolean;
};

const ElevatorShutterContext = createContext<ElevatorShutterContextValue | null>(null);

type SubjectTheme = {
  accent: string;
  accentSoft: string;
  accentSofter: string;
  patternImage?: string;
  patternSize?: string;
  patternOpacity: number;
  patternBlendMode?: 'screen' | 'overlay' | 'soft-light' | 'normal';
};

function normalizeSubject(subject?: string): string {
  const s = (subject ?? '').trim().toLowerCase();
  if (s === 'maths') return 'math';
  return s;
}

const DEFAULT_SUBJECT_THEME: SubjectTheme = {
  accent: '#A78BFA', // indigo/violet
  accentSoft: 'rgba(167, 139, 250, 0.16)',
  accentSofter: 'rgba(167, 139, 250, 0.08)',
  patternImage: undefined,
  patternSize: undefined,
  patternOpacity: 0,
  patternBlendMode: 'screen',
};

const SUBJECT_THEMES: Record<string, SubjectTheme> = {
  physics: {
    accent: '#38BDF8',
    accentSoft: 'rgba(56, 189, 248, 0.16)',
    accentSofter: 'rgba(56, 189, 248, 0.08)',
    patternImage: 'var(--pattern-circuit)',
    patternSize: '120px 120px',
    patternOpacity: 0.22,
    patternBlendMode: 'screen',
  },
  math: {
    accent: '#60A5FA',
    accentSoft: 'rgba(96, 165, 250, 0.15)',
    accentSofter: 'rgba(96, 165, 250, 0.08)',
    patternImage: 'var(--pattern-grid)',
    patternSize: '90px 90px',
    patternOpacity: 0.18,
    patternBlendMode: 'screen',
  },
  chemistry: {
    accent: '#E879F9',
    accentSoft: 'rgba(232, 121, 249, 0.14)',
    accentSofter: 'rgba(232, 121, 249, 0.08)',
    patternImage: 'var(--pattern-hex)',
    patternSize: '80px 80px',
    patternOpacity: 0.22,
    patternBlendMode: 'screen',
  },
  english: {
    accent: '#FBBF24',
    accentSoft: 'rgba(251, 191, 36, 0.12)',
    accentSofter: 'rgba(251, 191, 36, 0.06)',
    // Subtle “paper line” vibe without adding new global CSS vars.
    patternImage:
      'repeating-linear-gradient(0deg, rgba(251, 191, 36, 0.08) 0px, rgba(251, 191, 36, 0.08) 1px, transparent 1px, transparent 22px)',
    patternSize: 'auto',
    patternOpacity: 0.22,
    patternBlendMode: 'screen',
  },
};

function getSubjectTheme(subject?: string): SubjectTheme {
  const key = normalizeSubject(subject);
  return SUBJECT_THEMES[key] ?? DEFAULT_SUBJECT_THEME;
}

function clampName(name: string): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Player';
}

function getInitials(name: string): string {
  const cleaned = clampName(name);
  const letters = cleaned.replace(/[^a-zA-Z0-9]/g, '');
  const first = letters.slice(0, 2);
  return (first.length > 0 ? first : cleaned.slice(0, 2)).toUpperCase();
}

// Simpler dark base
const DOOR_BASE = '#0A0A0F';
const DOOR_BASE_BOTTOM = '#12121A';

export function ElevatorShutterProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('MATCH FOUND');
  const [subject, setSubject] = useState<string | undefined>(undefined);
  const [matchup, setMatchup] = useState<MatchupPayload | null>(null);
  const [impactKey, setImpactKey] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const leftControls = useAnimation();
  const rightControls = useAnimation();
  const textControls = useAnimation();

  const runningRef = useRef(false);
  const prefersReducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
    []
  );
  const noiseLeftId = useMemo(() => `shutterNoiseLeft-${Math.random().toString(36).slice(2, 9)}`, []);
  const noiseRightId = useMemo(() => `shutterNoiseRight-${Math.random().toString(36).slice(2, 9)}`, []);

  const startMatch = useCallback(
    async ({
      message = 'MATCH FOUND',
      subject: subjectOverride,
      matchup: matchupOverride,
      loadingMs,
      minLoadingMs,
      maxLoadingMs,
      waitFor,
      onClosed,
    }: StartMatchOptions = {}) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setIsRunning(true);

      setMessage(message);
      setSubject(subjectOverride);
      setMatchup(matchupOverride ?? null);
      setImpactKey(null);
      setActive(true);

      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

      // Ensure consistent initial positions
      leftControls.set({ x: '-100%' });
      rightControls.set({ x: '100%' });
      textControls.set({ opacity: 0, scale: 0.98 });

      // Close doors
      await Promise.all([
        leftControls.start({ x: '0%', transition: { duration: 0.8, ease: 'easeInOut' } }),
        rightControls.start({ x: '0%', transition: { duration: 0.8, ease: 'easeInOut' } }),
      ]);

      // Trigger impact visuals exactly when doors meet (timing unchanged).
      setImpactKey(Date.now());

      // Micro recoil/settle for impact when doors meet
      await Promise.all([
        leftControls.start({
          x: ['0%', '0.6%', '0%'],
          transition: { duration: 0.18, ease: 'easeInOut' },
        }),
        rightControls.start({
          x: ['0%', '-0.6%', '0%'],
          transition: { duration: 0.18, ease: 'easeInOut' },
        }),
      ]);

      // Show loading text once closed
      await textControls.start({ opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } });

      // Navigate behind the shutter while fully closed
      onClosed?.();

      // Wait for the game to be ready (or a fixed delay if no gate provided)
      if (waitFor) {
        const minMs = Math.max(0, minLoadingMs ?? loadingMs ?? 0);
        const startedAt = Date.now();

        if (maxLoadingMs == null) {
          // Wait indefinitely until the gate resolves (or rejects).
          await waitFor.catch((err) => {
            console.warn('[ElevatorShutter] waitFor rejected; opening anyway', err);
          });
        } else {
          const maxMs = Math.max(minMs, maxLoadingMs);
          await Promise.race([
            waitFor.catch((err) => {
              console.warn('[ElevatorShutter] waitFor rejected; opening anyway', err);
            }),
            sleep(maxMs).then(() => {
              console.warn('[ElevatorShutter] waitFor timed out; opening anyway', { maxMs });
            }),
          ]);
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed < minMs) {
          await sleep(minMs - elapsed);
        }
      } else {
        // Legacy: Simulated fixed loading time
        await sleep(Math.max(0, loadingMs ?? 2000));
      }

      // Hide text before opening
      await textControls.start({ opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } });

      // Open doors
      await Promise.all([
        leftControls.start({ x: '-100%', transition: { duration: 0.8, ease: 'easeInOut' } }),
        rightControls.start({ x: '100%', transition: { duration: 0.8, ease: 'easeInOut' } }),
      ]);

      setActive(false);
      setIsRunning(false);
      runningRef.current = false;
    },
    [leftControls, rightControls, textControls]
  );

  const value = useMemo(() => ({ startMatch, isRunning }), [startMatch, isRunning]);
  const theme = useMemo(() => getSubjectTheme(subject), [subject]);

  return (
    <ElevatorShutterContext.Provider value={value}>
      {children}

      {/* Overlay */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 10000,
          pointerEvents: active ? 'auto' : 'none',
        }}
        aria-hidden={!active}
      >
        {/* Left door */}
        <motion.div
          className="absolute left-0 top-0 h-full w-1/2 overflow-hidden"
          initial={{ x: '-100%' }}
          animate={leftControls}
          style={{
            background: `linear-gradient(180deg, ${DOOR_BASE} 0%, ${DOOR_BASE_BOTTOM} 100%)`,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
            willChange: 'transform',
          }}
        >
          {/* Subtle grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none">
            <filter id={noiseLeftId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseLeftId})`} />
          </svg>

          {/* Full-door player info (left / YOU) */}
          {matchup ? (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center px-8"
              style={{
                background: matchup.left.color
                  ? `linear-gradient(135deg, ${matchup.left.color}08 0%, transparent 70%)`
                  : undefined,
              }}
            >
              {/* Player label */}
              <div
                className="text-xs md:text-sm font-mono tracking-[0.4em] uppercase mb-4"
                style={{
                  color: matchup.left.color || '#10B981',
                  opacity: 0.7,
                }}
              >
                {matchup.left.label || 'YOU'}
              </div>

              {/* Player name */}
              <div
                className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 text-center"
                style={{
                  fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                  textShadow: `0 0 40px ${matchup.left.color || '#10B981'}40`,
                }}
              >
                {clampName(matchup.left.username)}
              </div>

              {/* Stats row */}
              <div className="flex flex-col gap-3 items-center">
                {matchup.left.rank && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white/40 uppercase tracking-wider">Rank</div>
                    <div
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                    >
                      {matchup.left.rank}
                    </div>
                  </div>
                )}
                {matchup.left.level && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white/40 uppercase tracking-wider">Level</div>
                    <div
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                    >
                      {matchup.left.level}
                    </div>
                  </div>
                )}
                {matchup.left.mmr && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white/40 uppercase tracking-wider">MMR</div>
                    <div
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                    >
                      {matchup.left.mmr}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* Right door */}
        <motion.div
          className="absolute right-0 top-0 h-full w-1/2 overflow-hidden"
          initial={{ x: '100%' }}
          animate={rightControls}
          style={{
            background: `linear-gradient(180deg, ${DOOR_BASE} 0%, ${DOOR_BASE_BOTTOM} 100%)`,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
            willChange: 'transform',
          }}
        >
          {/* Subtle grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none">
            <filter id={noiseRightId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseRightId})`} />
          </svg>

          {/* Full-door player info (right / OPPONENT) */}
          {matchup ? (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center px-8"
              style={{
                background: matchup.right.color
                  ? `linear-gradient(225deg, ${matchup.right.color}08 0%, transparent 70%)`
                  : undefined,
              }}
            >
              {/* Player label */}
              <div
                className="text-xs md:text-sm font-mono tracking-[0.4em] uppercase mb-4"
                style={{
                  color: matchup.right.color || '#EF4444',
                  opacity: 0.7,
                }}
              >
                {matchup.right.label || 'OPPONENT'}
              </div>

              {/* Player name */}
              <div
                className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 text-center"
                style={{
                  fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                  textShadow: `0 0 40px ${matchup.right.color || '#EF4444'}40`,
                }}
              >
                {clampName(matchup.right.username)}
              </div>

              {/* Stats row */}
              <div className="flex flex-col gap-3 items-center">
                {matchup.right.rank && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white/40 uppercase tracking-wider">Rank</div>
                    <div
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                    >
                      {matchup.right.rank}
                    </div>
                  </div>
                )}
                {matchup.right.level && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white/40 uppercase tracking-wider">Level</div>
                    <div
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                    >
                      {matchup.right.level}
                    </div>
                  </div>
                )}
                {matchup.right.mmr && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-white/40 uppercase tracking-wider">MMR</div>
                    <div
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                    >
                      {matchup.right.mmr}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* Impact layer (flash + swipe) */}
        {active && impactKey != null ? (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Center seam flash */}
            <motion.div
              key={`seam-${impactKey}`}
              initial={{ opacity: 0, scaleY: 0.75 }}
              animate={
                prefersReducedMotion
                  ? { opacity: 0.6, scaleY: 1 }
                  : { opacity: [0, 1, 0], scaleY: [0.75, 1, 1.15] }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.55, ease: 'easeOut', times: [0, 0.22, 1] }
              }
              className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-[4px]"
              style={{
                background: `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.85) 18%, ${theme.accentSoft} 50%, rgba(255,255,255,0.55) 82%, transparent 100%)`,
                filter: 'blur(0.2px)',
                boxShadow: `0 0 26px ${theme.accentSoft}, 0 0 60px rgba(255,255,255,0.12)`,
                transformOrigin: 'center',
              }}
            />

            {/* Diagonal swipe streak */}
            {!prefersReducedMotion ? (
              <motion.div
                key={`swipe-${impactKey}`}
                initial={{ opacity: 0, x: '-140%', rotate: -14, scale: 0.95 }}
                animate={{ opacity: [0, 1, 0], x: ['-140%', '140%'], scale: [0.95, 1.05, 1] }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], times: [0, 0.18, 1] }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[160px] rounded-full"
                style={{
                  background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 32%, ${theme.accentSoft} 50%, rgba(255,255,255,0.32) 68%, rgba(255,255,255,0) 100%)`,
                  filter: 'blur(10px)',
                  mixBlendMode: 'screen',
                  willChange: 'transform, opacity',
                }}
              />
            ) : null}
          </div>
        ) : null}

        {/* Center text */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-20"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={textControls}
          style={{ willChange: 'opacity, transform' }}
        >
          <div
            className="relative text-center"
            style={{
              color: '#F8FAFC',
              textShadow: '0 0 12px rgba(255,255,255,0.2)',
            }}
          >
            <motion.div
              className="text-5xl md:text-7xl font-extrabold tracking-wide relative"
              animate={active ? { y: [0, -2, 0] } : { y: 0 }}
              transition={{
                duration: 0.85,
                repeat: active ? Infinity : 0,
                ease: 'easeInOut',
              }}
            >
              {matchup ? (matchup.center?.title ?? 'VS') : message}
            </motion.div>

            {matchup && (matchup.center?.subtitle ?? 'LOADING') ? (
              <div className="mt-2 text-[10px] md:text-xs text-white/50 font-mono tracking-[0.35em] uppercase">
                {matchup.center?.subtitle ?? 'LOADING'}
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </ElevatorShutterContext.Provider>
  );
}

export function useElevatorShutter() {
  const ctx = useContext(ElevatorShutterContext);
  if (!ctx) {
    throw new Error('useElevatorShutter must be used within ElevatorShutterProvider');
  }
  return ctx;
}


