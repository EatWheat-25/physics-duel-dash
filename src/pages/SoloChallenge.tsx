import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Check, X, Trophy, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MatchPatternBackground } from '@/components/battle/MatchPatternBackground'
import { QuestionGraph } from '@/components/math/QuestionGraph'
import { ScienceText } from '@/components/chem/ScienceText'
import RankBadge from '@/components/RankBadge'
import { getRankByPoints } from '@/types/ranking'
import { dbRowToQuestion } from '@/lib/question-contract'
import type { StepBasedQuestion, QuestionStep } from '@/types/question-contract'
import PostMatchResults from '@/components/PostMatchResults'
import type { UserRankData } from '@/types/ranking'

const TOTAL_ROUNDS = 3
const STEP_TIME_LIMIT_DEFAULT = 30
const SUB_STEP_TIME_LIMIT_DEFAULT = 10
const WIN_ACCURACY_PCT = 70

type Phase = 'loading' | 'round-intro' | 'playing' | 'round-result' | 'final-result' | 'ranked-result'
type Segment = 'main' | 'sub'

interface RoundResult {
  correct: number
  total: number
}

interface RankedResult {
  outcome: string
  accuracy_pct: number
  old_points: number
  new_points: number
  delta: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function SoloChallenge() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()

  const subject = (location.state as any)?.subject as string | undefined
  const level = (location.state as any)?.level as string | undefined

  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [segment, setSegment] = useState<Segment>('main')
  const [subStepIndex, setSubStepIndex] = useState(0)
  const [answerSubmitted, setAnswerSubmitted] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false)
  const [timeLeft, setTimeLeft] = useState(STEP_TIME_LIMIT_DEFAULT)
  const [showRoundIntro, setShowRoundIntro] = useState(false)

  const [roundCorrect, setRoundCorrect] = useState(0)
  const [roundTotal, setRoundTotal] = useState(0)
  const [cumulativeCorrect, setCumulativeCorrect] = useState(0)
  const [cumulativeTotal, setCumulativeTotal] = useState(0)
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [rankedResult, setRankedResult] = useState<RankedResult | null>(null)
  const [rankedLoading, setRankedLoading] = useState(false)

  const timerRef = useRef<number | null>(null)

  const currentQuestion = questions[roundIndex] ?? null
  const currentStep: QuestionStep | null = currentQuestion?.steps?.[stepIndex] ?? null
  const subSteps = currentStep?.subSteps ?? []
  const currentSubStep = segment === 'sub' ? subSteps[subStepIndex] ?? null : null
  const totalSteps = currentQuestion?.steps?.length ?? 0

  const myRankPoints = profile?.rank_points ?? 0
  const myRank = getRankByPoints(myRankPoints)
  const myName = profile?.username ?? user?.email?.split('@')[0] ?? 'Player'
  const myInitial = myName.charAt(0).toUpperCase()

  const overallAccuracyPct = cumulativeTotal > 0
    ? Math.round((cumulativeCorrect / cumulativeTotal) * 100)
    : 0

  // Fetch questions on mount
  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    if (!subject) {
      toast.error('No subject selected')
      navigate('/')
      return
    }

    let cancelled = false
    ;(async () => {
      let query = supabase
        .from('questions_v2')
        .select('*')
        .eq('is_enabled', true)

      if (subject) query = query.eq('subject', subject)
      if (level) query = query.eq('level', level)

      const { data, error } = await query.limit(200)
      if (cancelled) return
      if (error || !data || data.length === 0) {
        toast.error('No questions available for this subject')
        navigate('/')
        return
      }

      const mapped = data
        .map((row) => { try { return dbRowToQuestion(row) } catch { return null } })
        .filter((q): q is StepBasedQuestion => q !== null && q.steps.length > 0)

      if (mapped.length < TOTAL_ROUNDS) {
        toast.error('Not enough questions available')
        navigate('/')
        return
      }

      const picked = shuffle(mapped).slice(0, TOTAL_ROUNDS)
      setQuestions(picked)
      startRound(0, picked)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, subject, level])

  const startRound = useCallback((idx: number, qs?: StepBasedQuestion[]) => {
    const q = (qs ?? questions)[idx]
    if (!q) return

    setRoundIndex(idx)
    setStepIndex(0)
    setSegment('main')
    setSubStepIndex(0)
    setAnswerSubmitted(false)
    setShowResult(false)
    setRoundCorrect(0)
    setRoundTotal(0)

    setShowRoundIntro(true)
    setPhase('round-intro')
    setTimeout(() => {
      setShowRoundIntro(false)
      setPhase('playing')
      const step = q.steps[0]
      const tl = step?.timeLimitSeconds ?? STEP_TIME_LIMIT_DEFAULT
      setTimeLeft(tl)
    }, 2000)
  }, [questions])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing') return
    if (answerSubmitted) return

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerSubmitted, stepIndex, segment, subStepIndex, roundIndex])

  const handleTimeout = useCallback(() => {
    if (answerSubmitted) return
    finalizeAnswer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerSubmitted, currentStep, currentSubStep, segment])

  const finalizeAnswer = useCallback((answerIndex: number | null) => {
    if (answerSubmitted) return
    setAnswerSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const correctIdx = segment === 'sub'
      ? (currentSubStep?.correctAnswer ?? 0)
      : (currentStep?.correctAnswer ?? 0)

    const isCorrect = answerIndex !== null && answerIndex === correctIdx
    setLastAnswerCorrect(isCorrect)
    setShowResult(true)

    if (segment === 'main') {
      setRoundTotal((p) => p + 1)
      setCumulativeTotal((p) => p + 1)
      if (isCorrect) {
        setRoundCorrect((p) => p + 1)
        setCumulativeCorrect((p) => p + 1)
      }
    }

    setTimeout(() => advanceSegment(isCorrect), 800)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerSubmitted, currentStep, currentSubStep, segment, stepIndex, subStepIndex, roundIndex])

  const advanceSegment = useCallback((wasCorrect: boolean) => {
    if (!currentQuestion || !currentStep) return

    // If in sub, try next sub-step
    if (segment === 'sub') {
      const nextSub = subStepIndex + 1
      if (nextSub < subSteps.length) {
        setSubStepIndex(nextSub)
        setAnswerSubmitted(false)
        setShowResult(false)
        setTimeLeft(subSteps[nextSub]?.timeLimitSeconds ?? SUB_STEP_TIME_LIMIT_DEFAULT)
        return
      }
    }

    // If main and has sub-steps, go to sub
    if (segment === 'main' && subSteps.length > 0) {
      setSegment('sub')
      setSubStepIndex(0)
      setAnswerSubmitted(false)
      setShowResult(false)
      setTimeLeft(subSteps[0]?.timeLimitSeconds ?? SUB_STEP_TIME_LIMIT_DEFAULT)
      return
    }

    // Try next step
    const nextStep = stepIndex + 1
    if (nextStep < currentQuestion.steps.length) {
      setStepIndex(nextStep)
      setSegment('main')
      setSubStepIndex(0)
      setAnswerSubmitted(false)
      setShowResult(false)
      const ns = currentQuestion.steps[nextStep]
      setTimeLeft(ns?.timeLimitSeconds ?? STEP_TIME_LIMIT_DEFAULT)
      return
    }

    // Round complete — show round result
    endRound()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, currentStep, segment, subStepIndex, subSteps, stepIndex])

  const endRound = useCallback(() => {
    // We read from state at the time this fires, but setState is async.
    // Use a ref-free approach: derive from the updated values using functional setState.
    setRoundResults((prev) => {
      // We need the latest roundCorrect/roundTotal. Since endRound is called
      // after finalizeAnswer, which updates these, we rely on batch flushing.
      return prev // We'll update this inside the effect below
    })
    setPhase('round-result')
  }, [])

  // Capture round result when phase switches to round-result
  useEffect(() => {
    if (phase !== 'round-result') return
    setRoundResults((prev) => {
      if (prev.length > roundIndex) return prev
      return [...prev, { correct: roundCorrect, total: roundTotal }]
    })
  }, [phase, roundCorrect, roundTotal, roundIndex])

  // Auto-advance from round result
  useEffect(() => {
    if (phase !== 'round-result') return
    const t = setTimeout(() => {
      const nextRound = roundIndex + 1
      if (nextRound < TOTAL_ROUNDS) {
        startRound(nextRound)
      } else {
        setPhase('final-result')
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [phase, roundIndex, startRound])

  // Call ranked RPC when final result is shown
  useEffect(() => {
    if (phase !== 'final-result' || !user || rankedLoading) return
    if (cumulativeTotal === 0) return

    setRankedLoading(true)
    ;(async () => {
      const { data, error } = await supabase.rpc('record_solo_challenge_v1', {
        p_player_id: user.id,
        p_subject: subject ?? 'math',
        p_level: level ?? 'A2',
        p_correct_parts: cumulativeCorrect,
        p_total_parts: cumulativeTotal,
      })
      if (error) {
        console.warn('[SoloChallenge] RPC failed:', error)
        toast.error('Failed to record ranked result')
      } else if (data) {
        setRankedResult(data as any)
      }
      setRankedLoading(false)
      setPhase('ranked-result')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, user?.id])

  const submitAnswer = useCallback((answerIndex: number) => {
    finalizeAnswer(answerIndex)
  }, [finalizeAnswer])

  const questionMotionInitial = { opacity: 0, y: 16, scale: 0.98 }
  const questionMotionAnimate = { opacity: 1, y: 0, scale: 1 }
  const questionMotionExit = {
    opacity: 0, y: -12, scale: 0.98,
    transition: { duration: 0.2, ease: 'easeIn' },
  }
  const questionMotionTransition = { duration: 0.4, ease: 'easeOut', delay: 0.3 }

  // Build ranked results for PostMatchResults
  const matchStatsForResults = useMemo(() => {
    if (!rankedResult) return null
    return {
      totalQuestions: cumulativeTotal,
      correctAnswers: cumulativeCorrect,
      wrongAnswers: Math.max(0, cumulativeTotal - cumulativeCorrect),
      playerScore: cumulativeCorrect,
      opponentScore: 0,
      pointsEarned: rankedResult.delta,
      won: rankedResult.outcome === 'win',
      outcome: rankedResult.outcome as 'win' | 'loss' | 'draw',
    }
  }, [rankedResult, cumulativeCorrect, cumulativeTotal])

  const userDataForResults = useMemo((): UserRankData | null => {
    if (!rankedResult || !user) return null
    const rank = getRankByPoints(rankedResult.new_points)
    return {
      username: myName,
      currentPoints: rankedResult.new_points,
      currentRank: { tier: rank.tier, subRank: rank.subRank },
      winStreak: 0,
      totalMatches: 0,
      wins: 0,
      losses: 0,
      accuracy: rankedResult.accuracy_pct,
      history: [],
      avatar: undefined,
    }
  }, [rankedResult, user, myName])

  // Loading state
  if (phase === 'loading') {
    return (
      <div className="min-h-screen text-white font-sans relative">
        <MatchPatternBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
          <div className="text-white/60 font-mono text-sm">Loading questions...</div>
        </div>
      </div>
    )
  }

  // Ranked result — use PostMatchResults
  if (phase === 'ranked-result' && matchStatsForResults && userDataForResults) {
    return (
      <PostMatchResults
        matchStats={matchStatsForResults}
        userData={userDataForResults}
        onContinue={() => navigate('/')}
        onPlayAgain={() => navigate('/solo-challenge', { state: { subject, level } })}
        questionReport={[]}
        reportLoading={false}
        isPlayer1={true}
        isBotMatch={true}
        botMinAccuracyPct={WIN_ACCURACY_PCT}
      />
    )
  }

  const displayTimeLeft = () => {
    if (segment === 'sub') {
      return `${timeLeft}s`
    }
    if (totalSteps > 1) {
      return `${timeLeft}s`
    }
    return `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`
  }

  const isTimeLow = () => {
    if (segment === 'sub') return timeLeft <= 2
    if (totalSteps > 1) return timeLeft <= 5
    return timeLeft <= 10
  }

  return (
    <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      <MatchPatternBackground />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent pointer-events-none" />

      {/* Round Intro Overlay */}
      <AnimatePresence>
        {showRoundIntro && (
          <motion.div
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
          >
            <div className="text-center">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-blue-500 font-mono tracking-[0.5em] text-sm mb-4 uppercase"
              >
                {subject ?? 'Challenge'}
              </motion.div>
              <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter italic">
                ROUND {roundIndex + 1}
              </h1>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="h-2 w-32 bg-blue-500 mx-auto mt-6 rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="relative z-20 w-full max-w-7xl mx-auto p-4 md:p-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium tracking-wide">EXIT</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-mono text-blue-200 uppercase tracking-wider">
            SOLO CHALLENGE
          </span>
        </div>
      </header>

      {/* Main Arena */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-6 flex flex-col h-[calc(100vh-100px)]">

        {/* Score/Status Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8 items-end">
          {/* Player */}
          <div className="flex flex-col items-start">
            <div className="mb-3">
              <div className="text-4xl md:text-5xl font-black text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.6)]">
                {overallAccuracyPct}%
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
                <span className="font-bold text-lg">{myInitial}</span>
              </div>
              <div>
                <div className="text-xs text-blue-200/50 font-mono mb-0.5">OPERATOR</div>
                <div className="font-bold text-shadow-glow text-lg">{myName}</div>
                <RankBadge rank={{ tier: myRank.tier, subRank: myRank.subRank }} size="md" className="mt-2" />
              </div>
            </div>
          </div>

          {/* Timer / Round Indicator */}
          <div className="flex flex-col items-center pb-2">
            <div className="text-xs text-white/30 font-mono mb-2 uppercase tracking-widest">
              ROUND {roundIndex + 1} OF {TOTAL_ROUNDS}
              {phase === 'playing' && totalSteps > 1 && ` • STEP ${stepIndex + 1}/${totalSteps}${segment === 'sub' ? ` • SUB ${subStepIndex + 1}` : ''}`}
            </div>
            {phase === 'playing' && (
              <div className={`text-5xl font-black font-mono tracking-tighter tabular-nums transition-colors duration-300 ${
                isTimeLow()
                  ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]'
              }`}>
                {displayTimeLeft()}
              </div>
            )}
          </div>

          {/* Accuracy Tracker (replaces opponent) */}
          <div className="flex flex-col items-end">
            <div className="mb-3">
              <div className="text-4xl md:text-5xl font-black text-orange-400 drop-shadow-[0_0_20px_rgba(251,146,60,0.6)]">
                {cumulativeCorrect}/{cumulativeTotal}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-row-reverse text-right">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center shadow-lg shadow-orange-500/20 ring-1 ring-orange-400/30">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-orange-200/50 font-mono mb-0.5">TARGET</div>
                <div className="font-bold text-shadow-glow text-lg">&gt;{WIN_ACCURACY_PCT}%</div>
                <div className="text-xs text-white/40 font-mono mt-1">to win</div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 relative flex items-center justify-center">
          <AnimatePresence mode="wait">

            {/* PLAYING: Multi-step main question phase */}
            {phase === 'playing' && currentQuestion && totalSteps > 1 && segment === 'main' && stepIndex === 0 && !answerSubmitted && currentStep && (
              <motion.div
                key={`main-q-${roundIndex}`}
                initial={questionMotionInitial}
                animate={questionMotionAnimate}
                exit={questionMotionExit}
                transition={questionMotionTransition}
                className="match-paper w-full max-w-[96rem] mx-auto px-4 md:px-8 lg:px-12"
              >
                <div className="paper-card mb-8">
                  <div className="paper-meta mb-4">
                    Step {stepIndex + 1} of {totalSteps}
                  </div>
                  {(currentQuestion as any)?.graph && (
                    <div className="mb-6">
                      <QuestionGraph graph={(currentQuestion as any).graph} />
                    </div>
                  )}
                  <h3 className="paper-title">
                    <ScienceText text={currentStep.prompt || currentStep.title || currentQuestion.stem || ''} />
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentStep.options?.filter((o: string) => String(o).trim()).map((option: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => submitAnswer(idx)}
                      disabled={answerSubmitted}
                      className="paper-option"
                    >
                      <div className="flex items-center gap-4">
                        <div className="paper-option-letter">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <ScienceText text={String(option)} className="paper-option-text" smilesSize="sm" />
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* PLAYING: Steps phase (multi-step, step > 0 or after first answer) */}
            {phase === 'playing' && currentQuestion && currentStep && (totalSteps <= 1 || stepIndex > 0 || answerSubmitted || segment === 'sub') && !(totalSteps > 1 && segment === 'main' && stepIndex === 0 && !answerSubmitted) && (
              <motion.div
                key={`step-${roundIndex}-${stepIndex}-${segment}-${subStepIndex}`}
                initial={questionMotionInitial}
                animate={questionMotionAnimate}
                exit={questionMotionExit}
                transition={questionMotionTransition}
                className="match-paper w-full max-w-[96rem] mx-auto px-4 md:px-8 lg:px-12"
              >
                <div className="paper-card mb-8">
                  <div className="space-y-4 mb-6">
                    <div className="paper-meta">
                      {totalSteps > 1 ? (
                        segment === 'sub'
                          ? `Step ${stepIndex + 1} • Sub-step ${subStepIndex + 1}`
                          : `Step ${stepIndex + 1} of ${totalSteps}`
                      ) : (
                        'Main Question'
                      )}
                    </div>
                    {(currentQuestion as any)?.graph && stepIndex === 0 && segment === 'main' && (
                      <div className="mb-6">
                        <QuestionGraph graph={(currentQuestion as any).graph} />
                      </div>
                    )}
                    <h3 className="paper-title">
                      <ScienceText text={
                        segment === 'sub'
                          ? (currentSubStep?.prompt || '')
                          : (currentStep.prompt || currentStep.title || currentQuestion.stem || '')
                      } />
                    </h3>
                    {segment === 'sub' && (
                      <p className="text-sm text-black mt-3">
                        Quick check — must be correct to earn this step&apos;s marks
                      </p>
                    )}
                  </div>

                  {!answerSubmitted && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      {(segment === 'sub' ? currentSubStep?.options : currentStep.options)
                        ?.filter((o: string) => String(o).trim())
                        .map((option: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => submitAnswer(idx)}
                            disabled={answerSubmitted || timeLeft <= 0}
                            className="paper-option"
                          >
                            <div className="flex items-center gap-4">
                              <div className="paper-option-letter">
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <ScienceText text={String(option)} className="paper-option-text" smilesSize="sm" />
                            </div>
                          </button>
                        ))}
                    </div>
                  )}

                  {answerSubmitted && showResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 text-left"
                    >
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border ${
                        lastAnswerCorrect
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {lastAnswerCorrect ? (
                          <><Check className="w-4 h-4" /> Correct!</>
                        ) : (
                          <><X className="w-4 h-4" /> Incorrect</>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ROUND RESULT */}
            {phase === 'round-result' && (
              <motion.div
                key={`round-result-${roundIndex}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-8">
                  <div className="inline-block p-4 rounded-full bg-blue-500/20 mb-4 ring-4 ring-blue-500/10">
                    <Check className="w-12 h-12 text-blue-400" />
                  </div>
                  <h2 className="text-4xl font-bold mb-2 tracking-tight">
                    ROUND {roundIndex + 1} COMPLETE
                  </h2>
                  <div className="text-sm text-white/60 font-mono mb-2">
                    Round {roundIndex + 1} of {TOTAL_ROUNDS}
                  </div>
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className={`p-6 rounded-2xl border-2 text-center ${
                    roundTotal > 0 && Math.round((roundCorrect / roundTotal) * 100) > WIN_ACCURACY_PCT
                      ? 'bg-green-500/20 border-green-500/40'
                      : 'bg-orange-500/20 border-orange-500/40'
                  }`}
                >
                  <div className="text-xs font-mono text-white/60 mb-2 uppercase tracking-wider">
                    ROUND ACCURACY
                  </div>
                  <div className={`text-5xl md:text-6xl font-black mb-2 ${
                    roundTotal > 0 && Math.round((roundCorrect / roundTotal) * 100) > WIN_ACCURACY_PCT
                      ? 'text-green-400'
                      : 'text-orange-400'
                  }`}>
                    {roundCorrect}/{roundTotal}
                  </div>
                  <div className="text-lg font-mono text-white/80">
                    {roundTotal > 0 ? Math.round((roundCorrect / roundTotal) * 100) : 0}%
                  </div>
                </motion.div>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5 text-center"
                >
                  <div className="text-xs font-mono text-white/60 mb-1 uppercase tracking-wider">
                    OVERALL PROGRESS
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {cumulativeCorrect}/{cumulativeTotal} correct ({overallAccuracyPct}%)
                  </div>
                  <div className="text-xs font-mono text-white/40 mt-1">
                    Need &gt;{WIN_ACCURACY_PCT}% to win
                  </div>
                </motion.div>

                <div className="mt-6">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <div className="text-sm font-mono text-white/60">
                      {roundIndex + 1 < TOTAL_ROUNDS ? 'NEXT ROUND LOADING...' : 'CALCULATING FINAL RESULTS...'}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* FINAL RESULT (before ranked RPC returns) */}
            {phase === 'final-result' && (
              <motion.div
                key="final-result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-6">
                  {overallAccuracyPct > WIN_ACCURACY_PCT ? (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                      className="inline-block p-4 rounded-full bg-yellow-500/20 mb-4 ring-4 ring-yellow-500/10"
                    >
                      <Trophy className="w-12 h-12 text-yellow-500" />
                    </motion.div>
                  ) : (
                    <div className="inline-block p-4 rounded-full bg-red-500/20 mb-4 ring-4 ring-red-500/10">
                      <X className="w-12 h-12 text-red-500" />
                    </div>
                  )}
                  <h2 className="text-4xl font-bold mb-2 tracking-tight">
                    {overallAccuracyPct > WIN_ACCURACY_PCT ? 'CHALLENGE PASSED' : 'CHALLENGE FAILED'}
                  </h2>
                  <div className="text-lg font-bold mb-2">
                    Final Accuracy: {overallAccuracyPct}%
                  </div>
                  <p className="text-white/40 font-mono text-sm">
                    {overallAccuracyPct > WIN_ACCURACY_PCT
                      ? `You scored above ${WIN_ACCURACY_PCT}%!`
                      : `You needed above ${WIN_ACCURACY_PCT}% to win.`}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2 mt-6">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <div className="text-sm font-mono text-white/60">Computing ranked results...</div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
