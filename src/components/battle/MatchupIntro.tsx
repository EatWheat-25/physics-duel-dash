import { motion } from 'framer-motion';

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
  if (!active) return null;
  
  return (
    <motion.div 
      className="w-full max-w-6xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => onComplete?.()}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-center">
        {/* LEFT (YOU) */}
        <motion.div
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="relative overflow-hidden rounded-[28px] p-6 md:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
        >
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/84 to-white/62" />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-500 opacity-90"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/14 via-transparent to-transparent"
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
          initial={{ scale: 0.86, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.22, type: 'spring', stiffness: 180, damping: 18 }}
          className="text-center"
        >
          <div className="text-[10px] text-white/55 font-mono uppercase tracking-[0.3em]">Match</div>
          <div className="mt-1 text-5xl md:text-7xl font-black italic tracking-tighter bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(255,255,255,0.15)]">
            VS
          </div>
        </motion.div>

        {/* RIGHT (OPPONENT) */}
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="relative overflow-hidden rounded-[28px] p-6 md:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
        >
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/84 to-white/62" />
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b from-rose-400 via-red-500 to-orange-500 opacity-90"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-500/14 via-transparent to-transparent"
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
