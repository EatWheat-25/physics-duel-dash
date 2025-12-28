import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

type MatchupSide = {
  label: string; // e.g. 'YOU' | 'OPPONENT'
  username: string;
};

type MatchupPayload = {
  left: MatchupSide;
  right: MatchupSide;
  center?: {
    title?: string; // defaults to 'VERSUS'
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
   * Optional matchup payload to show "YOU vs OPPONENT" cards on the doors and a VS/VERSUS lockup in the center.
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

// Darkrai-inspired near-black base (theme-matched)
const DARKRAI_TOP = '#070610';
const DARKRAI_BOTTOM = '#140B22';

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
            background: `linear-gradient(180deg, ${DARKRAI_TOP} 0%, ${DARKRAI_BOTTOM} 100%)`,
            boxShadow:
              `inset 0 0 0 1px rgba(255,255,255,0.04), inset -18px 0 28px rgba(0,0,0,0.55), inset -2px 0 0 ${theme.accentSofter}`,
            willChange: 'transform',
          }}
        >
          {/* Matte grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none">
            <filter id={noiseLeftId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseLeftId})`} />
          </svg>
          {/* Subject texture accent (subtle) */}
          {theme.patternImage ? (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: theme.patternImage,
                backgroundSize: theme.patternSize ?? undefined,
                backgroundRepeat: 'repeat',
                backgroundPosition: '0 0',
                opacity: theme.patternOpacity,
                mixBlendMode: theme.patternBlendMode ?? 'screen',
              }}
            />
          ) : null}
          {/* Soft shading to feel more “ceramic/metal” than flat */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                `radial-gradient(900px 700px at 18% 18%, ${theme.accentSoft} 0%, transparent 58%), radial-gradient(900px 700px at 85% 75%, rgba(255,255,255,0.06) 0%, transparent 62%)`,
            }}
          />

          {/* Matchup card (left / YOU) */}
          {matchup ? (
            <div
              className="absolute top-1/2 -translate-y-1/2 right-4 md:right-8"
              style={{ width: 'min(86%, 340px)' }}
            >
              <div
                className="relative rounded-2xl border border-white/10 bg-black/25 backdrop-blur-xl px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
                style={{
                  boxShadow:
                    '0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 55%)',
                  }}
                />
                <div className="relative flex items-center gap-4 min-w-0">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center border shadow-[0_0_24px_rgba(16,185,129,0.18)]"
                    style={{
                      borderColor: 'rgba(16,185,129,0.45)',
                      background:
                        'radial-gradient(circle at 30% 30%, rgba(16,185,129,0.20) 0%, rgba(0,0,0,0.10) 60%)',
                    }}
                    aria-hidden
                  >
                    <span
                      className="text-sm font-black text-white/95"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif', letterSpacing: '0.08em' }}
                    >
                      {getInitials(matchup.left.username)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] md:text-xs font-mono tracking-[0.35em] uppercase text-emerald-300/80">
                      {matchup.left.label || 'YOU'}
                    </div>
                    <div
                      className="mt-1 text-lg md:text-2xl font-black tracking-tight text-white truncate"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                      title={clampName(matchup.left.username)}
                    >
                      {clampName(matchup.left.username)}
                    </div>
                  </div>
                </div>
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
            background: `linear-gradient(180deg, ${DARKRAI_TOP} 0%, ${DARKRAI_BOTTOM} 100%)`,
            boxShadow:
              `inset 0 0 0 1px rgba(255,255,255,0.04), inset 18px 0 28px rgba(0,0,0,0.55), inset 2px 0 0 ${theme.accentSofter}`,
            willChange: 'transform',
          }}
        >
          {/* Matte grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none">
            <filter id={noiseRightId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseRightId})`} />
          </svg>
          {/* Subject texture accent (subtle) */}
          {theme.patternImage ? (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: theme.patternImage,
                backgroundSize: theme.patternSize ?? undefined,
                backgroundRepeat: 'repeat',
                backgroundPosition: '40px 30px',
                opacity: theme.patternOpacity,
                mixBlendMode: theme.patternBlendMode ?? 'screen',
              }}
            />
          ) : null}
          {/* Soft shading to feel more “ceramic/metal” than flat */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                `radial-gradient(900px 700px at 82% 18%, ${theme.accentSoft} 0%, transparent 58%), radial-gradient(900px 700px at 18% 75%, rgba(255,255,255,0.06) 0%, transparent 62%)`,
            }}
          />

          {/* Matchup card (right / OPPONENT) */}
          {matchup ? (
            <div
              className="absolute top-1/2 -translate-y-1/2 left-4 md:left-8"
              style={{ width: 'min(86%, 340px)' }}
            >
              <div
                className="relative rounded-2xl border border-white/10 bg-black/25 backdrop-blur-xl px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
                style={{
                  boxShadow:
                    '0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(225deg, rgba(255,255,255,0.06) 0%, transparent 55%)',
                  }}
                />
                <div className="relative flex items-center gap-4 min-w-0">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center border shadow-[0_0_24px_rgba(239,68,68,0.18)]"
                    style={{
                      borderColor: 'rgba(239,68,68,0.45)',
                      background:
                        'radial-gradient(circle at 30% 30%, rgba(239,68,68,0.18) 0%, rgba(0,0,0,0.10) 60%)',
                    }}
                    aria-hidden
                  >
                    <span
                      className="text-sm font-black text-white/95"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif', letterSpacing: '0.08em' }}
                    >
                      {getInitials(matchup.right.username)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] md:text-xs font-mono tracking-[0.35em] uppercase text-red-300/80">
                      {matchup.right.label || 'OPPONENT'}
                    </div>
                    <div
                      className="mt-1 text-lg md:text-2xl font-black tracking-tight text-white truncate"
                      style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                      title={clampName(matchup.right.username)}
                    >
                      {clampName(matchup.right.username)}
                    </div>
                  </div>
                </div>
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
              textShadow:
                `0 0 18px rgba(255,255,255,0.28), 0 0 54px ${theme.accentSoft}`,
            }}
          >
            {/* Subtle animated glow blob behind text (transform/opacity only for 60fps) */}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                width: 520,
                height: 220,
                background: 'rgba(168, 85, 247, 0.25)',
              }}
              animate={
                active
                  ? { opacity: [0.18, 0.32, 0.18], scale: [1, 1.08, 1] }
                  : { opacity: 0, scale: 1 }
              }
              transition={{
                duration: 1.1,
                repeat: active ? Infinity : 0,
                ease: 'easeInOut',
              }}
            />

            <motion.div
              className="text-3xl md:text-4xl font-extrabold tracking-wider relative"
              animate={active ? { y: [0, -2, 0] } : { y: 0 }}
              transition={{
                duration: 0.85,
                repeat: active ? Infinity : 0,
                ease: 'easeInOut',
              }}
            >
              {matchup ? (matchup.center?.title ?? 'VERSUS') : message}
            </motion.div>

            {matchup && (matchup.center?.subtitle ?? 'YOU VS OPPONENT') ? (
              <div className="mt-2 text-[10px] md:text-xs text-white/60 font-mono tracking-[0.35em] uppercase">
                {matchup.center?.subtitle ?? 'YOU VS OPPONENT'}
              </div>
            ) : null}

            {/* Small scan line animation */}
            <div className="mt-4 h-px w-64 mx-auto bg-black/10 overflow-hidden">
              <motion.div
                className="h-full w-24"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(196,181,253,0), rgba(196,181,253,0.95), rgba(196,181,253,0))',
                }}
                animate={active ? { x: ['-40%', '160%'] } : { x: '-40%' }}
                transition={{
                  duration: 1.15,
                  repeat: active ? Infinity : 0,
                  ease: 'easeInOut',
                }}
              />
            </div>
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


