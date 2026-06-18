import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PREMIUM_EASE } from '@/lib/motion';

type Dot = {
  id: number;
  /** Scattered start position relative to the logo center (px). */
  sx: number;
  sy: number;
  size: number;
  delay: number;
  duration: number;
};

/**
 * Deterministic "scattered" dot field: varied angles/radii so it feels organic,
 * but stable across renders (no Math.random in render).
 */
function buildDots(count: number): Dot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.45;
    const radius = 110 + ((i * 37) % 70); // 110..180px
    return {
      id: i,
      sx: Math.cos(angle) * radius,
      sy: Math.sin(angle) * radius * 0.85,
      size: 4 + ((i * 13) % 4), // 4..7px
      delay: (i * 0.21) % 1.9,
      duration: 1.7 + ((i * 7) % 10) / 14, // ~1.7..2.4s
    };
  });
}

export function LoadingScreen() {
  const prefersReducedMotion = useReducedMotion();
  const dots = useMemo(() => buildDots(14), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[hsl(var(--bn-primary-deep))]">
      {/* Deep navy radial backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, hsl(var(--bn-secondary) / 0.14) 0%, hsl(var(--bn-primary) / 0.2) 30%, hsl(var(--bn-primary-deep)) 74%)',
        }}
      />

      {/* Vignette for focus */}
      <div className="absolute inset-0 bg-[radial-gradient(transparent_35%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-7 px-6 text-center"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: PREMIUM_EASE }}
      >
        {/* Emblem: dots stream in and get absorbed by the logo */}
        <div className="relative flex h-40 w-40 items-center justify-center">
          {/* Soft glow that breathes as dots are absorbed */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--bn-secondary) / 0.16) 0%, transparent 62%)',
            }}
            animate={
              prefersReducedMotion
                ? { opacity: 0.8 }
                : { opacity: [0.5, 0.9, 0.5], scale: [1, 1.05, 1] }
            }
            transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />

          {/* Converging dots */}
          {!prefersReducedMotion &&
            dots.map((dot) => (
              <motion.span
                key={dot.id}
                className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
                style={{
                  width: dot.size,
                  height: dot.size,
                  marginLeft: -dot.size / 2,
                  marginTop: -dot.size / 2,
                  background: 'hsl(var(--bn-secondary))',
                  boxShadow: '0 0 10px hsl(var(--bn-secondary) / 0.8)',
                  willChange: 'transform, opacity',
                }}
                initial={{ x: dot.sx, y: dot.sy, opacity: 0, scale: 0.4 }}
                animate={{
                  x: [dot.sx, dot.sx * 0.72, 0],
                  y: [dot.sy, dot.sy * 0.72, 0],
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.2],
                }}
                transition={{
                  duration: dot.duration,
                  repeat: Infinity,
                  delay: dot.delay,
                  times: [0, 0.35, 1],
                  ease: ['easeOut', 'easeIn'],
                }}
                aria-hidden="true"
              />
            ))}

          {/* Logo: subtle "absorbing" pulse */}
          <motion.img
            src="/brand/mascot-icon-256.png"
            alt="Battle Nerds mascot"
            className="relative h-24 w-24 select-none object-contain sm:h-28 sm:w-28"
            style={{
              filter:
                'drop-shadow(0 0 18px hsl(var(--bn-secondary) / 0.45)) drop-shadow(0 0 40px hsl(var(--bn-secondary) / 0.16))',
            }}
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.04, 1] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
            decoding="async"
            draggable={false}
          />
        </div>

        {/* BattleNerds wordmark */}
        <img
          src="/brand/battle-nerds-text.png"
          alt="Battle Nerds"
          className="h-9 w-auto select-none object-contain sm:h-10"
          style={{
            filter:
              'drop-shadow(0 0 3px rgba(255,255,255,0.30)) drop-shadow(0 0 18px rgba(0,0,0,0.70)) drop-shadow(0 0 26px hsl(var(--bn-secondary) / 0.18))',
          }}
          decoding="async"
          draggable={false}
        />

        {/* LOADING with staggered dots */}
        <div className="flex items-baseline gap-1 text-xs font-semibold tracking-[0.42em] text-[hsl(var(--bn-secondary)_/_0.85)] sm:text-sm">
          <span>LOADING</span>
          <span className="flex gap-[3px] tracking-normal" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="inline-block"
                animate={prefersReducedMotion ? undefined : { opacity: [0.2, 1, 0.2] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2,
                }}
              >
                .
              </motion.span>
            ))}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
