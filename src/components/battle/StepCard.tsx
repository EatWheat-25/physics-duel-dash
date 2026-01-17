import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { ScienceText } from '@/components/chem/ScienceText'
import { SmilesDiagram } from '@/components/chem/SmilesDiagram'
import { QuestionGraph } from '@/components/math/QuestionGraph'
import type { GraphConfig } from '@/types/question-contract'

export function StepCard({
  stepIndex,
  totalSteps,
  segment = 'main',
  subStepIndex = 0,
  prompt,
  diagramSmiles,
  diagramImageUrl,
  graph,
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
  diagramSmiles?: string | null
  diagramImageUrl?: string | null
  graph?: GraphConfig | null
  options: string[] | null | undefined
  answerSubmitted: boolean
  disabled?: boolean
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
      <div className="paper-card mb-8">
        {paperGraph && (
          <div className="mb-6">
            <QuestionGraph graph={paperGraph} />
          </div>
        )}

        <div className="space-y-4">
          <div className="paper-meta">
            {segment === 'sub'
              ? `Step ${stepIndex + 1} of ${totalSteps} • Sub-step ${subStepIndex + 1}`
              : `Step ${stepIndex + 1} of ${totalSteps}`}
          </div>

          <h3 className="text-xl md:text-2xl leading-relaxed">
            <ScienceText text={prompt} />
          </h3>

          {(diagramSmiles || diagramImageUrl) && (
            <div className="space-y-4 pt-2">
              {diagramSmiles && <SmilesDiagram smiles={diagramSmiles} size="md" />}
              {diagramImageUrl && (
                <img
                  src={diagramImageUrl}
                  alt="Diagram"
                  className="rounded-lg max-w-full border border-slate-300"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {segment === 'sub' && (
            <p className="text-xs text-black">
              Quick check — must be correct to earn this step&apos;s marks
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleOptions.map((option, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (!disabled && !answerSubmitted) onSelectOption?.(idx)
              }}
              disabled={disabled || answerSubmitted}
              className={`paper-option ${disabled || answerSubmitted ? '' : 'active:scale-[0.99]'}`}
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-md text-sm border border-slate-300">
              <Check className="w-4 h-4" />
              ANSWER SUBMITTED
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}





