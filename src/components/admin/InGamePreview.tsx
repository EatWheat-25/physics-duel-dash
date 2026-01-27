import { useState, useEffect, useMemo } from 'react';
import { StepBasedQuestion } from '@/types/question-contract';
import { RoundPhase } from '@/types/gameEvents';
import { QuestionViewer } from '@/components/questions/QuestionViewer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, RotateCcw } from 'lucide-react';
import { Starfield } from '@/components/Starfield';

interface InGamePreviewProps {
  question: StepBasedQuestion;
  variant?: 'panel' | 'embedded';
  className?: string;
}

export function InGamePreview({ question, variant = 'panel', className = '' }: InGamePreviewProps) {
  const [simulatedPhase, setSimulatedPhase] = useState<RoundPhase>('thinking');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showTimer, setShowTimer] = useState(true);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [phaseDeadline, setPhaseDeadline] = useState<Date | null>(null);

  const totalSteps = question.steps.length;
  const currentStep = question.steps[currentStepIndex];
  const stepTimeLimit = currentStep?.timeLimitSeconds ?? null;

  // Initialize timer when step changes or phase changes to choosing
  useEffect(() => {
    if (simulatedPhase === 'choosing' && stepTimeLimit !== null && showTimer) {
      setTimeLeft(stepTimeLimit);
      setIsTimerRunning(true);
      const deadline = new Date(Date.now() + stepTimeLimit * 1000);
      setPhaseDeadline(deadline);
    } else {
      setTimeLeft(null);
      setIsTimerRunning(false);
      setPhaseDeadline(null);
    }
  }, [simulatedPhase, currentStepIndex, stepTimeLimit, showTimer]);

  // Timer countdown effect
  useEffect(() => {
    if (!isTimerRunning || timeLeft === null || timeLeft <= 0) {
      setIsTimerRunning(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Auto-advance phase when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && simulatedPhase === 'choosing') {
      setSimulatedPhase('result');
      setIsTimerRunning(false);
    }
  }, [timeLeft, simulatedPhase]);

  // Reset when question changes
  useEffect(() => {
    setSimulatedPhase('thinking');
    setCurrentStepIndex(0);
    setSelectedAnswer(null);
    setTimeLeft(null);
    setIsTimerRunning(false);
  }, [question.id]);

  // Convert question to match QuestionViewer's expected format (with snake_case properties)
  const questionForViewer = useMemo(() => {
    return {
      ...question,
      rank_tier: question.rankTier,
      topic_tags: question.topicTags,
    } as any;
  }, [question]);

  // Convert step options to QuestionViewer format
  const options = useMemo(() => {
    if (simulatedPhase === 'choosing' || simulatedPhase === 'result') {
      return currentStep.options.map((opt, idx) => ({
        id: idx,
        text: opt,
      }));
    }
    return null;
  }, [simulatedPhase, currentStep]);

  const handleSubmitAnswer = (questionId: string, stepId: string, answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setSimulatedPhase('result');
    setIsTimerRunning(false);
  };

  const handlePhaseChange = (newPhase: RoundPhase) => {
    setSimulatedPhase(newPhase);
    setSelectedAnswer(null);
    if (newPhase === 'choosing' && stepTimeLimit !== null && showTimer) {
      setTimeLeft(stepTimeLimit);
      setIsTimerRunning(true);
      const deadline = new Date(Date.now() + stepTimeLimit * 1000);
      setPhaseDeadline(deadline);
    } else {
      setTimeLeft(null);
      setIsTimerRunning(false);
      setPhaseDeadline(null);
    }
  };

  const handleStepChange = (newStepIndex: number) => {
    if (newStepIndex >= 0 && newStepIndex < totalSteps) {
      setCurrentStepIndex(newStepIndex);
      setSelectedAnswer(null);
      setSimulatedPhase('thinking');
      setTimeLeft(null);
      setIsTimerRunning(false);
    }
  };

  const handleReset = () => {
    setSimulatedPhase('thinking');
    setSelectedAnswer(null);
    if (stepTimeLimit !== null && showTimer) {
      setTimeLeft(stepTimeLimit);
      setIsTimerRunning(true);
      const deadline = new Date(Date.now() + stepTimeLimit * 1000);
      setPhaseDeadline(deadline);
    } else {
      setTimeLeft(null);
      setIsTimerRunning(false);
      setPhaseDeadline(null);
    }
  };

  const handleToggleTimer = () => {
    setShowTimer(!showTimer);
    if (!showTimer && simulatedPhase === 'choosing' && stepTimeLimit !== null) {
      setTimeLeft(stepTimeLimit);
      setIsTimerRunning(true);
      const deadline = new Date(Date.now() + stepTimeLimit * 1000);
      setPhaseDeadline(deadline);
    } else {
      setTimeLeft(null);
      setIsTimerRunning(false);
      setPhaseDeadline(null);
    }
  };

  const correctAnswer = simulatedPhase === 'result' ? currentStep.correctAnswer : null;
  const showResult = simulatedPhase === 'result';
  const isEmbedded = variant === 'embedded';

  return (
    <div
      className={`relative min-h-[600px] overflow-hidden ${!isEmbedded ? 'rounded-lg border border-white/10' : ''} ${className}`}
    >
      {/* Game-like background */}
      {!isEmbedded && (
        <div className="absolute inset-0 bg-[#050505]">
          <Starfield />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#050505] to-[#050505] pointer-events-none" />
        </div>
      )}

      {/* Controls Panel */}
      <div className="relative z-10 bg-black/40 backdrop-blur-xl border-b border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Phase Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60 font-mono">Phase:</span>
            <Select
              value={simulatedPhase}
              onValueChange={(v) => handlePhaseChange(v as RoundPhase)}
            >
              <SelectTrigger className="h-9 w-[140px] bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thinking">Thinking</SelectItem>
                <SelectItem value="choosing">Choosing</SelectItem>
                <SelectItem value="result">Result</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step Selector (for multi-step questions) */}
          {totalSteps > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60 font-mono">Step:</span>
              <Select
                value={String(currentStepIndex)}
                onValueChange={(v) => handleStepChange(parseInt(v))}
              >
                <SelectTrigger className="h-9 w-[100px] bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {question.steps.map((_, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {idx + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Timer Toggle */}
          {stepTimeLimit !== null && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleTimer}
                className="h-9 bg-white/5 border border-white/10 text-white hover:bg-white/10"
              >
                <Clock className="w-4 h-4 mr-2" />
                {showTimer ? 'Timer ON' : 'Timer OFF'}
              </Button>
            </div>
          )}

          {/* Timer Display */}
          {showTimer && timeLeft !== null && simulatedPhase === 'choosing' && (
            <Badge
              variant={timeLeft < 5 ? 'destructive' : 'secondary'}
              className="text-lg px-3 py-1 bg-white/10 border-white/20"
            >
              <Clock className="w-4 h-4 mr-2" />
              {timeLeft}s
            </Badge>
          )}

          {/* Reset Button */}
          <div className="ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-9 bg-white/5 border border-white/10 text-white hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Phase Badge */}
        <div className="mt-3">
          <Badge
            className={`${
              simulatedPhase === 'thinking'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                : simulatedPhase === 'choosing'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-green-500/20 text-green-300 border-green-500/50'
            } border`}
          >
            {simulatedPhase === 'thinking' && '⏳ Thinking Phase'}
            {simulatedPhase === 'choosing' && '✏️ Choosing Phase'}
            {simulatedPhase === 'result' && '✅ Result Phase'}
          </Badge>
          {totalSteps > 1 && (
            <span className="ml-3 text-sm text-white/60">
              Step {currentStepIndex + 1} of {totalSteps}: {currentStep.title}
            </span>
          )}
        </div>
      </div>

      {/* Question Viewer */}
      <div className="relative z-10 p-6">
        <QuestionViewer
          questions={[questionForViewer]}
          isOnlineMode={true}
          onSubmitAnswer={handleSubmitAnswer}
          isSubmitting={false}
          correctAnswer={correctAnswer}
          showResult={showResult}
          currentPhase={simulatedPhase}
          phaseDeadline={phaseDeadline}
          options={options}
          locked={false}
          currentStepIndex={currentStepIndex}
          stepTimeLeft={showTimer ? timeLeft : null}
          totalSteps={totalSteps}
        />
      </div>
    </div>
  );
}

