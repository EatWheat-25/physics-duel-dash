import { motion } from 'framer-motion'
import { MathText } from '@/components/math/MathText'

export function MainQuestionCard({
  stem,
  imageUrl,
  totalSteps,
  isWebSocketConnected = true,
  onSubmitEarly,
}: {
  stem: string
  imageUrl?: string | null
  totalSteps: number
  isWebSocketConnected?: boolean
  onSubmitEarly?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-3xl"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="text-center">
          <div className="text-sm text-blue-400/60 font-mono mb-4 uppercase tracking-wider">
            Main Question
          </div>
          <h3 className="text-2xl md:text-3xl font-bold leading-relaxed relative z-10">
            <MathText text={stem} />
          </h3>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Question"
              className="mt-6 rounded-lg max-w-full border border-white/10 mx-auto"
              loading="lazy"
            />
          )}
          <div className="mt-6 text-sm text-white/40">
            {totalSteps} step{totalSteps !== 1 ? 's' : ''} will follow
          </div>
        </div>
      </div>

      {/* Separate Early Answer Button - OUTSIDE card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-3xl mt-6"
      >
        <button
          onClick={() => onSubmitEarly?.()}
          disabled={!isWebSocketConnected || !onSubmitEarly}
          className={`w-full py-6 px-8 rounded-xl font-bold text-xl transition-all shadow-lg ${
            isWebSocketConnected && onSubmitEarly
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-500/20 cursor-pointer'
              : 'bg-gray-600/50 cursor-not-allowed opacity-50'
          }`}
        >
          {isWebSocketConnected ? 'Submit Answer Early' : 'Connecting...'}
        </button>
      </motion.div>
    </motion.div>
  )
}







