import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { MathText } from '@/components/math/MathText'

export function SingleStepCard({
  questionText,
  imageUrl,
  options,
  answerSubmitted,
  onSelectOption,
}: {
  questionText: string
  imageUrl?: string | null
  options: string[] | null | undefined
  answerSubmitted: boolean
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
      {/* Question Card */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <h3 className="text-2xl md:text-3xl font-bold leading-relaxed text-center relative z-10">
          <MathText text={questionText} />
        </h3>

        {imageUrl && (
          <img
            src={imageUrl}
            alt="Question"
            className="mt-6 rounded-lg max-w-full border border-white/10 mx-auto"
            loading="lazy"
          />
        )}
      </div>

      {/* Answers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleOptions.map((option, idx) => (
          <button
            key={idx}
            onClick={() => !answerSubmitted && onSelectOption?.(idx)}
            disabled={answerSubmitted}
            className={`
              relative group overflow-hidden p-6 rounded-2xl border transition-all duration-300 text-left
              ${
                answerSubmitted
                  ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] active:scale-[0.98]'
              }
            `}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 relative z-10">
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-colors
                  ${
                    answerSubmitted
                      ? 'bg-white/10 text-white/40'
                      : 'bg-white/10 text-white/60 group-hover:bg-blue-500 group-hover:text-white'
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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium border border-blue-500/20 backdrop-blur-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            AWAITING RESULT CONFIRMATION
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}







