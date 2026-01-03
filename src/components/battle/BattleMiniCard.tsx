import { motion } from 'framer-motion'

type BattleMiniCardAccent = 'blue' | 'red' | 'neutral'

export function BattleMiniCard({
  label,
  sublabel,
  accent = 'neutral',
  size = 'md',
}: {
  label: string
  sublabel?: string
  accent?: BattleMiniCardAccent
  size?: 'sm' | 'md'
}) {
  const accentStyles: Record<BattleMiniCardAccent, { ring: string; glow: string; chip: string }> = {
    blue: {
      ring: 'ring-blue-400/30 border-blue-400/25',
      glow: 'shadow-[0_0_40px_rgba(96,165,250,0.18)]',
      chip: 'bg-blue-500/15 text-blue-200 border-blue-400/20',
    },
    red: {
      ring: 'ring-red-400/30 border-red-400/25',
      glow: 'shadow-[0_0_40px_rgba(248,113,113,0.16)]',
      chip: 'bg-red-500/15 text-red-200 border-red-400/20',
    },
    neutral: {
      ring: 'ring-white/20 border-white/15',
      glow: 'shadow-[0_0_35px_rgba(255,255,255,0.08)]',
      chip: 'bg-white/10 text-white/80 border-white/15',
    },
  }

  const s = size === 'sm' ? { w: 210, h: 260 } : { w: 240, h: 300 }
  const styles = accentStyles[accent]

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden bg-[#0B1220] border ring-1 ${styles.ring} ${styles.glow}`}
      style={{ width: s.w, height: s.h }}
    >
      {/* Subtle texture (flat/2D) */}
      <div className="absolute inset-0 opacity-[0.16] pointer-events-none bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.08),transparent_60%)]" />

      <div className="relative z-10 h-full w-full p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest border ${styles.chip}`}
          >
            {label}
          </div>
          <div className="text-[10px] font-mono text-white/50 uppercase tracking-wider">CARD</div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-3xl font-black text-white/90">{(label?.[0] || '?').toUpperCase()}</span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-lg font-black tracking-tight text-white">{label}</div>
          {sublabel && <div className="text-xs font-mono text-white/60 mt-1">{sublabel}</div>}
        </div>
      </div>
    </motion.div>
  )
}


