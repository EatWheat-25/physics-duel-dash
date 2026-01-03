import { motion } from 'framer-motion'
import { ScienceText } from '@/components/chem/ScienceText'
import { SmilesDiagram } from '@/components/chem/SmilesDiagram'
import { QuestionGraph } from '@/components/math/QuestionGraph'
import type { GraphConfig } from '@/types/question-contract'

export function MainQuestionCard({
  stem,
  imageUrl,
  structureSmiles,
  graph,
  totalSteps,
  isWebSocketConnected = true,
  onSubmitEarly,
}: {
  stem: string
  imageUrl?: string | null
  structureSmiles?: string | null
  graph?: GraphConfig | null
  totalSteps: number
  isWebSocketConnected?: boolean
  onSubmitEarly?: () => void
}) {
  const stripTone: 'light' | 'dark' = graph?.color === 'black' ? 'light' : 'dark'
  const stripBg = stripTone === 'light' ? 'bg-white' : 'bg-[#0B1220]'
  const stripText = stripTone === 'light' ? 'text-black' : 'text-white'
  const stripSubtle = stripTone === 'light' ? 'text-black/60' : 'text-white/70'
  const stripLabel = stripTone === 'light' ? 'text-black/60' : 'text-yellow-300/80'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-3xl"
    >
      <div className="mb-8 px-2 md:px-0">
        {/* Full-width plain strip behind graph + question for readability */}
        <div className={`relative left-1/2 right-1/2 -mx-[50vw] w-screen ${stripBg} ${stripText} py-7`}>
          <div className="mx-auto w-full max-w-5xl px-4 md:px-6">
            {graph && (
              <div className="mb-6">
                <QuestionGraph graph={graph} />
              </div>
            )}

            <div className="text-center">
              <div className={`text-sm font-mono mb-4 uppercase tracking-wider ${stripLabel}`}>
                Main Question
              </div>
              <h3 className="text-2xl md:text-3xl font-bold leading-relaxed relative z-10">
                <ScienceText text={stem} />
              </h3>
              {structureSmiles && (
                <div className="mt-6">
                  <SmilesDiagram smiles={structureSmiles} size="lg" />
                </div>
              )}
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Question"
                  className="mt-6 rounded-lg max-w-full border border-red-500/20 mx-auto"
                  loading="lazy"
                />
              )}
              <div className={`mt-6 text-sm ${stripSubtle}`}>
                {totalSteps} step{totalSteps !== 1 ? 's' : ''} will follow
              </div>
            </div>
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
          className={`w-full py-6 px-8 rounded-xl font-bold text-xl transition-colors border ${
            isWebSocketConnected && onSubmitEarly
              ? 'bg-yellow-500 hover:bg-yellow-400 text-black border-black/20 cursor-pointer'
              : 'bg-[#2B0A0F] text-white/60 border-red-500/20 cursor-not-allowed opacity-70'
          }`}
        >
          {isWebSocketConnected ? 'Submit Answer Early' : 'Connecting...'}
        </button>
      </motion.div>
    </motion.div>
  )
}


