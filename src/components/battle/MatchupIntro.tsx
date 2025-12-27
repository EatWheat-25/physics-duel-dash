import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export type BannerTheme = {
  gradient: string; // CSS background
  border: string; // CSS color
  glow: string; // CSS color
};

export type MatchupSide = {
  name: string;
  subtitle?: string;
  theme?: BannerTheme;
};

type Props = {
  left: MatchupSide;
  right: MatchupSide;
  active?: boolean;
  onComplete?: () => void;
  className?: string;
};

const DEFAULT_THEME_LEFT: BannerTheme = {
  gradient:
    'linear-gradient(135deg, hsl(var(--battle-primary) / 0.22) 0%, rgba(94,241,255,0.14) 45%, rgba(88,196,255,0.10) 100%)',
  border: 'rgba(94,241,255,0.35)',
  glow: 'rgba(94,241,255,0.28)',
};

const DEFAULT_THEME_RIGHT: BannerTheme = {
  // Same palette, mirrored direction for now (future: pass opponent theme explicitly).
  gradient:
    'linear-gradient(225deg, hsl(var(--battle-primary) / 0.22) 0%, rgba(94,241,255,0.14) 45%, rgba(88,196,255,0.10) 100%)',
  border: 'rgba(94,241,255,0.35)',
  glow: 'rgba(94,241,255,0.28)',
};

function clampName(name: string): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Player';
}

export function MatchupIntro({ left, right, active = true, onComplete, className }: Props) {
  const prefersReducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
    []
  );

  const didCompleteRef = useRef(false);

  // Fire onComplete once per activation.
  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion) {
      if (!didCompleteRef.current) {
        didCompleteRef.current = true;
        onComplete?.();
      }
      return;
    }

    const t = window.setTimeout(() => {
      if (didCompleteRef.current) return;
      didCompleteRef.current = true;
      onComplete?.();
    }, 900);

    return () => clearTimeout(t);
  }, [active, onComplete, prefersReducedMotion]);

  const leftTheme = left.theme ?? DEFAULT_THEME_LEFT;
  const rightTheme = right.theme ?? DEFAULT_THEME_RIGHT;

  const leftName = clampName(left.name);
  const rightName = clampName(right.name);

  const bannerBaseStyle = (theme: BannerTheme): CSSProperties => ({
    background: theme.gradient,
    border: `1px solid ${theme.border}`,
    boxShadow: `0 0 30px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
    backdropFilter: 'blur(16px)',
  });

  const leftAnim = prefersReducedMotion
    ? { x: 0, opacity: 1 }
    : active
      ? { x: [-420, 22, 0], opacity: [0, 1, 1] }
      : { x: 0, opacity: 1 };

  const rightAnim = prefersReducedMotion
    ? { x: 0, opacity: 1 }
    : active
      ? { x: [420, -22, 0], opacity: [0, 1, 1] }
      : { x: 0, opacity: 1 };

  const vsAnim = prefersReducedMotion
    ? { scale: 1, opacity: 1 }
    : active
      ? { scale: [0.7, 1.18, 1], opacity: [0, 1, 1] }
      : { scale: 1, opacity: 1 };

  const impactAnim = prefersReducedMotion
    ? { opacity: 0 }
    : active
      ? { opacity: [0, 1, 0], scale: [0.8, 1.2, 1.55] }
      : { opacity: 0, scale: 1 };

  const mainTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const, times: [0, 0.78, 1] as const };

  return (
    <div className={className}>
      <div className="relative w-full max-w-4xl mx-auto px-4">
        <div className="relative flex items-center justify-center">
          {/* Left banner */}
          <motion.div
            initial={prefersReducedMotion ? { x: 0, opacity: 1 } : { x: -420, opacity: 0 }}
            animate={leftAnim}
            transition={mainTransition}
            className="w-[44%] min-w-[220px]"
          >
            <div className="rounded-2xl p-5 md:p-6 overflow-hidden relative" style={bannerBaseStyle(leftTheme)}>
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'var(--pattern-circuit)' }} />
              <div className="relative">
                <div className="text-[10px] md:text-xs font-mono tracking-[0.3em] text-white/70 uppercase">
                  {left.subtitle ?? 'YOU'}
                </div>
                <div
                  className="mt-2 text-xl md:text-3xl font-black tracking-tight text-white truncate"
                  style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                  title={leftName}
                >
                  {leftName}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Center VS */}
          <div className="relative z-10 mx-2 md:mx-4">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
              animate={impactAnim}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.7,
                ease: 'easeOut',
                delay: prefersReducedMotion ? 0 : 0.52,
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
              style={{
                width: 220,
                height: 220,
                background: 'rgba(94,241,255,0.18)',
              }}
            />
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
              animate={vsAnim}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.85,
                ease: [0.22, 1, 0.36, 1],
                delay: prefersReducedMotion ? 0 : 0.18,
                times: prefersReducedMotion ? undefined : [0, 0.7, 1],
              }}
              className="relative flex flex-col items-center"
              onAnimationComplete={() => {
                if (!active) return;
                if (didCompleteRef.current) return;
                didCompleteRef.current = true;
                onComplete?.();
              }}
            >
              <div
                className="text-4xl md:text-6xl font-black tracking-tighter text-white"
                style={{
                  fontFamily: 'Orbitron, Inter, system-ui, sans-serif',
                  textShadow: '0 0 18px rgba(94,241,255,0.55), 0 0 48px rgba(88,196,255,0.25)',
                }}
              >
                VS
              </div>
              <div className="mt-1 text-[10px] md:text-xs text-white/60 font-mono tracking-[0.35em] uppercase">
                versus match
              </div>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-[10px] md:text-xs font-mono tracking-wider uppercase">Initializing</span>
              </div>
            </motion.div>
          </div>

          {/* Right banner */}
          <motion.div
            initial={prefersReducedMotion ? { x: 0, opacity: 1 } : { x: 420, opacity: 0 }}
            animate={rightAnim}
            transition={mainTransition}
            className="w-[44%] min-w-[220px]"
          >
            <div className="rounded-2xl p-5 md:p-6 overflow-hidden relative text-right" style={bannerBaseStyle(rightTheme)}>
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'var(--pattern-circuit)' }} />
              <div className="relative">
                <div className="text-[10px] md:text-xs font-mono tracking-[0.3em] text-white/70 uppercase">
                  {right.subtitle ?? 'OPPONENT'}
                </div>
                <div
                  className="mt-2 text-xl md:text-3xl font-black tracking-tight text-white truncate"
                  style={{ fontFamily: 'Orbitron, Inter, system-ui, sans-serif' }}
                  title={rightName}
                >
                  {rightName}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}


