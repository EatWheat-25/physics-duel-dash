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
  const paperGraph: GraphConfig | null | undefined = graph ? ({ ...graph, color: 'black' } as GraphConfig) : graph

  const visibleOptions = (options ?? []).filter((o) => String(o).trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      {/* Question Card */}
      <div className="paper-card mb-8">
        {paperGraph && (
          <div className="mb-6">
            <QuestionGraph graph={paperGraph} />
          </div>
        )}

        <h3 className="text-2xl md:text-3xl leading-relaxed">
          <ScienceText text={questionText} />
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
            className="mt-4 rounded-lg max-w-full border border-slate-300"
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
            className={`paper-option ${answerSubmitted ? '' : 'active:scale-[0.99]'}`}
          >
            <div className="flex items-center gap-4">
              <div className="paper-option-letter">
                {String.fromCharCode(65 + idx)}
              </div>
              <ScienceText text={option} className="text-lg" smilesSize="sm" />
            </div>
          </button>
        ))}
      </div>

      {answerSubmitted && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-md text-sm border border-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            AWAITING RESULT CONFIRMATION
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}





