import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

type StartMatchOptions = {
  message?: string;
  loadingMs?: number;
  onClosed?: () => void;
};

type ElevatorShutterContextValue = {
  startMatch: (options?: StartMatchOptions) => Promise<void>;
  isRunning: boolean;
};

const ElevatorShutterContext = createContext<ElevatorShutterContextValue | null>(null);

// Matte sky ceramic (theme-matched, darker)
const CERAMIC_SKY = '#B7D6EA';
const CERAMIC_SKY_DARK = '#8FB8D3';

export function ElevatorShutterProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('MATCH FOUND');
  const [isRunning, setIsRunning] = useState(false);

  const leftControls = useAnimation();
  const rightControls = useAnimation();
  const textControls = useAnimation();

  const runningRef = useRef(false);
  const noiseLeftId = useMemo(() => `shutterNoiseLeft-${Math.random().toString(36).slice(2, 9)}`, []);
  const noiseRightId = useMemo(() => `shutterNoiseRight-${Math.random().toString(36).slice(2, 9)}`, []);

  const startMatch = useCallback(
    async ({ message = 'MATCH FOUND', loadingMs = 2000, onClosed }: StartMatchOptions = {}) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setIsRunning(true);

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

      // Show loading text once closed
      await textControls.start({ opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } });

      // Navigate behind the shutter while fully closed
      onClosed?.();

      // Simulated loading time
      await new Promise((r) => setTimeout(r, loadingMs));

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
            background: `linear-gradient(180deg, ${CERAMIC_SKY} 0%, ${CERAMIC_SKY_DARK} 100%)`,
            boxShadow:
              'inset 0 0 0 1px rgba(0,0,0,0.06), inset -18px 0 28px rgba(0,0,0,0.12)',
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
          {/* Soft toon-ish shading to feel more “ceramic” than flat */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                'radial-gradient(900px 700px at 18% 18%, rgba(56,189,248,0.18) 0%, transparent 55%), radial-gradient(800px 700px at 85% 75%, rgba(125,211,252,0.14) 0%, transparent 60%)',
            }}
          />
        </motion.div>

        {/* Right door */}
        <motion.div
          className="absolute right-0 top-0 h-full w-1/2 overflow-hidden"
          initial={{ x: '100%' }}
          animate={rightControls}
          style={{
            background: `linear-gradient(180deg, ${CERAMIC_SKY} 0%, ${CERAMIC_SKY_DARK} 100%)`,
            boxShadow:
              'inset 0 0 0 1px rgba(0,0,0,0.06), inset 18px 0 28px rgba(0,0,0,0.12)',
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
          {/* Soft toon-ish shading to feel more “ceramic” than flat */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                'radial-gradient(900px 700px at 82% 18%, rgba(56,189,248,0.18) 0%, transparent 55%), radial-gradient(800px 700px at 18% 75%, rgba(125,211,252,0.14) 0%, transparent 60%)',
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
          <div
            className="relative text-center"
            style={{
              color: '#0B1220',
              textShadow:
                '0 0 18px rgba(56,189,248,0.85), 0 0 48px rgba(56,189,248,0.35)',
            }}
          >
            {/* Subtle animated glow blob behind text (transform/opacity only for 60fps) */}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                width: 520,
                height: 220,
                background: 'rgba(56, 189, 248, 0.25)',
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
              {message}
            </motion.div>

            {/* Small scan line animation */}
            <div className="mt-4 h-px w-64 mx-auto bg-black/10 overflow-hidden">
              <motion.div
                className="h-full w-24"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(56,189,248,0), rgba(56,189,248,0.95), rgba(56,189,248,0))',
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


