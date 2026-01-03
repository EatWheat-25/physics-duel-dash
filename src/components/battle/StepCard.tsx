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
  const visibleOptions = (options ?? []).filter((o) => String(o).trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-3xl"
    >
      <div className="bg-[#160007] border border-red-500/25 rounded-3xl p-8 md:p-12 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80" />

        <div className="text-center mb-6">
          <div className="text-sm text-yellow-300/80 font-mono mb-2 uppercase tracking-wider">
            {segment === 'sub'
              ? `Step ${stepIndex + 1} of ${totalSteps} • Sub-step ${subStepIndex + 1}`
              : `Step ${stepIndex + 1} of ${totalSteps}`}
          </div>
          <h3 className="text-xl md:text-2xl font-bold leading-relaxed relative z-10">
            <ScienceText text={prompt} />
          </h3>
          {(diagramSmiles || diagramImageUrl || graph) && (
            <div className="mt-6 space-y-4">
              {diagramSmiles && <SmilesDiagram smiles={diagramSmiles} size="md" />}
              {diagramImageUrl && (
                <img
                  src={diagramImageUrl}
                  alt="Diagram"
                  className="rounded-lg max-w-full border border-red-500/20 mx-auto"
                  loading="lazy"
                />
              )}
              {graph && <QuestionGraph graph={graph} />}
            </div>
          )}
          {segment === 'sub' && (
            <p className="text-xs text-white/70 mt-3 font-mono">
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
                relative group overflow-hidden p-6 rounded-2xl border transition-colors duration-200 text-left
                ${
                  disabled || answerSubmitted
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-full text-sm font-bold border border-black/20">
              <Check className="w-4 h-4" />
              ANSWER SUBMITTED
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}


