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

const CERAMIC = '#F0F2F5';

export function ElevatorShutterProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('ENTERING ARENA');
  const [isRunning, setIsRunning] = useState(false);

  const leftControls = useAnimation();
  const rightControls = useAnimation();
  const textControls = useAnimation();

  const runningRef = useRef(false);

  const startMatch = useCallback(
    async ({ message = 'ENTERING ARENA', loadingMs = 2000, onClosed }: StartMatchOptions = {}) => {
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
          className="absolute left-0 top-0 h-full w-1/2"
          initial={{ x: '-100%' }}
          animate={leftControls}
          style={{
            background: `linear-gradient(180deg, ${CERAMIC} 0%, #E9EDF2 100%)`,
            boxShadow:
              'inset 0 0 0 1px rgba(0,0,0,0.06), inset -18px 0 26px rgba(0,0,0,0.10)',
            willChange: 'transform',
          }}
        />

        {/* Right door */}
        <motion.div
          className="absolute right-0 top-0 h-full w-1/2"
          initial={{ x: '100%' }}
          animate={rightControls}
          style={{
            background: `linear-gradient(180deg, ${CERAMIC} 0%, #E9EDF2 100%)`,
            boxShadow:
              'inset 0 0 0 1px rgba(0,0,0,0.06), inset 18px 0 26px rgba(0,0,0,0.10)',
            willChange: 'transform',
          }}
        />

        {/* Center text */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={textControls}
          style={{ willChange: 'opacity, transform' }}
        >
          <div
            className="text-center"
            style={{
              color: '#0B1220',
              textShadow:
                '0 0 18px rgba(56,189,248,0.85), 0 0 48px rgba(56,189,248,0.35)',
            }}
          >
            <div className="text-3xl md:text-4xl font-extrabold tracking-wider">
              {message}
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


