import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { LobbyPlayerCard } from '@/components/lobby/LobbyPlayerCard';
import { getRankByPoints } from '@/types/ranking';

export type MatchDoorPlayer = {
  displayName: string;
  rankPoints: number | null;
  level: number;
  initial: string;
  isPlaceholder?: boolean;
};

export type MatchDoorPlayers = {
  left: MatchDoorPlayer;
  right: MatchDoorPlayer;
};

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
  players?: MatchDoorPlayers | null;
};

type ElevatorShutterContextValue = {
  startMatch: (options?: StartMatchOptions) => Promise<void>;
  signalReady: () => void;
  setMatchPlayers: (players: MatchDoorPlayers | null) => void;
  isRunning: boolean;
};

const ElevatorShutterContext = createContext<ElevatorShutterContextValue | null>(null);

// Dark team doors (left blue, right red)
const DOOR_BLUE = '#22356F';
const DOOR_BLUE_DARK = '#121B3C';
const DOOR_RED = '#6F1F2D';
const DOOR_RED_DARK = '#3A0F17';

export function ElevatorShutterProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('MATCH FOUND');
  const [isRunning, setIsRunning] = useState(false);
  const [matchPlayers, setMatchPlayersState] = useState<MatchDoorPlayers | null>(null);

  const leftControls = useAnimation();
  const rightControls = useAnimation();
  const textControls = useAnimation();

  const runningRef = useRef(false);
  const readyResolveRef = useRef<(() => void) | null>(null);
  const readyTokenRef = useRef<number>(0);
  const noiseLeftId = useMemo(() => `shutterNoiseLeft-${Math.random().toString(36).slice(2, 9)}`, []);
  const noiseRightId = useMemo(() => `shutterNoiseRight-${Math.random().toString(36).slice(2, 9)}`, []);

  const setMatchPlayers = useCallback((players: MatchDoorPlayers | null) => {
    setMatchPlayersState(players);
  }, []);

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
      players = null,
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
      setMatchPlayers(players);
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
      setMatchPlayers(null);
      setIsRunning(false);
      runningRef.current = false;
    },
    [leftControls, rightControls, textControls, setMatchPlayers]
  );

  const value = useMemo(
    () => ({ startMatch, signalReady, setMatchPlayers, isRunning }),
    [startMatch, signalReady, setMatchPlayers, isRunning]
  );

  const leftPlayer = matchPlayers?.left ?? {
    displayName: 'YOU',
    rankPoints: null,
    level: 1,
    initial: 'Y',
    isPlaceholder: true,
  };
  const rightPlayer = matchPlayers?.right ?? {
    displayName: 'OPPONENT',
    rankPoints: null,
    level: 1,
    initial: 'O',
    isPlaceholder: true,
  };
  const leftRank = getRankByPoints(leftPlayer.rankPoints ?? 0);
  const rightRank = getRankByPoints(rightPlayer.rankPoints ?? 0);

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
            background: `linear-gradient(180deg, ${DOOR_BLUE} 0%, ${DOOR_BLUE_DARK} 100%)`,
            boxShadow:
              'inset 0 0 0 1px rgba(0,0,0,0.06), inset -18px 0 28px rgba(0,0,0,0.12)',
            willChange: 'transform',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <LobbyPlayerCard
              rank={leftRank}
              level={leftPlayer.level}
              points={leftPlayer.rankPoints}
              username={leftPlayer.displayName}
              initial={leftPlayer.initial}
              showPoints={false}
              isInteractive={false}
              isPlaceholder={leftPlayer.isPlaceholder}
            />
          </div>
          {/* Matte grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none z-0">
            <filter id={noiseLeftId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseLeftId})`} />
          </svg>
          {/* Soft toon-ish shading to feel more “ceramic” than flat */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 z-0"
            style={{
              background:
                'radial-gradient(900px 700px at 18% 18%, rgba(59,130,246,0.18) 0%, transparent 55%), radial-gradient(800px 700px at 85% 75%, rgba(96,165,250,0.14) 0%, transparent 60%)',
            }}
          />
        </motion.div>

        {/* Right door */}
        <motion.div
          className="absolute right-0 top-0 h-full w-1/2 overflow-hidden"
          initial={{ x: '100%' }}
          animate={rightControls}
          style={{
            background: `linear-gradient(180deg, ${DOOR_RED} 0%, ${DOOR_RED_DARK} 100%)`,
            boxShadow:
              'inset 0 0 0 1px rgba(0,0,0,0.06), inset 18px 0 28px rgba(0,0,0,0.12)',
            willChange: 'transform',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <LobbyPlayerCard
              rank={rightRank}
              level={rightPlayer.level}
              points={rightPlayer.rankPoints}
              username={rightPlayer.displayName}
              initial={rightPlayer.initial}
              showPoints={false}
              isInteractive={false}
              isPlaceholder={rightPlayer.isPlaceholder}
            />
          </div>
          {/* Matte grain texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none z-0">
            <filter id={noiseRightId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${noiseRightId})`} />
          </svg>
          {/* Soft toon-ish shading to feel more “ceramic” than flat */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 z-0"
            style={{
              background:
                'radial-gradient(900px 700px at 82% 18%, rgba(239,68,68,0.18) 0%, transparent 55%), radial-gradient(800px 700px at 18% 75%, rgba(248,113,113,0.14) 0%, transparent 60%)',
            }}
          />
        </motion.div>

        {active && (
          <>
            {/* Center seam + VS badge */}
            <div className="absolute left-1/2 top-0 h-full w-px bg-black/20 shadow-[0_0_12px_rgba(0,0,0,0.4)]" />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={textControls}
            >
              <div className="relative">
                <div className="absolute left-1/2 top-[-160px] h-[320px] w-px bg-white/15" />
                <motion.div
                  className="relative rounded-full border border-white/20 bg-black/40 px-6 py-3 text-lg md:text-xl font-extrabold tracking-[0.4em] text-white"
                  style={{
                    textShadow:
                      '0 0 16px rgba(196,181,253,0.6), 0 0 40px rgba(168,85,247,0.25)',
                  }}
                  animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={{
                    duration: 0.9,
                    repeat: active ? Infinity : 0,
                    ease: 'easeInOut',
                  }}
                >
                  VS
                </motion.div>
              </div>
            </motion.div>

            {/* Top message */}
            <motion.div
              className="absolute inset-x-0 top-8 flex justify-center text-center"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={textControls}
              style={{ willChange: 'opacity, transform' }}
            >
              <div
                className="relative text-center"
                style={{
                  color: '#F8FAFC',
                  textShadow:
                    '0 0 18px rgba(196,181,253,0.85), 0 0 48px rgba(168,85,247,0.35)',
                }}
              >
                {/* Subtle animated glow blob behind text (transform/opacity only for 60fps) */}
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                  style={{
                    width: 420,
                    height: 180,
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
                  {message}
                </motion.div>

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
          </>
        )}
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


