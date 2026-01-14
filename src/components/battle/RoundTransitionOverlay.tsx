import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Zap } from 'lucide-react'

interface RoundTransitionOverlayProps {
  isVisible: boolean
  secondsLeft: number
  hasAcknowledged: boolean
  waitingForOpponent: boolean
  isConnected: boolean
}

export function RoundTransitionOverlay({
  isVisible,
  secondsLeft,
  hasAcknowledged,
  waitingForOpponent,
  isConnected,
}: RoundTransitionOverlayProps) {
  const displaySeconds = Math.max(0, Math.ceil(secondsLeft))
  const showCountdown = !hasAcknowledged && displaySeconds > 0
  const waitingForSync = !hasAcknowledged && displaySeconds <= 0

  const statusText = showCountdown
    ? 'NEXT ROUND IN'
    : hasAcknowledged
    ? waitingForOpponent
      ? 'WAITING FOR OPPONENT'
      : 'STARTING NEXT ROUND'
    : isConnected
    ? 'SYNCING WITH SERVER'
    : 'RECONNECTING'

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-xl px-6"
          >
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-10 text-center shadow-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.35em] text-white/70">
                <Zap className="h-4 w-4 text-yellow-400" />
                ROUND TRANSITION
              </div>

              <div className="mt-8">
                <div className="text-xs font-mono uppercase tracking-[0.4em] text-white/40">
                  {statusText}
                </div>
                <div className="mt-4 text-7xl md:text-8xl font-black tracking-tight text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.25)]">
                  {showCountdown ? displaySeconds : '0'}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-sm font-mono text-white/60">
                {(waitingForSync || waitingForOpponent) && <Loader2 className="h-4 w-4 animate-spin" />}
                {showCountdown
                  ? 'Auto-advancing in sync'
                  : hasAcknowledged
                  ? waitingForOpponent
                    ? 'Opponent reviewing results'
                    : 'Match synchronized'
                  : isConnected
                  ? 'Confirming readiness'
                  : 'Re-establishing link'}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
