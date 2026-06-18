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
  hasRequestedEarly = false,
  opponentRequestedEarly = false,
}: {
  stem: string
  imageUrl?: string | null
  structureSmiles?: string | null
  graph?: GraphConfig | null
  totalSteps: number
  isWebSocketConnected?: boolean
  onSubmitEarly?: () => void
  hasRequestedEarly?: boolean
  opponentRequestedEarly?: boolean
}) {
  const paperGraph: GraphConfig | null | undefined = graph ? ({ ...graph, color: 'black' } as GraphConfig) : graph

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      <div className="paper-card mb-8">
        {paperGraph && (
          <div className="mb-6">
            <QuestionGraph graph={paperGraph} />
          </div>
        )}
        {imageUrl && (
          <div className="mb-6 flex justify-center">
            <img
              src={imageUrl}
              alt="Question"
              className="rounded-lg max-w-full border border-slate-300"
              loading="lazy"
            />
          </div>
        )}

        <div className="space-y-4">
          <div className="paper-meta">Main Question</div>
          <h3 className="text-2xl md:text-3xl leading-relaxed">
            <ScienceText text={stem} />
          </h3>
          {structureSmiles && (
            <div className="pt-2">
              <SmilesDiagram smiles={structureSmiles} size="lg" />
            </div>
          )}
          <div className="pt-2 text-sm text-black">
            {totalSteps} step{totalSteps !== 1 ? 's' : ''} will follow
          </div>
        </div>
      </div>

      {/* Separate Early Answer Button - OUTSIDE card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full mt-6"
      >
        <button
          onClick={() => {
            if (hasRequestedEarly) return
            onSubmitEarly?.()
          }}
          disabled={!isWebSocketConnected || !onSubmitEarly || hasRequestedEarly}
          className={`w-full py-6 px-8 rounded-md text-xl transition-colors border ${
            !isWebSocketConnected || !onSubmitEarly
              ? 'bg-white text-black/50 border-slate-300 cursor-not-allowed opacity-70'
              : hasRequestedEarly
                ? 'bg-slate-100 text-black/60 border-slate-300 cursor-wait'
                : 'bg-white hover:bg-slate-50 text-black border-slate-300 cursor-pointer'
          }`}
        >
          {!isWebSocketConnected
            ? 'Connecting...'
            : hasRequestedEarly
              ? 'Waiting for opponent...'
              : 'Submit Answer Early'}
        </button>
        {!hasRequestedEarly && opponentRequestedEarly && (
          <div className="mt-3 text-center text-sm text-white/70">
            Your opponent is ready to start the steps — submit early to skip ahead.
          </div>
        )}
        {hasRequestedEarly && (
          <div className="mt-3 text-center text-sm text-white/70">
            The steps begin once your opponent submits early too (or the timer runs out).
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}





