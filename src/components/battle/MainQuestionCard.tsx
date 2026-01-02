import { motion } from 'framer-motion'
import { ScienceText } from '@/components/chem/ScienceText'
import { SmilesDiagram } from '@/components/chem/SmilesDiagram'
import { FunctionGraph } from '@/components/math/FunctionGraph'

export function MainQuestionCard({
  stem,
  imageUrl,
  structureSmiles,
  graphEquation,
  graphColor,
  totalSteps,
  isWebSocketConnected = true,
  onSubmitEarly,
}: {
  stem: string
  imageUrl?: string | null
  structureSmiles?: string | null
  graphEquation?: string | null
  graphColor?: string | null
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
      <div className="bg-[#160007] border border-red-500/25 rounded-3xl p-8 md:p-12 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80" />

        <div className="text-center">
          <div className="text-sm text-yellow-300/80 font-mono mb-4 uppercase tracking-wider">
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
          {graphEquation && (
            <div className="mt-6">
              <FunctionGraph equation={graphEquation} color={graphColor || 'yellow'} width={600} height={400} />
            </div>
          )}
          <div className="mt-6 text-sm text-white/70">
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


