import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

type StartMatchOptions = {
  message?: string;
  /**
   * When waitForReady is false: how long to keep doors closed after onClosed (fixed delay).
   * When waitForReady is true: a timeout fallback (doors open when ready is signaled or when this elapses).
   */
  loadingMs?: number;
  onClosed?: () => void;
  /**
   * If true, keep doors closed until someone calls signalReady() (or loadingMs timeout elapses).
   * This is used to ensure the first question is fully rendered before revealing the battle screen.
   */
  waitForReady?: boolean;
};

type ElevatorShutterContextValue = {
  startMatch: (options?: StartMatchOptions) => Promise<void>;
  signalReady: () => void;
  isRunning: boolean;
};

const ElevatorShutterContext = createContext<ElevatorShutterContextValue | null>(null);

// Comic Arena palette (paper + ink + CMY accents)
const PAPER = '#F7F2E7';
const PAPER_DARK = '#EFE6D3';
const INK = '#141318';
const CYAN = '#00D4FF';
const MAGENTA = '#FF3EA5';
const YELLOW = '#FFD400';

export function ElevatorShutterProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('MATCH FOUND');
  const [isRunning, setIsRunning] = useState(false);

  const leftControls = useAnimation();
  const rightControls = useAnimation();
  const textControls = useAnimation();

  const runningRef = useRef(false);
  const readyResolveRef = useRef<(() => void) | null>(null);
  const readyTokenRef = useRef<number>(0);
  const noiseLeftId = useMemo(() => `shutterNoiseLeft-${Math.random().toString(36).slice(2, 9)}`, []);
  const noiseRightId = useMemo(() => `shutterNoiseRight-${Math.random().toString(36).slice(2, 9)}`, []);

  const signalReady = useCallback(() => {
    const resolve = readyResolveRef.current;
    if (!resolve) return;
    readyResolveRef.current = null;
    resolve();
  }, []);

  const startMatch = useCallback(
    async ({
      message = 'MATCH FOUND',
      loadingMs = 2000,
      onClosed,
      waitForReady = false,
    }: StartMatchOptions = {}) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setIsRunning(true);

      // Create a fresh "ready" signal for this run (used when waitForReady=true).
      readyTokenRef.current += 1;
      const token = readyTokenRef.current;
      const readyPromise =
        waitForReady
          ? new Promise<void>((resolve) => {
              readyResolveRef.current = () => {
                // Ignore stale resolves from older runs.
                if (readyTokenRef.current !== token) return;
                resolve();
              };
            })
          : null;

      setMessage(message);
      setActive(true);

      // Ensure consistent initial positions
      leftControls.set({ x: '-100%' });
      rightControls.set({ x: '100%' });
      textControls.set({ opacity: 0, scale: 0.98 });

      // Close doors
      await Promise.all([
        leftControls.start({ x: '0%', transition: { duration: 0.8, ease: 'easeInOut' } }),
        rightControls.start({ x: '0%', transition: { duration: 0.8, ease: 'easeInOut' } }),
      ]);

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

      // Hold closed:
      // - If waitForReady: open as soon as signalReady() is called, with a timeout fallback (loadingMs).
      // - Otherwise: fixed delay (loadingMs).
      if (waitForReady && readyPromise) {
        await Promise.race([
          readyPromise,
          new Promise<void>((r) => setTimeout(r, Math.max(0, loadingMs))),
        ]);
      } else {
        await new Promise<void>((r) => setTimeout(r, Math.max(0, loadingMs)));
      }

      // Clear any lingering resolver before opening (prevents accidental future resolves).
      if (readyResolveRef.current) readyResolveRef.current = null;

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

  const value = useMemo(() => ({ startMatch, signalReady, isRunning }), [startMatch, signalReady, isRunning]);

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
            background: `linear-gradient(180deg, ${PAPER} 0%, ${PAPER_DARK} 100%)`,
            boxShadow:
              'inset 0 0 0 3px rgba(0,0,0,0.85), inset -22px 0 34px rgba(0,0,0,0.10)',
            willChange: 'transform',
          }}
        >
          {/* Accent stripe */}
          <div aria-hidden className="absolute top-0 left-0 h-3 w-full" style={{ background: CYAN }} />
          {/* Center seam ink */}
          <div aria-hidden className="absolute right-0 top-0 h-full w-1 bg-black/80" />

          {/* Halftone print */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.18] mix-blend-multiply pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.22) 1px, rgba(0,0,0,0) 1.2px)',
              backgroundSize: '18px 18px',
            }}
          />

          {/* Matte grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none">
            <filter id={noiseLeftId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseLeftId})`} />
          </svg>
          {/* Ink + arena light */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                `radial-gradient(900px 700px at 18% 18%, rgba(0,212,255,0.12) 0%, transparent 55%), radial-gradient(800px 700px at 85% 75%, rgba(255,212,0,0.10) 0%, transparent 60%), radial-gradient(1200px 900px at 50% 100%, rgba(0,0,0,0.22) 0%, transparent 55%)`,
            }}
          />
        </motion.div>

        {/* Right door */}
        <motion.div
          className="absolute right-0 top-0 h-full w-1/2 overflow-hidden"
          initial={{ x: '100%' }}
          animate={rightControls}
          style={{
            background: `linear-gradient(180deg, ${PAPER} 0%, ${PAPER_DARK} 100%)`,
            boxShadow:
              'inset 0 0 0 3px rgba(0,0,0,0.85), inset 22px 0 34px rgba(0,0,0,0.10)',
            willChange: 'transform',
          }}
        >
          {/* Accent stripe */}
          <div aria-hidden className="absolute top-0 left-0 h-3 w-full" style={{ background: MAGENTA }} />
          {/* Center seam ink */}
          <div aria-hidden className="absolute left-0 top-0 h-full w-1 bg-black/80" />

          {/* Halftone print */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.18] mix-blend-multiply pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.22) 1px, rgba(0,0,0,0) 1.2px)',
              backgroundSize: '18px 18px',
            }}
          />

          {/* Matte grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none">
            <filter id={noiseRightId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseRightId})`} />
          </svg>
          {/* Ink + arena light */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                `radial-gradient(900px 700px at 82% 18%, rgba(255,62,165,0.12) 0%, transparent 55%), radial-gradient(800px 700px at 18% 75%, rgba(255,212,0,0.10) 0%, transparent 60%), radial-gradient(1200px 900px at 50% 100%, rgba(0,0,0,0.22) 0%, transparent 55%)`,
            }}
          />
        </motion.div>

        {/* Center text */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={textControls}
          style={{ willChange: 'opacity, transform' }}
        >
          <div className="relative text-center">
            <div
              className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-4 ring-black/90 shadow-[14px_14px_0_rgba(0,0,0,0.65)] px-10 py-7"
              style={{ boxShadow: '14px 14px 0 rgba(0,0,0,0.65)' }}
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                  backgroundSize: '18px 18px',
                }}
              />
              <div aria-hidden className="absolute top-0 left-0 h-2 w-full" style={{ background: YELLOW }} />
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80"
              />

              {/* Subtle ink "puff" behind text */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{
                  width: 520,
                  height: 220,
                  background: 'rgba(20, 19, 24, 0.10)',
                }}
                animate={active ? { opacity: [0.10, 0.16, 0.10], scale: [1, 1.04, 1] } : { opacity: 0, scale: 1 }}
                transition={{
                  duration: 1.1,
                  repeat: active ? Infinity : 0,
                  ease: 'easeInOut',
                }}
              />

              <motion.div
                className="text-3xl md:text-4xl font-comic tracking-[0.14em] relative"
                style={{ color: INK }}
                animate={active ? { y: [0, -1, 0] } : { y: 0 }}
                transition={{
                  duration: 0.9,
                  repeat: active ? Infinity : 0,
                  ease: 'easeInOut',
                }}
              >
                {message}
              </motion.div>

              {/* Small scan line animation */}
              <div className="mt-4 h-px w-64 mx-auto bg-black/20 overflow-hidden">
                <motion.div
                  className="h-full w-28"
                  style={{
                    background: 'linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.65), rgba(0,0,0,0))',
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


