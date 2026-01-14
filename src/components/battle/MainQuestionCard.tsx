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
  const paperGraph: GraphConfig | null | undefined = graph ? ({ ...graph, color: 'black' } as GraphConfig) : graph

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      // Keep the main question content above any overlays for consistent interaction/layout.
      className="w-full relative z-10"
    >
      <div className="paper-card mb-8">
        {paperGraph && (
          <div className="mb-6">
            <QuestionGraph graph={paperGraph} />
          </div>
        )}

        <div className="space-y-4">
          <div className="paper-meta">Main Question</div>
          <h3 className="text-2xl md:text-3xl font-normal leading-relaxed text-left">
            <ScienceText text={stem} />
          </h3>
          {structureSmiles && (
            <div className="pt-2">
              <SmilesDiagram smiles={structureSmiles} size="lg" />
            </div>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Question"
              className="mt-4 rounded-lg max-w-full border border-slate-200 mx-auto"
              loading="lazy"
            />
          )}
          <div className="pt-2 text-sm text-slate-600">
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





