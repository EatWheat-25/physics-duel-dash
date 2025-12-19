/**
 * QUESTION VIEWER COMPONENT
 *
 * Displays step-based questions from Supabase with navigation.
 * - Shows one question at a time with its steps.
 * - Options are displayed immediately during the choosing phase.
 * - Clicking an option instantly submits the answer in online mode.
 * - Smooth transition animation between questions using framer‑motion.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StepBasedQuestion } from '@/types/questions';
import { getPrimaryDisplayStep } from '@/utils/questionStepHelpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, BookOpen, Check, X, Loader2, Clock } from 'lucide-react';
import { RoundPhase } from '@/types/gameEvents';

interface QuestionViewerProps {
  questions: StepBasedQuestion[];
  onFinished?: () => void;
  // Online mode props
  isOnlineMode?: boolean;
  onSubmitAnswer?: (questionId: string, stepId: string, answerIndex: number) => void;
  isSubmitting?: boolean;
  correctAnswer?: number | null;
  showResult?: boolean;
  // Phase props
  currentPhase?: RoundPhase;
  phaseDeadline?: Date | null;
  options?: Array<{ id: number; text: string }> | null;
  locked?: boolean;
  onReadyForOptions?: () => void;
  // Step props
  currentStepIndex?: number;
  stepTimeLeft?: number | null;
  // Sub-step props (optional, server-driven)
  currentSegment?: 'main' | 'sub';
  currentSubStepIndex?: number;
  subStepTimeLeft?: number | null;
  currentSubStep?: any | null;
  totalSteps?: number;
}

export function QuestionViewer({
  questions,
  onFinished,
  isOnlineMode = false,
  onSubmitAnswer,
  isSubmitting = false,
  correctAnswer = null,
  showResult = false,
  currentPhase,
  phaseDeadline,
  options,
  locked = false,
  onReadyForOptions,
  currentStepIndex = 0,
  stepTimeLeft = null,
  currentSegment = 'main',
  currentSubStepIndex = 0,
  subStepTimeLeft = null,
  currentSubStep = null,
  totalSteps = 1,
}: QuestionViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);

  console.log('📖 QuestionViewer: Received questions:', questions?.length || 0);
  console.log('📖 QuestionViewer: Phase:', currentPhase, 'Options:', options?.length || 0);

  const currentQuestion = questions?.[currentIndex];
  const currentStep = isOnlineMode && currentQuestion
    ? currentQuestion.steps?.[currentStepIndex] ?? null
    : currentQuestion
      ? getPrimaryDisplayStep(currentQuestion)
      : null;

  // In online mode, allow a server-provided sub-step override for display.
  // When present, the UI can show a sub-step without needing it to exist in currentQuestion.steps.
  const displayStep = (isOnlineMode && currentSegment === 'sub' && currentSubStep)
    ? currentSubStep
    : currentStep;

  // Reset selection when question or step changes (online mode)
  useEffect(() => {
    if (isOnlineMode) {
      console.log('[QuestionViewer] Resetting selection', {
        questionId: currentQuestion?.id,
        currentStepIndex,
      });
      setSelectedOptionIndex(null);
    }
  }, [currentQuestion?.id, isOnlineMode, currentStepIndex]);

  if (!questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <Card className="w-full max-w-md border-gray-700 bg-gray-800/50 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <p className="text-lg text-gray-300 text-center">No questions to show</p>
            <p className="text-sm text-gray-500 text-center">Questions array is empty or undefined</p>
            <p className="text-xs text-gray-600 text-center font-mono">Length: {questions?.length || 0}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!displayStep) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Question data is malformed or step not found</p>
      </div>
    );
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedOptionIndex(null);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOptionIndex(null);
    } else if (onFinished) {
      onFinished();
    }
  };

  const handleOptionSelect = (displayIdx: number) => {
    const actualIdx = displayIdx; // because we show all options
    console.log('[QuestionViewer] Option selected', { displayIdx, actualIdx, currentStepIndex, totalSteps });
    setSelectedOptionIndex(actualIdx);
    if (isOnlineMode && onSubmitAnswer && !isSubmitting) {
      console.log('[QuestionViewer] Instant submit triggered');
      onSubmitAnswer(currentQuestion!.id, (displayStep as any)?.id ?? (currentStep as any)?.id ?? '', actualIdx);
    }
  };

  // Options to display
  const displayOptions = isOnlineMode && (currentPhase === 'choosing' || currentPhase === 'result') && options
    ? options.map(o => o.text)
    : (displayStep as any)?.options || [];

  const shouldShowOptions = !isOnlineMode || currentPhase === 'choosing' || currentPhase === 'result';
  const activeTimer = currentSegment === 'sub' ? subStepTimeLeft : stepTimeLeft;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <span>Question {currentIndex + 1} of {questions.length}</span>
        </div>
        {isOnlineMode && totalSteps > 1 && (
          <div className="font-bold text-primary">
            Step {currentStepIndex + 1} of {totalSteps}
            {currentSegment === 'sub' && (
              <span className="ml-2 text-purple-600">• Sub-step {currentSubStepIndex + 1}</span>
            )}
          </div>
        )}
        <div className="flex gap-1">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-blue-500' : idx < currentIndex ? 'bg-green-500' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      </div>

      {/* Question card with animation */}
      <motion.div
        key={currentQuestion?.id || currentIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-2 shadow-xl">
          <CardHeader>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="outline">{currentQuestion.subject}</Badge>
              <Badge variant="outline">{currentQuestion.level}</Badge>
              <Badge variant="secondary">{currentQuestion.difficulty}</Badge>
              {currentQuestion.rank_tier && <Badge variant="default">{currentQuestion.rank_tier}</Badge>}
            </div>
            <CardTitle className="text-2xl">{currentQuestion.title}</CardTitle>
            <CardDescription className="text-base">
              {currentQuestion.chapter} • {(currentSegment === 'sub'
                ? ((currentStep as any)?.marks ?? (displayStep as any)?.marks ?? 0)
                : ((displayStep as any)?.marks ?? 0))} marks
              {totalSteps > 1 && (
                <span className="ml-2 font-semibold text-blue-600">• Step {currentStepIndex + 1} of {totalSteps}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main question stem for multi‑step */}
            {currentQuestion.stem && totalSteps > 1 && (
              <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">Main Question:</p>
                <p className="text-gray-800 font-medium">{currentQuestion.stem}</p>
              </div>
            )}
            {/* Single‑step stem fallback */}
            {currentQuestion.stem && totalSteps === 1 && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border/50 text-sm text-muted-foreground">
                <span className="font-semibold mr-2">Question:</span>{currentQuestion.stem}
              </div>
            )}
            {/* Step‑specific prompt */}
            {totalSteps > 1 && (
              <div className="p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">
                      {currentSegment === 'sub'
                        ? `Sub-step ${currentSubStepIndex + 1}: Quick Check`
                        : `Step ${currentStepIndex + 1}: ${currentStep.title || 'Question Step'}`}
                    </p>
                  </div>
                  {isOnlineMode && activeTimer !== null && (
                    <Badge variant={activeTimer < 5 ? 'destructive' : 'secondary'} className="text-lg px-3 py-1">
                      <Clock className="w-4 h-4 mr-2" />{activeTimer}s
                    </Badge>
                  )}
                </div>
                <p className="text-lg font-semibold text-gray-900">{(displayStep as any).prompt}</p>
              </div>
            )}
            {/* Single‑step prompt fallback */}
            {totalSteps === 1 && (
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xl font-medium text-foreground leading-relaxed">{(displayStep as any).prompt}</p>
                </div>
                {isOnlineMode && activeTimer !== null && (
                  <Badge variant={activeTimer < 5 ? 'destructive' : 'secondary'} className="text-lg px-3 py-1 shrink-0">
                    <Clock className="w-4 h-4 mr-2" />{activeTimer}s
                  </Badge>
                )}
              </div>
            )}

            {/* Options */}
            {shouldShowOptions && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {displayOptions.map((option, idx) => {
                    const actualIdx = idx;
                    const isSelected = selectedOptionIndex === actualIdx;
                    const isCorrect = showResult && correctAnswer === actualIdx;
                    const isWrong = showResult && isSelected && correctAnswer !== actualIdx;
                    const isDisabled = isSubmitting || showResult || (currentPhase === 'thinking') || locked;
                    const optionLabel = String.fromCharCode(65 + actualIdx);
                    return (
                      <button
                        key={actualIdx}
                        onClick={() => !isDisabled && handleOptionSelect(idx)}
                        disabled={isDisabled}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${isCorrect ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : isWrong ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'} ${isDisabled ? 'cursor-not-allowed opacity-75' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold ${isCorrect ? 'bg-green-500 text-white' : isWrong ? 'bg-red-500 text-white' : isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {showResult && isCorrect ? <Check className="w-5 h-5" /> : showResult && isWrong ? <X className="w-5 h-5" /> : optionLabel}
                          </div>
                          <p className="flex-1 text-gray-800 pt-1">{option}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fallback when options not yet ready */}
            {!shouldShowOptions && (
              <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-blue-50">
                <Clock className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                <p className="text-lg font-semibold text-gray-700 mb-2">Options will appear soon</p>
                <p className="text-sm text-gray-600 mb-4">Use this time to think about the question</p>
                {onReadyForOptions && (
                  <Button onClick={onReadyForOptions} variant="default" className="bg-blue-600 hover:bg-blue-700">
                    Answer Now
                  </Button>
                )}
              </div>
            )}

            {/* Topic tags */}
            {currentQuestion.topic_tags && currentQuestion.topic_tags.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Topics:</p>
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.topic_tags.map((tag, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
