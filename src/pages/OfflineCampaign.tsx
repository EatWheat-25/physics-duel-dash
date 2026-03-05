import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Atom,
  Calculator,
  CheckCircle2,
  FlaskConical,
  Heart,
  Lock,
  RefreshCw,
  Skull,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StudyPatternBackground } from '@/components/StudyPatternBackground';
import { BrandMark } from '@/components/BrandMark';
import { QuestionViewer } from '@/components/questions/QuestionViewer';
import { toast } from '@/hooks/use-toast';
import type { QuestionSubject } from '@/types/questions';
import type { StepBasedQuestion } from '@/types/question-contract';
import type { RoundPhase } from '@/types/gameEvents';
import {
  HEARTS_PER_LEVEL,
  LEVELS_PER_STAGE,
  OFFLINE_LEVELS,
  QUESTIONS_PER_LEVEL,
  computeUnlockedStage,
  getDifficultyForLevel,
  getStageRange,
  isLevelUnlocked,
  loadOfflineProgress,
  loadOfflineSubject,
  saveOfflineProgress,
  saveOfflineSubject,
  updateProgressOnLevelComplete,
} from '@/utils/offlineCampaign';
import {
  getStepSubSteps,
  loadCachedQuestionBank,
  loadUsedQuestionOrder,
  refreshQuestionBank,
  saveUsedQuestionOrder,
  selectQuestionsForLevel,
} from '@/utils/offlineQuestionCache';

type SessionStatus = 'idle' | 'playing' | 'level-complete' | 'level-failed';

