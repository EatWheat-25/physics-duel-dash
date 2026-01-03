import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { ScienceText } from '@/components/chem/ScienceText'
import { SmilesDiagram } from '@/components/chem/SmilesDiagram'
import { QuestionGraph } from '@/components/math/QuestionGraph'
import type { GraphConfig } from '@/types/question-contract'

export function SingleStepCard({
  questionText,
  imageUrl,
  structureSmiles,
  graph,
  options,
  answerSubmitted,
  onSelectOption,
}: {
  questionText: string
  imageUrl?: string | null
  structureSmiles?: string | null
  graph?: GraphConfig | null
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
      <div className="bg-[#160007] border border-red-500/25 rounded-3xl p-8 md:p-12 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80" />

        <h3 className="text-2xl md:text-3xl font-bold leading-relaxed text-center relative z-10">
          <ScienceText text={questionText} />
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
        {graph && (
          <div className="mt-6">
            <QuestionGraph graph={graph} />
          </div>
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
              relative group overflow-hidden p-6 rounded-2xl border transition-colors duration-200 text-left
              ${
                answerSubmitted
                  ? 'border-red-500/10 bg-[#1A0008] opacity-60 cursor-not-allowed'
                  : 'border-red-500/20 bg-[#1A0008] hover:bg-[#24000F] hover:border-yellow-400/60 active:bg-[#2B0A0F]'
              }
            `}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-colors
                  ${
                    answerSubmitted
                      ? 'bg-[#2B0A0F] text-white/50 border border-red-500/15'
                      : 'bg-[#2B0A0F] text-white/80 border border-red-500/20 group-hover:bg-yellow-400 group-hover:text-black group-hover:border-black/20'
                  }
                `}
              >
                {String.fromCharCode(65 + idx)}
              </div>
              <ScienceText text={option} className="text-lg font-medium" smilesSize="sm" />
            </div>
          </button>
        ))}
      </div>

      {answerSubmitted && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-full text-sm font-bold border border-black/20">
            <Loader2 className="w-4 h-4 animate-spin text-black/80" />
            AWAITING RESULT CONFIRMATION
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}


