import { motion, useReducedMotion } from 'framer-motion';
import { battleTransition, sideEnterVariants, stampPopVariants } from '@/components/battle/battleMotion';

interface PlayerInfo {
  name: string;
  subtitle: string;
}

interface MatchupIntroProps {
  left: PlayerInfo;
  right: PlayerInfo;
  active: boolean;
  onComplete?: () => void;
}

function initials(value: string) {
  const v = String(value || '').trim();
  if (!v) return '??';
  const parts = v.split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return chars.join('') || v.slice(0, 2).toUpperCase();
}

export function MatchupIntro({ left, right, active, onComplete }: MatchupIntroProps) {
  const reduceMotion = useReducedMotion();

  if (!active) return null;

  const leftV = sideEnterVariants(reduceMotion, 'left');
  const rightV = sideEnterVariants(reduceMotion, 'right');
  const stampV = stampPopVariants(reduceMotion);
  
  return (
    <motion.div 
      className="w-full max-w-6xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={battleTransition(reduceMotion, { duration: 0.18 })}
      onAnimationComplete={() => onComplete?.()}
    >
      <div className="relative grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-center">
        {/* LEFT (YOU) */}
        <motion.div
          variants={leftV}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={battleTransition(reduceMotion, { duration: 0.24, delay: 0.06 })}
          className="relative overflow-hidden rounded-[26px] p-6 md:p-8 bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[10px_10px_0_rgba(0,0,0,0.55)]"
        >
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-2 bg-[#00D4FF]"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1.2px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/70 via-transparent to-transparent opacity-80"
          />

          <div className="relative flex items-center gap-4 text-slate-950">
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-black/10 ring-1 ring-black/10 flex items-center justify-center font-black tracking-tight">
              {initials(left.name || left.subtitle)}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-slate-700/70">
                {left.subtitle}
              </div>
              <div className="mt-1 text-2xl md:text-3xl font-black tracking-tight truncate">
                {left.name}
              </div>
            </div>
          </div>
        </motion.div>

        {/* CENTER */}
        <motion.div
          variants={stampV}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={battleTransition(reduceMotion, { duration: 0.22, delay: 0.12 })}
          className="relative z-10 text-center"
        >
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#F7F2E7] text-[#141318] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-5 py-3 md:px-7 md:py-4">
            <div className="text-5xl md:text-7xl font-comic tracking-[0.10em] leading-none">
              VS
            </div>
          </div>
        </motion.div>

        {/* RIGHT (OPPONENT) */}
        <motion.div
          variants={rightV}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={battleTransition(reduceMotion, { duration: 0.24, delay: 0.06 })}
          className="relative overflow-hidden rounded-[26px] p-6 md:p-8 bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[10px_10px_0_rgba(0,0,0,0.55)]"
        >
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-2 bg-[#FF3EA5]"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1.2px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/70 via-transparent to-transparent opacity-80"
          />

          <div className="relative flex items-center justify-end gap-4 text-slate-950">
            <div className="min-w-0 text-right">
              <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-slate-700/70">
                {right.subtitle}
              </div>
              <div className="mt-1 text-2xl md:text-3xl font-black tracking-tight truncate">
                {right.name}
              </div>
            </div>
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-black/10 ring-1 ring-black/10 flex items-center justify-center font-black tracking-tight">
              {initials(right.name || right.subtitle)}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