export default function OfflineCampaign() {
  const navigate = useNavigate();
  const subjectOptions = [
    { id: 'math' as QuestionSubject, label: 'Mathematics', icon: Calculator, accent: 'from-cyan-400/30' },
    { id: 'physics' as QuestionSubject, label: 'Physics', icon: Atom, accent: 'from-violet-400/30' },
    { id: 'chemistry' as QuestionSubject, label: 'Chemistry', icon: FlaskConical, accent: 'from-emerald-400/30' },
  ];

  const [subject, setSubject] = useState<QuestionSubject>(loadOfflineSubject());
  const [progress, setProgress] = useState(() => loadOfflineProgress(subject));
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedQuestions, setCachedQuestions] = useState(() => {
    const cached = loadCachedQuestionBank(subject);
    return cached?.questions ?? [];
  });
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(() => {
    const cached = loadCachedQuestionBank(subject);
    return cached?.updatedAt ?? null;
  });

  const [selectedLevel, setSelectedLevel] = useState(progress.currentLevel);
  const [levelQuestions, setLevelQuestions] = useState<StepBasedQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [segment, setSegment] = useState<'main' | 'sub'>('main');
  const [subStepIndex, setSubStepIndex] = useState(0);
  const [hearts, setHearts] = useState(HEARTS_PER_LEVEL);
  const [segmentLocked, setSegmentLocked] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const stageRange = useMemo(() => getStageRange(progress.unlockedStage), [progress.unlockedStage]);
  const totalStages = Math.ceil(OFFLINE_LEVELS / LEVELS_PER_STAGE);
  const selectedDifficulty = getDifficultyForLevel(selectedLevel);

  useEffect(() => {
    saveOfflineSubject(subject);
    const nextProgress = loadOfflineProgress(subject);
    setProgress(nextProgress);
    setSelectedLevel(nextProgress.currentLevel);
    const cached = loadCachedQuestionBank(subject);
    setCachedQuestions(cached?.questions ?? []);
    setCacheUpdatedAt(cached?.updatedAt ?? null);
    setStatus('idle');
    setLevelQuestions([]);
  }, [subject]);

  useEffect(() => {
    if (status === 'playing') return;
    if (selectedLevel === progress.currentLevel) return;
    const updated = { ...progress, currentLevel: selectedLevel };
    saveOfflineProgress(updated);
    setProgress(updated);
  }, [progress, selectedLevel, status]);

  const refreshCache = useCallback(async () => {
    if (!navigator.onLine) {
      toast({ title: 'Offline', description: 'Connect to the internet to refresh the question bank.' });
      return;
    }
    setIsRefreshing(true);
    try {
      const updated = await refreshQuestionBank(subject);
      setCachedQuestions(updated);
      setCacheUpdatedAt(new Date().toISOString());
    } catch (error) {
      toast({
        title: 'Failed to refresh',
        description: error instanceof Error ? error.message : 'Could not fetch questions.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [subject]);

  useEffect(() => {
    if (!navigator.onLine) return;
    if (!cachedQuestions.length) {
      refreshCache();
    }
  }, [cachedQuestions.length, refreshCache]);

  const currentQuestion = levelQuestions[questionIndex];
  const currentStep = currentQuestion?.steps?.[stepIndex] ?? null;
  const subSteps = getStepSubSteps(currentStep);
  const currentSubStep = segment === 'sub' ? subSteps[subStepIndex] : null;
  const totalSteps = currentQuestion?.steps?.length ?? 1;
  const currentPhase: RoundPhase = showResult ? 'result' : 'choosing';

  const getSegmentTimeLimit = useCallback(() => {
    if (!currentStep) return null;
    if (segment === 'sub') {
      const limit = currentSubStep?.timeLimitSeconds;
      return typeof limit === 'number' && limit > 0 ? limit : 15;
    }
    const limit = currentStep.timeLimitSeconds;
    return typeof limit === 'number' && limit > 0 ? limit : 15;
  }, [currentStep, currentSubStep, segment]);

  const resetSegmentState = useCallback(() => {
    setSegmentLocked(false);
    setShowResult(false);
    setCorrectAnswer(null);
  }, []);

  useEffect(() => {
    if (status !== 'playing') {
      setTimeLeft(null);
      return;
    }
    resetSegmentState();
  }, [status, questionIndex, stepIndex, segment, subStepIndex, resetSegmentState]);

  useEffect(() => {
    if (status !== 'playing' || segmentLocked) return;
    const limit = getSegmentTimeLimit();
    if (!limit) {
      setTimeLeft(null);
      return;
    }
    setTimeLeft(limit);
    const endAt = Date.now() + limit * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [getSegmentTimeLimit, segmentLocked, status, questionIndex, stepIndex, segment, subStepIndex]);

  const failLevel = useCallback(() => {
    setStatus('level-failed');
    setSegmentLocked(true);
  }, []);

  const advanceSegment = useCallback(() => {
    if (!currentQuestion || !currentStep) return;

    if (segment === 'main' && subSteps.length > 0) {
      setSegment('sub');
      setSubStepIndex(0);
      return;
    }

    if (segment === 'sub') {
      const nextSubStep = subStepIndex + 1;
      if (nextSubStep < subSteps.length) {
        setSubStepIndex(nextSubStep);
        return;
      }
    }

    const nextStep = stepIndex + 1;
    if (nextStep < currentQuestion.steps.length) {
      setStepIndex(nextStep);
      setSegment('main');
      setSubStepIndex(0);
      return;
    }

    const nextQuestion = questionIndex + 1;
    if (nextQuestion < levelQuestions.length) {
      setQuestionIndex(nextQuestion);
      setStepIndex(0);
      setSegment('main');
      setSubStepIndex(0);
      return;
    }

    const updated = updateProgressOnLevelComplete(progress, selectedLevel);
    saveOfflineProgress(updated);
    setProgress(updated);
    setSelectedLevel(updated.currentLevel);
    setStatus('level-complete');
  }, [
    currentQuestion,
    currentStep,
    levelQuestions.length,
    progress,
    questionIndex,
    selectedLevel,
    segment,
    stepIndex,
    subStepIndex,
    subSteps.length,
  ]);

  const applyHeartPenalty = useCallback(() => {
    setHearts((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setTimeout(() => failLevel(), 400);
      }
      return Math.max(next, 0);
    });
  }, [failLevel]);

  const finalizeAnswer = useCallback(
    (answerIndex: number | null) => {
      if (!currentStep) return;
      const correct =
        segment === 'sub'
          ? currentSubStep?.correctAnswer ?? 0
          : currentStep.correctAnswer ?? 0;

      const isCorrect = answerIndex !== null && answerIndex === correct;
      setCorrectAnswer(correct);
      setShowResult(true);
      setSegmentLocked(true);

      if (!isCorrect) {
        applyHeartPenalty();
      }

      window.setTimeout(() => {
        if (hearts - (isCorrect ? 0 : 1) <= 0) return;
        advanceSegment();
      }, 650);
    },
    [advanceSegment, applyHeartPenalty, currentStep, currentSubStep, hearts, segment]
  );

  useEffect(() => {
    if (status !== 'playing' || segmentLocked) return;
    if (timeLeft !== 0) return;
    finalizeAnswer(null);
  }, [finalizeAnswer, segmentLocked, status, timeLeft]);

  const startLevel = useCallback(
    (level: number) => {
      if (!cachedQuestions.length) {
        toast({
          title: 'Question bank empty',
          description: 'Refresh the question bank to play offline.',
        });
        return;
      }
      const usedOrder = loadUsedQuestionOrder(subject);
      const selection = selectQuestionsForLevel(cachedQuestions, subject, level, usedOrder);
      if (selection.questions.length < QUESTIONS_PER_LEVEL) {
        toast({
          title: 'Not enough questions',
          description: 'Add more questions or refresh the bank.',
          variant: 'destructive',
        });
        return;
      }

      saveUsedQuestionOrder(subject, selection.usedOrder);

      setLevelQuestions(selection.questions);
      setQuestionIndex(0);
      setStepIndex(0);
      setSegment('main');
      setSubStepIndex(0);
      setHearts(HEARTS_PER_LEVEL);
      setStatus('playing');
    },
    [cachedQuestions, subject]
  );

  const resetLevel = useCallback(() => {
    startLevel(selectedLevel);
  }, [selectedLevel, startLevel]);

  const handleAnswer = useCallback(
    (_questionId: string, _stepId: string, answerIndex: number) => {
      if (segmentLocked) return;
      finalizeAnswer(answerIndex);
    },
    [finalizeAnswer, segmentLocked]
  );

  const levelButtons = useMemo(
    () =>
      Array.from({ length: OFFLINE_LEVELS }, (_, idx) => {
        const level = idx + 1;
        const unlocked = isLevelUnlocked(progress, level);
        const completed = progress.completedLevels.includes(level);
        const selected = level === selectedLevel;
        const lockedWhilePlaying = status === 'playing';
        const isDisabled = !unlocked || lockedWhilePlaying;
        const offset = idx % 2 === 0 ? 'translate-y-2' : '-translate-y-2';
        const connectorTone = completed
          ? 'after:bg-emerald-400/40'
          : selected
            ? 'after:bg-lime-300/45'
            : 'after:bg-white/10';
        const connector =
          idx === OFFLINE_LEVELS - 1
            ? 'after:hidden'
            : `after:absolute after:left-full after:top-1/2 after:-translate-y-1/2 after:h-[2px] after:w-6 ${connectorTone} after:content-['']`;
        return (
          <button
            key={level}
            type="button"
            onClick={() => !isDisabled && setSelectedLevel(level)}
            disabled={isDisabled}
            className={`group relative flex h-12 w-12 min-w-[3rem] items-center justify-center rounded-full border text-xs font-semibold transition ${offset} ${connector} ${
              selected
                ? 'bg-lime-400 text-slate-900 border-lime-200 shadow-[0_0_0_4px_rgba(163,230,53,0.18)]'
                : completed
                  ? 'bg-emerald-500/15 text-emerald-100 border-emerald-400/30'
                  : unlocked
                    ? 'bg-white/5 text-white/80 border-white/10 hover:border-white/30 hover:bg-white/10'
                    : 'bg-white/5 text-white/30 border-white/10'
            } ${isDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <span className="relative z-10">{level}</span>
            {!unlocked && (
              <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-white/40" />
            )}
            {completed && (
              <CheckCircle2 className="absolute -top-1 -right-1 h-3.5 w-3.5 text-emerald-400" />
            )}
          </button>
        );
      }),
    [progress, selectedLevel, status]
  );

  const levelStatus =
    status === 'playing'
      ? `Level ${selectedLevel} • Question ${questionIndex + 1}/${QUESTIONS_PER_LEVEL}`
      : `Level ${selectedLevel}`;
  const statusMeta =
    status === 'playing'
      ? {
          label: 'In Lesson',
          className: 'border-sky-400/40 bg-sky-500/15 text-sky-100',
        }
      : status === 'level-complete'
        ? {
            label: 'Complete',
            className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
          }
        : status === 'level-failed'
          ? {
              label: 'Needs Retry',
              className: 'border-red-400/40 bg-red-500/15 text-red-100',
            }
          : {
              label: 'Ready',
              className: 'border-white/20 bg-white/5 text-white/70',
            };

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <StudyPatternBackground />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />

      <div className="absolute top-4 left-4 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <BrandMark />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-2 font-bold uppercase tracking-wider text-white"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
      </div>

      <main className="relative z-10 min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="relative overflow-hidden border-white/10 bg-white/5 backdrop-blur">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <CardContent className="relative p-6 md:p-7 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-xl">
                    <p className="text-xs uppercase tracking-widest text-white/50">Offline Campaign</p>
                    <h1 className="text-3xl font-bold text-white">Solo Lessons</h1>
                    <p className="text-sm text-white/60 mt-2">
                      Clear {QUESTIONS_PER_LEVEL} step-based questions to advance. Mistakes cost a heart.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                      Stage {progress.unlockedStage}/{totalStages}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                      Levels {stageRange.start}-{stageRange.end}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    <span className="font-semibold text-white">Level {selectedLevel}</span>
                    <span className="text-white/40">•</span>
                    <span className="capitalize">{selectedDifficulty} difficulty</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    <span className="font-semibold text-white">{cachedQuestions.length}</span>
                    <span>cached questions</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs text-red-100">
                    {Array.from({ length: HEARTS_PER_LEVEL }).map((_, idx) => (
                      <Heart
                        key={idx}
                        className={`h-3.5 w-3.5 ${idx < hearts ? 'text-red-300 fill-red-300' : 'text-white/25'}`}
                      />
                    ))}
                    <span className="ml-1">Hearts {hearts}/{HEARTS_PER_LEVEL}</span>
                  </div>
                </div>

                {status === 'idle' ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => startLevel(selectedLevel)}
                      disabled={!isLevelUnlocked(progress, selectedLevel)}
                      className="h-14 px-7 text-base font-semibold rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, #a3e635, #22c55e)',
                        color: '#0b1220',
                        border: '1px solid rgba(0,0,0,0.45)',
                        boxShadow: '0 14px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
                      }}
                    >
                      Start Level {selectedLevel}
                    </Button>
                    <div className="text-xs text-white/60">
                      {QUESTIONS_PER_LEVEL} questions • {HEARTS_PER_LEVEL} hearts • {selectedDifficulty} difficulty
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                    <span className={`rounded-full border px-3 py-1 ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                    <span>{levelStatus}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card className="border-white/10 bg-white/5 backdrop-blur">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/50">Subjects</p>
                      <h2 className="text-lg font-semibold text-white">Pick your focus</h2>
                    </div>
                    <div className="text-xs text-white/50">
                      {selectedDifficulty} difficulty
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {subjectOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = option.id === subject;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSubject(option.id)}
                          className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                            isActive
                              ? 'border-lime-300/60 bg-white/10'
                              : 'border-white/10 bg-white/5 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-10 w-10 rounded-2xl flex items-center justify-center bg-gradient-to-br ${option.accent} to-white/5`}
                            >
                              <Icon className="h-4 w-4 text-white/80" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-white">{option.label}</div>
                              <div className="text-xs text-white/50">Lesson set</div>
                            </div>
                          </div>
                          {isActive && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 backdrop-blur">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/50">Question Bank</p>
                      <h2 className="text-lg font-semibold text-white">Cached Offline</h2>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={refreshCache}
                      disabled={isRefreshing}
                      className="text-xs"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                      {cachedQuestions.length} cached
                    </span>
                    <span className="text-xs text-white/50">
                      {cacheUpdatedAt ? `Last updated ${new Date(cacheUpdatedAt).toLocaleString()}` : 'Not cached yet'}
                    </span>
                  </div>
                  <div className="text-xs text-white/50">
                    Refresh while online to keep your offline lessons stocked.
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/50">Lesson Path</div>
                  <div className="text-lg font-semibold text-white">
                    Stage {progress.unlockedStage} • Levels {stageRange.start}-{stageRange.end}
                  </div>
                </div>
                <div className="text-xs text-white/60">
                  Completed {progress.completedLevels.length}/{OFFLINE_LEVELS}
                </div>
              </div>
              <div className="flex gap-6 overflow-x-auto pb-4 pt-2">{levelButtons}</div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/50">Lesson Session</div>
                  <div className="text-lg font-semibold text-white">{levelStatus}</div>
                  <div className="text-xs text-white/50 mt-1">
                    {status === 'playing'
                      ? 'Complete the current lesson to keep your streak going.'
                      : 'Pick a level from the path and jump in.'}
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
              </div>

              {status === 'idle' && (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Ready for Level {selectedLevel}?</h3>
                    <p className="text-sm text-white/60 mt-1">
                      {QUESTIONS_PER_LEVEL} questions • {HEARTS_PER_LEVEL} hearts • {selectedDifficulty} difficulty
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => startLevel(selectedLevel)}
                    disabled={!isLevelUnlocked(progress, selectedLevel)}
                    className="px-5"
                  >
                    Start Lesson
                  </Button>
                </div>
              )}

              {status === 'playing' && currentQuestion && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <QuestionViewer
                      questions={levelQuestions}
                      currentQuestionIndex={questionIndex}
                      totalQuestions={QUESTIONS_PER_LEVEL}
                      isOnlineMode
                      onSubmitAnswer={handleAnswer}
                      currentPhase={currentPhase}
                      currentStepIndex={stepIndex}
                      totalSteps={totalSteps}
                      currentSegment={segment}
                      currentSubStepIndex={subStepIndex}
                      currentSubStep={currentSubStep}
                      stepTimeLeft={segment === 'main' ? timeLeft : null}
                      subStepTimeLeft={segment === 'sub' ? timeLeft : null}
                      correctAnswer={correctAnswer}
                      showResult={showResult}
                      locked={segmentLocked}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <div>Question {questionIndex + 1} of {QUESTIONS_PER_LEVEL}</div>
                    <Button size="sm" variant="ghost" onClick={resetLevel}>
                      Restart Lesson
                    </Button>
                  </div>
                </div>
              )}

              {status === 'level-complete' && (
                <div className="flex flex-col items-center text-center gap-4 py-6">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Level Complete</h3>
                    <p className="text-sm text-white/60 mt-1">
                      Great work. Stage progress: {computeUnlockedStage(progress.completedLevels)}/{totalStages}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => startLevel(selectedLevel)}>Replay Level</Button>
                    <Button
                      variant="outline"
                      onClick={() => startLevel(progress.currentLevel)}
                      disabled={!isLevelUnlocked(progress, progress.currentLevel)}
                    >
                      Next Level
                    </Button>
                  </div>
                </div>
              )}

              {status === 'level-failed' && (
                <div className="flex flex-col items-center text-center gap-4 py-6">
                  <div className="h-12 w-12 rounded-full bg-red-500/15 border border-red-400/40 flex items-center justify-center">
                    <Skull className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Level Failed</h3>
                    <p className="text-sm text-white/60 mt-1">
                      You ran out of hearts. Try again to keep progressing.
                    </p>
                  </div>
                  <Button onClick={resetLevel}>Retry Level</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
