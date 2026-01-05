import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MainQuestionCard } from '@/components/battle/MainQuestionCard'
import { StepCard } from '@/components/battle/StepCard'
import { SingleStepCard } from '@/components/battle/SingleStepCard'

type PreviewPhase = 'question' | 'main_question' | 'steps'
type PreviewViewport = 'desktop' | 'mobile'

type PreviewSubStep = {
  prompt: string
  options: [string, string, string, string]
}

type PreviewStep = {
  prompt: string
  options: [string, string, string, string]
  subSteps?: PreviewSubStep[]
}

export function GameQuestionPreview({
  stem,
  imageUrl,
  steps,
}: {
  stem: string
  imageUrl?: string | null
  steps: PreviewStep[]
}) {
  const totalSteps = steps?.length ?? 0

  const defaultPhase: PreviewPhase = totalSteps <= 1 ? 'question' : 'main_question'
  const [phase, setPhase] = useState<PreviewPhase>(defaultPhase)
  const [viewport, setViewport] = useState<PreviewViewport>('desktop')
  const [stepIndex, setStepIndex] = useState(0)
  const [segment, setSegment] = useState<'main' | 'sub'>('main')
  const [subStepIndex, setSubStepIndex] = useState(0)

  // Keep indices valid as the user edits steps/subSteps.
  useEffect(() => {
    if (totalSteps <= 1 && phase !== 'question') setPhase('question')
    if (totalSteps > 1 && phase === 'question') setPhase('main_question')
  }, [totalSteps, phase])

  useEffect(() => {
    if (stepIndex < 0) setStepIndex(0)
    if (stepIndex >= totalSteps) setStepIndex(Math.max(0, totalSteps - 1))
  }, [stepIndex, totalSteps])

  const currentStep = steps?.[stepIndex]
  const subSteps = Array.isArray(currentStep?.subSteps) ? currentStep!.subSteps! : []
  const hasSubSteps = subSteps.length > 0

  useEffect(() => {
    if (!hasSubSteps) {
      if (segment !== 'main') setSegment('main')
      if (subStepIndex !== 0) setSubStepIndex(0)
      return
    }
    if (subStepIndex < 0) setSubStepIndex(0)
    if (subStepIndex >= subSteps.length) setSubStepIndex(Math.max(0, subSteps.length - 1))
  }, [hasSubSteps, segment, subStepIndex, subSteps.length])

  const display = useMemo(() => {
    if (!currentStep) {
      return { prompt: '', options: [] as string[], segment: 'main' as const, subStepIndex: 0 }
    }
    if (segment === 'sub' && hasSubSteps) {
      const sub = subSteps[subStepIndex]
      return {
        prompt: sub?.prompt ?? '',
        options: sub?.options ?? ([] as any),
        segment: 'sub' as const,
        subStepIndex,
      }
    }
    return {
      prompt: currentStep.prompt ?? '',
      options: currentStep.options ?? ([] as any),
      segment: 'main' as const,
      subStepIndex: 0,
    }
  }, [currentStep, segment, hasSubSteps, subSteps, subStepIndex])

  const containerWidth = viewport === 'mobile' ? 'max-w-sm' : 'max-w-3xl'

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 font-mono">Preview:</span>
          <Select value={phase} onValueChange={(v) => setPhase(v as PreviewPhase)}>
            <SelectTrigger className="h-9 w-[170px] bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {totalSteps <= 1 ? (
                <SelectItem value="question">Single-step</SelectItem>
              ) : (
                <>
                  <SelectItem value="main_question">Main Question</SelectItem>
                  <SelectItem value="steps">Steps</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {phase === 'steps' && totalSteps > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60 font-mono">Step</span>
            <Select value={String(stepIndex)} onValueChange={(v) => setStepIndex(parseInt(v))}>
              <SelectTrigger className="h-9 w-[90px] bg-white/5 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {steps.map((_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {phase === 'steps' && hasSubSteps && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60 font-mono">Segment</span>
              <Select value={segment} onValueChange={(v) => setSegment(v as 'main' | 'sub')}>
                <SelectTrigger className="h-9 w-[120px] bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main</SelectItem>
                  <SelectItem value="sub">Sub-step</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {segment === 'sub' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60 font-mono">Sub</span>
                <Select value={String(subStepIndex)} onValueChange={(v) => setSubStepIndex(parseInt(v))}>
                  <SelectTrigger className="h-9 w-[90px] bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subSteps.map((_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            variant={viewport === 'desktop' ? 'default' : 'secondary'}
            className="h-9"
            onClick={() => setViewport('desktop')}
          >
            Desktop
          </Button>
          <Button
            type="button"
            variant={viewport === 'mobile' ? 'default' : 'secondary'}
            className="h-9"
            onClick={() => setViewport('mobile')}
          >
            Mobile
          </Button>
        </div>
      </div>

      {/* Preview surface */}
      <div className={`mx-auto ${containerWidth}`}>
        {phase === 'question' && (
          <SingleStepCard
            questionText={stem || 'Untitled Question'}
            imageUrl={imageUrl}
            options={steps?.[0]?.options ?? []}
            answerSubmitted={false}
          />
        )}

        {phase === 'main_question' && (
          <MainQuestionCard
            stem={stem || 'Untitled Question'}
            imageUrl={imageUrl}
            totalSteps={Math.max(0, totalSteps)}
            isWebSocketConnected={true}
          />
        )}

        {phase === 'steps' && (
          <StepCard
            stepIndex={stepIndex}
            totalSteps={Math.max(1, totalSteps)}
            segment={display.segment}
            subStepIndex={display.subStepIndex}
            prompt={display.prompt || 'No prompt provided'}
            options={display.options}
            answerSubmitted={false}
            disabled={false}
          />
        )}
      </div>
    </div>
  )
}






