import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { MathText } from '@/components/math/MathText'

export function StepCard({
  stepIndex,
  totalSteps,
  segment = 'main',
  subStepIndex = 0,
  prompt,
  options,
  answerSubmitted,
  disabled = false,
  onSelectOption,
}: {
  stepIndex: number
  totalSteps: number
  segment?: 'main' | 'sub'
  subStepIndex?: number
  prompt: string
  options: string[] | null | undefined
  answerSubmitted: boolean
  disabled?: boolean
  onSelectOption?: (answerIndex: number) => void
}) {
  const visibleOptions = (options ?? []).filter((o) => String(o).trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-3xl"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />

        <div className="text-center mb-6">
          <div className="text-sm text-amber-400/60 font-mono mb-2 uppercase tracking-wider">
            {segment === 'sub'
              ? `Step ${stepIndex + 1} of ${totalSteps} • Sub-step ${subStepIndex + 1}`
              : `Step ${stepIndex + 1} of ${totalSteps}`}
          </div>
          <h3 className="text-xl md:text-2xl font-bold leading-relaxed relative z-10">
            <MathText text={prompt} />
          </h3>
          {segment === 'sub' && (
            <p className="text-xs text-white/50 mt-3 font-mono">
              QUICK CHECK — must be correct to earn this step&apos;s marks
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleOptions.map((option, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (!disabled && !answerSubmitted) onSelectOption?.(idx)
              }}
              disabled={disabled || answerSubmitted}
              className={`
                relative group overflow-hidden p-6 rounded-2xl border transition-all duration-300 text-left
                ${
                  disabled || answerSubmitted
                    ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] active:scale-[0.98]'
                }
              `}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-4 relative z-10">
                <div
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-colors
                    ${
                      answerSubmitted
                        ? 'bg-white/10 text-white/40'
                        : 'bg-white/10 text-white/60 group-hover:bg-amber-500 group-hover:text-white'
                    }
                  `}
                >
                  {String.fromCharCode(65 + idx)}
                </div>
                <MathText text={option} className="text-lg font-medium" />
              </div>
            </button>
          ))}
        </div>

        {answerSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-full text-sm font-medium border border-amber-500/20 backdrop-blur-sm">
              <Check className="w-4 h-4" />
              ANSWER SUBMITTED
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}


