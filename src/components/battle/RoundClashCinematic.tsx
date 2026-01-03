import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import { BattleMiniCard } from '@/components/battle/BattleMiniCard'

type WinnerSide = 'me' | 'opponent' | null

export function RoundClashCinematic({
  winner,
  roundLabel,
}: {
  winner: WinnerSide
  roundLabel?: string
}) {
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Non-overlapping collision positions (cards stop short of center).
  const approachLeft = -140
  const approachRight = 140
  const bumpLeft = -128
  const bumpRight = 128

  const isTie = winner === null
  const winnerIsMe = winner === 'me'

  // Final positions are chosen to guarantee “no overlap” by separating winner upward and loser downward.
  const winnerFinal = { x: 0, y: -90, scale: 1.04, opacity: 1 }
  const loserFinal = { x: winnerIsMe ? 90 : -90, y: 140, scale: 0.68, opacity: 0.86 }

  const meFinal = isTie ? { x: -95, y: 0, scale: 0.92, opacity: 1 } : winnerIsMe ? winnerFinal : loserFinal
  const oppFinal = isTie ? { x: 95, y: 0, scale: 0.92, opacity: 1 } : !winnerIsMe ? winnerFinal : loserFinal

  if (prefersReducedMotion) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center">
          {roundLabel && <div className="text-xs font-mono text-white/60 uppercase tracking-widest mb-4">{roundLabel}</div>}
          <div className="flex items-center justify-center gap-8">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <BattleMiniCard label="YOU" accent="blue" size="sm" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
              <BattleMiniCard label="OPPONENT" accent="red" size="sm" />
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6">
      <div className="relative w-full h-[460px] md:h-[520px] flex items-center justify-center">
        {/* Background spark streak (subtle, still 2D) */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 0.35 }}
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(250,204,21,0.10) 0%, transparent 65%)',
          }}
        />

        {roundLabel && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-mono text-white/60 uppercase tracking-widest">
            {roundLabel}
          </div>
        )}

        {/* Cards */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ x: -520, y: 0, scale: 0.95, opacity: 1 }}
          animate={{
            x: [-520, approachLeft, bumpLeft, approachLeft, meFinal.x],
            y: [0, 0, 0, 0, meFinal.y],
            scale: [0.95, 1, 0.97, 1, meFinal.scale],
            opacity: [1, 1, 1, 1, meFinal.opacity],
          }}
          transition={{
            duration: 3.2,
            times: [0, 0.38, 0.48, 0.6, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="relative">
            {/* Crown */}
            <motion.div
              className="absolute -top-8 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={
                winnerIsMe
                  ? { opacity: [0, 0, 1, 1], y: [-6, -6, 0, 0], scale: [0.9, 0.9, 1, 1] }
                  : { opacity: 0 }
              }
              transition={{ duration: 3.2, times: [0, 0.62, 0.75, 1], ease: 'easeOut' }}
            >
              <div className="p-2 rounded-full bg-yellow-400/15 border border-yellow-400/25">
                <Crown className="w-6 h-6 text-yellow-300" />
              </div>
            </motion.div>

            <BattleMiniCard label="YOU" accent="blue" size="sm" />
          </div>
        </motion.div>

        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ x: 520, y: 0, scale: 0.95, opacity: 1 }}
          animate={{
            x: [520, approachRight, bumpRight, approachRight, oppFinal.x],
            y: [0, 0, 0, 0, oppFinal.y],
            scale: [0.95, 1, 0.97, 1, oppFinal.scale],
            opacity: [1, 1, 1, 1, oppFinal.opacity],
          }}
          transition={{
            duration: 3.2,
            times: [0, 0.38, 0.48, 0.6, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="relative">
            <motion.div
              className="absolute -top-8 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={
                winner === 'opponent'
                  ? { opacity: [0, 0, 1, 1], y: [-6, -6, 0, 0], scale: [0.9, 0.9, 1, 1] }
                  : { opacity: 0 }
              }
              transition={{ duration: 3.2, times: [0, 0.62, 0.75, 1], ease: 'easeOut' }}
            >
              <div className="p-2 rounded-full bg-yellow-400/15 border border-yellow-400/25">
                <Crown className="w-6 h-6 text-yellow-300" />
              </div>
            </motion.div>

            <BattleMiniCard label="OPPONENT" accent="red" size="sm" />
          </div>
        </motion.div>

        {/* Collision flash (no overlap, just impact feedback) */}
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full pointer-events-none"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.65, 0], scale: [0.4, 1.1, 1.4] }}
          transition={{ duration: 3.2, times: [0, 0.46, 0.58], ease: 'easeOut' }}
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(250,204,21,0.45) 0%, rgba(250,204,21,0.15) 35%, transparent 70%)',
          }}
        />
      </div>
    </div>
  )
}


