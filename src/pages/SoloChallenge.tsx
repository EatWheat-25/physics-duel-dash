import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Check, X, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MatchPatternBackground } from '@/components/battle/MatchPatternBackground'
import { QuestionGraph } from '@/components/math/QuestionGraph'
import { ScienceText } from '@/components/chem/ScienceText'
import { getRankByPoints } from '@/types/ranking'
import {
  CAMPAIGN_SUBJECT_LABELS,
  getCampaignSummaryLabel,
  isCampaignSelectionState,
  type CampaignLevel,
  type CampaignSelectionState,
  type CampaignTopicKind,
} from '@/lib/campaignMode'
import {
  getSeenCampaignQuestionIds,
  markCampaignQuestionIdsSeen,
  type CampaignQuestionHistoryScope,
} from '@/lib/campaignQuestionHistory'
import {
  getSeenQuestionIds,
  markQuestionIdsSeen,
  type QuestionSelectionHistoryScope,
} from '@/lib/questionSelectionHistory'
import { buildArchetypeBag } from '@/lib/archetypeBag'
import { dbRowToQuestion } from '@/lib/question-contract'
import { normalizeInlineMathOption } from '@/lib/optionMath'
import type { GraphConfig, StepBasedQuestion, QuestionStep } from '@/types/question-contract'
import PostMatchResults from '@/components/PostMatchResults'
import type { UserRankData } from '@/types/ranking'
import type { QuestionSubject } from '@/types/questions'
import type { Database } from '@/integrations/supabase/types'
import {
  formatDifficultyLabel,
  getDifficultyFallbackOrder,
  getDifficultyForRankPoints,
  type RankBasedDifficulty,
} from '../../shared/rankDifficulty'

const TOTAL_ROUNDS = 3
const STEP_TIME_LIMIT_DEFAULT = 15
const MAIN_QUESTION_TIME_LIMIT_DEFAULT = 180
const WIN_ACCURACY_PCT = 65
const QUESTION_FETCH_PAGE_SIZE = 500

type Phase = 'loading' | 'round-intro' | 'playing' | 'round-result' | 'final-result' | 'ranked-result'
type Segment = 'main' | 'sub'
type QuestionRow = Database['public']['Tables']['questions_v2']['Row']

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
  topic_kind?: string
  topic_key?: string
  topic_label?: string
}

async function fetchMatchingQuestionRows({
  subject,
  level,
  topicKind,
  topicValue,
}: {
  subject?: string
  level?: string
  topicKind?: CampaignTopicKind
  topicValue?: string
}): Promise<{ data: QuestionRow[] | null; error: string | null }> {
  const rows: QuestionRow[] = []
  let offset = 0

  while (true) {
    // Sanitized server-side fetch: steps come back without answer keys.
    const { data, error } = await (supabase.rpc as any)('get_questions_for_play_v1', {
      p_subject: subject ?? null,
      p_level: level ?? null,
      p_chapter: topicKind === 'chapter' ? topicValue ?? null : null,
      p_topic_tag: topicKind === 'topicTag' ? topicValue ?? null : null,
      p_limit: QUESTION_FETCH_PAGE_SIZE,
      p_offset: offset,
    })

    if (error) {
      return { data: null, error: error.message }
    }

    const page = (data ?? []) as QuestionRow[]
    if (page.length === 0) {
      break
    }

    rows.push(...page)

    if (page.length < QUESTION_FETCH_PAGE_SIZE) {
      break
    }

    offset += QUESTION_FETCH_PAGE_SIZE
  }

  return { data: rows, error: null }
}

function pickCampaignQuestions({
  pools,
  targetDifficulty,
  seenQuestionIds,
}: {
  pools: Record<RankBasedDifficulty, StepBasedQuestion[]>
  targetDifficulty: RankBasedDifficulty
  seenQuestionIds: Set<string>
}): {
  picked: StepBasedQuestion[]
  fallbackDifficultiesUsed: RankBasedDifficulty[]
  repeatedSeenQuestions: number
  duplicateQuestions: number
  unseenCounts: Record<RankBasedDifficulty, number>
} {
  const unseenCounts: Record<RankBasedDifficulty, number> = {
    easy: pools.easy.filter((question) => !seenQuestionIds.has(question.id)).length,
    medium: pools.medium.filter((question) => !seenQuestionIds.has(question.id)).length,
    hard: pools.hard.filter((question) => !seenQuestionIds.has(question.id)).length,
  }

  // System A (Tetris Bag): one question per archetype, round-robined for
  // mechanical variety, with difficulty fallback + exclusion memory preserved.
  const bag = buildArchetypeBag({
    questions: [...pools.easy, ...pools.medium, ...pools.hard],
    count: TOTAL_ROUNDS,
    seenQuestionIds,
    difficultyFallbackOrder: getDifficultyFallbackOrder(targetDifficulty),
    allowDuplicateFallback: true,
  })

  const fallbackDifficultiesUsed = [
    ...new Set(
      bag.picked
        .map((question) => question.difficulty)
        .filter(
          (difficulty): difficulty is RankBasedDifficulty =>
            difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard'
        )
    ),
  ].filter((difficulty) => difficulty !== targetDifficulty)

  return {
    picked: bag.picked,
    fallbackDifficultiesUsed,
    repeatedSeenQuestions: bag.reusedSeenQuestionCount,
    duplicateQuestions: bag.duplicateQuestionCount,
    unseenCounts,
  }
}

export default function SoloChallenge() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const routeState = location.state as Partial<CampaignSelectionState> & {
    subject?: string
    level?: string
  }
  const campaignSelection = isCampaignSelectionState(routeState) ? routeState : null
  const subject = campaignSelection?.subject ?? routeState?.subject
  const level = campaignSelection?.level ?? routeState?.level
  const isCampaignMode = Boolean(campaignSelection)
  const topicKind = campaignSelection?.topicKind
  const topicValue = campaignSelection?.topicValue
  const topicLabel = campaignSelection?.topicLabel
  const topicRankPoints = campaignSelection?.topicRankPoints ?? 0
  const challengeLabel = isCampaignMode ? 'Campaign' : 'Solo Challenge'
  const returnRoute = isCampaignMode ? '/campaign' : '/'
  const replayRoute = isCampaignMode ? '/campaign/play' : '/solo-challenge'

  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [segment, setSegment] = useState<Segment>('main')
  const [mainTimeLeft, setMainTimeLeft] = useState(MAIN_QUESTION_TIME_LIMIT_DEFAULT)
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
  const [rankedError, setRankedError] = useState<string | null>(null)
  const [rankedAttempt, setRankedAttempt] = useState(0)
  const [resolvedCampaignRankPoints, setResolvedCampaignRankPoints] = useState(topicRankPoints)
  const [campaignRankLoading, setCampaignRankLoading] = useState(isCampaignMode)

  const timerRef = useRef<number | null>(null)
  const mainTimerRef = useRef<number | null>(null)
  // Per-round answers (main steps only) for authoritative server grading.
  const answersRef = useRef<Array<{ questionId: string; answers: (number | null)[] }>>([])

  const currentQuestion = questions[roundIndex] ?? null
  const currentStep: QuestionStep | null = currentQuestion?.steps?.[stepIndex] ?? null
  const subSteps = currentStep?.subSteps ?? []
  const currentSubStep = segment === 'sub' ? subSteps[subStepIndex] ?? null : null
  const totalSteps = currentQuestion?.steps?.length ?? 0
  const paperGraph: GraphConfig | null | undefined = currentQuestion?.graph
    ? ({ ...currentQuestion.graph, color: 'black' } as GraphConfig)
    : undefined

  const myName = profile?.username ?? user?.email?.split('@')[0] ?? 'Player'
  const subjectLabel = subject === 'math' || subject === 'physics' || subject === 'chemistry'
    ? CAMPAIGN_SUBJECT_LABELS[subject as QuestionSubject]
    : 'Challenge'
  const runLabel = campaignSelection
    ? getCampaignSummaryLabel(campaignSelection)
    : `${subjectLabel}${level ? ` ${level}` : ''}`
  const campaignTargetDifficulty = isCampaignMode
    ? getDifficultyForRankPoints(resolvedCampaignRankPoints)
    : null
  const campaignHistoryScope = useMemo<CampaignQuestionHistoryScope | null>(() => {
    if (
      !user?.id ||
      !isCampaignMode ||
      !subject ||
      (subject !== 'math' && subject !== 'physics' && subject !== 'chemistry') ||
      !level ||
      (level !== 'A1' && level !== 'A2') ||
      !topicKind ||
      !topicValue
    ) {
      return null
    }

    return {
      userId: user.id,
      subject: subject as QuestionSubject,
      level: level as CampaignLevel,
      topicKind,
      topicValue,
    }
  }, [isCampaignMode, level, subject, topicKind, topicValue, user?.id])

  const soloHistoryScope = useMemo<QuestionSelectionHistoryScope | null>(() => {
    if (
      isCampaignMode ||
      !subject ||
      (subject !== 'math' && subject !== 'physics' && subject !== 'chemistry')
    ) {
      return null
    }

    return {
      userId: user?.id ?? null,
      source: 'solo-challenge',
      subject,
      level: level === 'A1' || level === 'A2' ? level : null,
    }
  }, [isCampaignMode, level, subject, user?.id])

  const overallAccuracyPct = cumulativeTotal > 0
    ? Math.floor((cumulativeCorrect / cumulativeTotal) * 100)
    : 0

  useEffect(() => {
    document.title = `${challengeLabel} | BattleNerds`
  }, [challengeLabel])

  useEffect(() => {
    if (!isCampaignMode) {
      setResolvedCampaignRankPoints(0)
      setCampaignRankLoading(false)
      return
    }

    setResolvedCampaignRankPoints(topicRankPoints)

    if (!user?.id || !subject || !level || !topicKind || !topicValue) {
      setCampaignRankLoading(false)
      return
    }

    let cancelled = false
    setCampaignRankLoading(true)

    ;(async () => {
      const { data, error } = await supabase
        .from('campaign_rank_points')
        .select('rank_points')
        .eq('subject', subject)
        .eq('level', level)
        .eq('topic_kind', topicKind)
        .eq('topic_key', topicValue)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.warn('[SoloChallenge] Failed to resolve current campaign rank points:', error)
        setResolvedCampaignRankPoints(topicRankPoints)
        setCampaignRankLoading(false)
        return
      }

      setResolvedCampaignRankPoints(data?.rank_points ?? topicRankPoints)
      setCampaignRankLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isCampaignMode, level, location.key, subject, topicKind, topicRankPoints, topicValue, user?.id])

  // Fetch questions on mount
  useEffect(() => {
    if (isCampaignMode && campaignRankLoading) return
    if (!user) {
      navigate(returnRoute)
      return
    }
    if (!subject) {
      toast.error('No subject selected')
      navigate(returnRoute)
      return
    }

    let cancelled = false
    ;(async () => {
      const { data, error } = await fetchMatchingQuestionRows({
        subject,
        level,
        topicKind,
        topicValue,
      })
      if (cancelled) return

      if (error || !data || data.length === 0) {
        if (isCampaignMode) {
          toast.error(`No campaign questions available for ${topicLabel ?? 'that topic'}`)
          navigate('/campaign', {
            state: campaignSelection ?? { subject, level },
            replace: true,
          })
        } else {
          toast.error('No questions available for this subject')
          navigate(returnRoute)
        }
        return
      }

      const mapped = data
        .map((row) => { try { return dbRowToQuestion(row) } catch { return null } })
        .filter((q): q is StepBasedQuestion => q !== null && q.steps.length > 0)

      if (isCampaignMode && campaignTargetDifficulty) {
        const pools: Record<RankBasedDifficulty, StepBasedQuestion[]> = {
          easy: mapped.filter((question) => question.difficulty === 'easy'),
          medium: mapped.filter((question) => question.difficulty === 'medium'),
          hard: mapped.filter((question) => question.difficulty === 'hard'),
        }

        const selected = pickCampaignQuestions({
          pools,
          targetDifficulty: campaignTargetDifficulty,
          seenQuestionIds: campaignHistoryScope ? getSeenCampaignQuestionIds(campaignHistoryScope) : new Set<string>(),
        })

        if (selected.picked.length < TOTAL_ROUNDS) {
          toast.error(`No usable campaign questions were found for ${topicLabel ?? 'that campaign topic'}`)
          navigate('/campaign', {
            state: campaignSelection ?? { subject, level },
            replace: true,
          })
          return
        }

        if (selected.fallbackDifficultiesUsed.length > 0) {
          const targetPoolCount = selected.unseenCounts[campaignTargetDifficulty]
          const fallbackLabel = selected.fallbackDifficultiesUsed.map(formatDifficultyLabel).join(', ')
          toast.warning(
            `Only ${targetPoolCount} fresh ${campaignTargetDifficulty} question${targetPoolCount === 1 ? '' : 's'} were left for ${topicLabel ?? 'this topic'}, so this run also uses ${fallbackLabel.toLowerCase()} questions.`
          )
        }

        const reusedQuestionCount = selected.repeatedSeenQuestions + selected.duplicateQuestions
        if (reusedQuestionCount > 0) {
          toast.warning(
            `Fresh campaign questions were exhausted for ${topicLabel ?? 'this topic'}, so ${reusedQuestionCount} older question${reusedQuestionCount === 1 ? '' : 's'} had to be reused.`
          )
        }

        setQuestions(selected.picked)
        startRound(0, selected.picked)
        return
      }

      const selected = buildArchetypeBag({
        questions: mapped,
        count: TOTAL_ROUNDS,
        seenQuestionIds: soloHistoryScope ? getSeenQuestionIds(soloHistoryScope) : new Set<string>(),
        allowDuplicateFallback: true,
      })

      if (selected.picked.length === 0) {
        toast.error('No questions available for this subject')
        navigate(returnRoute)
        return
      }

      if (selected.reusedSeenQuestionCount > 0) {
        toast.warning(
          `Only ${selected.freshAvailableCount} fresh question${selected.freshAvailableCount === 1 ? '' : 's'} were left for this solo queue, so ${selected.reusedSeenQuestionCount} older question${selected.reusedSeenQuestionCount === 1 ? '' : 's'} were reused.`
        )
      }

      if (selected.duplicateQuestionCount > 0) {
        const uniqueQuestionCount = new Set(mapped.map((question) => question.id)).size
        toast.warning(
          `Only ${uniqueQuestionCount} unique question${uniqueQuestionCount === 1 ? '' : 's'} were available for this solo queue, so ${selected.duplicateQuestionCount} question${selected.duplicateQuestionCount === 1 ? '' : 's'} had to repeat in this run.`
        )
      }

      if (soloHistoryScope) {
        markQuestionIdsSeen(soloHistoryScope, selected.picked.map((question) => question.id))
      }

      setQuestions(selected.picked)
      startRound(0, selected.picked)
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignRankLoading, campaignTargetDifficulty, isCampaignMode, level, location.key, navigate, returnRoute, soloHistoryScope, subject, topicKind, topicLabel, topicValue, user?.id])

  const startRound = useCallback((idx: number, qs?: StepBasedQuestion[]) => {
    const q = (qs ?? questions)[idx]
    if (!q) return

    if (timerRef.current) clearInterval(timerRef.current)
    if (mainTimerRef.current) clearInterval(mainTimerRef.current)

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
      const rawMain = q.mainQuestionTimerSeconds
      const parsedMain = Number(rawMain)
      const clampedMain = Number.isFinite(parsedMain)
        ? Math.max(5, Math.min(600, Math.floor(parsedMain)))
        : MAIN_QUESTION_TIME_LIMIT_DEFAULT
      setMainTimeLeft(clampedMain)
      setTimeLeft(STEP_TIME_LIMIT_DEFAULT)
    }, 2000)
  }, [questions])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing') return
    if (answerSubmitted) return

    const inMainPhase =
      segment === 'main' && stepIndex === 0 && totalSteps > 0 && !answerSubmitted && mainTimeLeft > 0

    if (inMainPhase) {
      mainTimerRef.current = window.setInterval(() => {
        setMainTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(mainTimerRef.current!)
            // Transition into steps once main question timer ends
            setMainTimeLeft(0)
            setSegment('main')
            setAnswerSubmitted(false)
            setShowResult(false)
            setTimeLeft(STEP_TIME_LIMIT_DEFAULT)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        if (mainTimerRef.current) clearInterval(mainTimerRef.current)
      }
    }

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
  }, [phase, answerSubmitted, stepIndex, segment, subStepIndex, roundIndex, mainTimeLeft, totalSteps])

  const handleTimeout = useCallback(() => {
    if (answerSubmitted) return
    finalizeAnswer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerSubmitted, currentStep, currentSubStep, segment])

  const submitEarlyAnswer = useCallback(() => {
    if (phase !== 'playing') return
    if (mainTimeLeft <= 0) return
    if (timerRef.current) clearInterval(timerRef.current)
    if (mainTimerRef.current) clearInterval(mainTimerRef.current)
    setMainTimeLeft(0)
    setSegment('main')
    setAnswerSubmitted(false)
    setShowResult(false)
    setTimeLeft(STEP_TIME_LIMIT_DEFAULT)
  }, [phase, mainTimeLeft])

  const finalizeAnswer = useCallback((answerIndex: number | null) => {
    if (answerSubmitted) return
    setAnswerSubmitted(true)
    if (timerRef.current) clearInterval(timerRef.current)

    // Record main-step answers for authoritative server grading at the end.
    if (segment === 'main' && currentQuestion) {
      const entry = answersRef.current[roundIndex] ?? { questionId: currentQuestion.id, answers: [] }
      entry.questionId = currentQuestion.id
      entry.answers[stepIndex] = answerIndex
      answersRef.current[roundIndex] = entry
    }

    const applyOutcome = (isCorrect: boolean) => {
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
    }

    // Timeouts are always incorrect; otherwise ask the server (answer keys
    // are no longer shipped to the client).
    if (answerIndex === null || !currentQuestion || !currentStep) {
      applyOutcome(false)
      return
    }

    ;(async () => {
      const { data, error } = await (supabase.rpc as any)('check_step_answer_v1', {
        p_question_id: currentQuestion.id,
        p_step_index: currentStep.index ?? stepIndex,
        p_answer: answerIndex,
        p_sub_index: segment === 'sub' ? subStepIndex : null,
      })

      if (error || !data) {
        console.warn('[SoloChallenge] check_step_answer_v1 failed:', error)
        applyOutcome(false)
        return
      }

      applyOutcome(Boolean((data as { is_correct?: boolean }).is_correct))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerSubmitted, currentQuestion, currentStep, currentSubStep, segment, stepIndex, subStepIndex, roundIndex])

  const advanceSegment = useCallback((wasCorrect: boolean) => {
    if (!currentQuestion || !currentStep) return

    // If in sub, try next sub-step
    if (segment === 'sub') {
      const nextSub = subStepIndex + 1
      if (nextSub < subSteps.length) {
        setSubStepIndex(nextSub)
        setAnswerSubmitted(false)
        setShowResult(false)
        setTimeLeft(STEP_TIME_LIMIT_DEFAULT)
        return
      }
    }

    // If main and has sub-steps, go to sub
    if (segment === 'main' && subSteps.length > 0) {
      setSegment('sub')
      setSubStepIndex(0)
      setAnswerSubmitted(false)
      setShowResult(false)
      setTimeLeft(STEP_TIME_LIMIT_DEFAULT)
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
      setTimeLeft(STEP_TIME_LIMIT_DEFAULT)
      return
    }

    // Round complete — show round result
    endRound()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, currentStep, segment, subStepIndex, subSteps, stepIndex])

  const endRound = useCallback(() => {
    if (campaignHistoryScope && currentQuestion?.id) {
      markCampaignQuestionIdsSeen(campaignHistoryScope, [currentQuestion.id])
    }

    // We read from state at the time this fires, but setState is async.
    // Use a ref-free approach: derive from the updated values using functional setState.
    setRoundResults((prev) => {
      // We need the latest roundCorrect/roundTotal. Since endRound is called
      // after finalizeAnswer, which updates these, we rely on batch flushing.
      return prev // We'll update this inside the effect below
    })
    setPhase('round-result')
  }, [campaignHistoryScope, currentQuestion?.id])

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
    setRankedError(null)
    let cancelled = false
    ;(async () => {
      // Server-side grading: send the chosen answer indices and let the RPC
      // re-grade them against the stored answer keys before applying rank.
      const attemptAnswers = answersRef.current
        .filter((entry): entry is { questionId: string; answers: (number | null)[] } => Boolean(entry?.questionId))
        .map((entry) => ({
          question_id: entry.questionId,
          answers: Array.from(entry.answers, (a) => (typeof a === 'number' ? a : null)),
        }))

      const { data, error } = await (supabase.rpc as any)('grade_solo_attempt_v1', {
        p_mode: isCampaignMode ? 'campaign' : 'solo',
        p_subject: subject ?? 'math',
        p_level: level ?? 'A2',
        p_answers: attemptAnswers,
        p_topic_kind: isCampaignMode ? topicKind ?? 'chapter' : null,
        p_topic_key: isCampaignMode ? topicValue ?? '' : null,
        p_topic_label: isCampaignMode ? topicLabel ?? topicValue ?? '' : null,
      })
      if (cancelled) return
      if (error) {
        console.warn('[SoloChallenge] RPC failed:', error)
        const message = error.message ?? `Failed to record ${isCampaignMode ? 'campaign' : 'ranked'} result`
        setRankedError(message)
        toast.error(message)
        setRankedLoading(false)
        return
      }

      if (!data) {
        const message = `No ${isCampaignMode ? 'campaign' : 'ranked'} result returned`
        setRankedError(message)
        toast.error(`${challengeLabel} rank update failed`)
        setRankedLoading(false)
        return
      }

      setRankedResult(data as RankedResult)
      setRankedLoading(false)
      setPhase('ranked-result')
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, user?.id, rankedAttempt])

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
          <div className="text-white/60 font-mono text-sm">
            {isCampaignMode ? 'Loading campaign questions...' : 'Loading questions...'}
          </div>
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
        onContinue={() => navigate(returnRoute, { state: campaignSelection ?? undefined })}
        onPlayAgain={() =>
          navigate(replayRoute, {
            state: campaignSelection
              ? { ...campaignSelection, topicRankPoints: rankedResult?.new_points ?? resolvedCampaignRankPoints }
              : { subject, level },
          })
        }
        questionReport={[]}
        reportLoading={false}
        isPlayer1={true}
        isBotMatch={true}
        botMinAccuracyPct={WIN_ACCURACY_PCT}
        challengeLabel={challengeLabel}
      />
    )
  }

  const displayTimeLeft = () => {
    if (segment === 'main' && stepIndex === 0 && totalSteps > 0 && !answerSubmitted && mainTimeLeft > 0) {
      return `${Math.floor(mainTimeLeft / 60)}:${String(mainTimeLeft % 60).padStart(2, '0')}`
    }
    return `${timeLeft}s`
  }

  const isTimeLow = () => {
    if (segment === 'main' && stepIndex === 0 && totalSteps > 0 && !answerSubmitted && mainTimeLeft > 0) {
      return mainTimeLeft <= 10
    }
    if (segment === 'sub') return timeLeft <= 2
    return timeLeft <= 5
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
                {isCampaignMode ? topicLabel ?? runLabel : subject ?? 'Challenge'}
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
          onClick={() => navigate(returnRoute, { state: campaignSelection ?? undefined })}
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
            {challengeLabel}
          </span>
        </div>
      </header>

      {/* Main Arena */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-6 flex flex-col h-[calc(100vh-100px)]">

        {/* Match HUD (timer only — stats shown post-match) */}
        {phase === 'playing' && (
          <div className="flex flex-col items-center pb-2 mb-8">
            <div className="text-xs text-white/30 font-mono mb-2 uppercase tracking-widest text-center">
              ROUND {roundIndex + 1} OF {TOTAL_ROUNDS}
              {totalSteps > 1 && ` • STEP ${stepIndex + 1}/${totalSteps}${segment === 'sub' ? ` • SUB ${subStepIndex + 1}` : ''}`}
            </div>
            <div className={`text-5xl font-black font-mono tracking-tighter tabular-nums transition-colors duration-300 ${
              isTimeLow()
                ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]'
            }`}>
              {displayTimeLeft()}
            </div>
          </div>
        )}

        {/* Game Content */}
        <div className="flex-1 relative overflow-y-auto flex items-start justify-center pb-10">
          <AnimatePresence mode="wait">

            {/* PLAYING: Persistent main question + step content */}
            {phase === 'playing' && currentQuestion && currentStep && (
              <motion.div
                key={`playing-${roundIndex}`}
                initial={questionMotionInitial}
                animate={questionMotionAnimate}
                exit={questionMotionExit}
                transition={questionMotionTransition}
                className="match-paper w-full max-w-[96rem] mx-auto px-4 md:px-8 lg:px-12"
              >
                <div className="paper-card sticky top-3 z-10 mb-8">
                  <div className="paper-meta mb-4">
                    Main Question
                  </div>
                  {paperGraph && (
                    <div className="mb-6">
                      <QuestionGraph graph={paperGraph} />
                    </div>
                  )}
                  <h3 className="paper-title">
                    <ScienceText text={currentQuestion.stem || currentQuestion.title || ''} />
                  </h3>
                </div>

                {segment === 'main' && stepIndex === 0 && !answerSubmitted && mainTimeLeft > 0 ? (
                  <>
                    <div className="text-sm text-white/60 font-mono">
                      Wait for the timer to finish or submit early to begin the step questions.
                    </div>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={submitEarlyAnswer}
                        className="paper-option w-full text-center font-semibold"
                      >
                        Submit Answer Early
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="paper-card mb-8">
                    <div className="space-y-4 mb-6">
                      <div className="paper-meta">
                        {segment === 'sub'
                          ? `Step ${stepIndex + 1} • Sub-step ${subStepIndex + 1}`
                          : totalSteps > 1
                            ? `Step ${stepIndex + 1} of ${totalSteps}`
                            : `Step ${stepIndex + 1}`}
                      </div>
                      <h3 className="paper-title">
                        <ScienceText text={
                          segment === 'sub'
                            ? (currentSubStep?.prompt || '')
                            : (currentStep.prompt || currentStep.title || '')
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
                                <ScienceText text={normalizeInlineMathOption(String(option))} className="paper-option-text" smilesSize="sm" />
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
                )}
              </motion.div>
            )}

            {/* ROUND RESULT */}
            {phase === 'round-result' && (
              <motion.div
                key={`round-result-${roundIndex}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full max-w-2xl self-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
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
                    roundTotal > 0 && Math.floor((roundCorrect / roundTotal) * 100) >= WIN_ACCURACY_PCT
                      ? 'bg-green-500/20 border-green-500/40'
                      : 'bg-orange-500/20 border-orange-500/40'
                  }`}
                >
                  <div className="text-xs font-mono text-white/60 mb-2 uppercase tracking-wider">
                    ROUND ACCURACY
                  </div>
                  <div className={`text-5xl md:text-6xl font-black mb-2 ${
                    roundTotal > 0 && Math.floor((roundCorrect / roundTotal) * 100) >= WIN_ACCURACY_PCT
                      ? 'text-green-400'
                      : 'text-orange-400'
                  }`}>
                    {roundCorrect}/{roundTotal}
                  </div>
                  <div className="text-lg font-mono text-white/80">
                    {roundTotal > 0 ? Math.floor((roundCorrect / roundTotal) * 100) : 0}%
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
                    Need ≥{WIN_ACCURACY_PCT}% to win
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
                className="relative w-full max-w-3xl self-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-8 text-center shadow-[0_0_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-10"
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: [
                      'radial-gradient(900px 520px at 20% 18%, rgba(250,204,21,0.14) 0%, transparent 62%)',
                      overallAccuracyPct >= WIN_ACCURACY_PCT
                        ? 'radial-gradient(780px 480px at 82% 20%, rgba(34,197,94,0.14) 0%, transparent 60%)'
                        : 'radial-gradient(780px 480px at 82% 20%, rgba(244,63,94,0.16) 0%, transparent 60%)',
                      'radial-gradient(860px 620px at 50% 90%, rgba(56,189,248,0.10) 0%, transparent 64%)',
                    ].join(','),
                  }}
                />

                <div className="relative z-10">
                  <div className="mb-6">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] ${
                        overallAccuracyPct >= WIN_ACCURACY_PCT
                          ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                          : 'border-rose-300/20 bg-rose-400/10 text-rose-100'
                      }`}
                    >
                      {overallAccuracyPct >= WIN_ACCURACY_PCT ? (
                        <>
                          <Trophy className="h-4 w-4" />
                          Threshold Cleared
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          Below Threshold
                        </>
                      )}
                    </div>

                    <h2 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                      {`FINALIZING ${challengeLabel.toUpperCase()} RESULT`}
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/60">
                      {`Locking in your ${challengeLabel} performance and applying the rank update before the full results reveal.`}
                    </p>
                  </div>

                  <div className="grid gap-3 text-left sm:grid-cols-3">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Accuracy</div>
                      <div className="mt-2 text-3xl font-black text-white">{overallAccuracyPct}%</div>
                      <div className="mt-1 text-xs text-white/45">Final run percentage</div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Correct</div>
                      <div className="mt-2 text-3xl font-black text-white">{cumulativeCorrect}/{cumulativeTotal}</div>
                      <div className="mt-1 text-xs text-white/45">Answers converted</div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Threshold</div>
                      <div className="mt-2 text-3xl font-black text-amber-100">≥{WIN_ACCURACY_PCT}%</div>
                      <div className="mt-1 text-xs text-white/45">Challenge win line</div>
                    </div>
                  </div>

                  {!rankedError ? (
                    <div className="mt-8 flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                      <div className="text-sm font-mono uppercase tracking-[0.28em] text-white/60">
                        {isCampaignMode ? 'Computing campaign rank...' : 'Computing ranked results...'}
                      </div>
                      <div className="text-xs text-white/45">
                        The next screen will reveal your updated rank and rating movement.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-8">
                      <div className="text-sm font-mono text-red-300">
                        {`${challengeLabel} rank update failed. Apply the latest Supabase migration and try again.`}
                      </div>
                      <div className="mt-2 break-words text-xs font-mono text-white/40">
                        {rankedError}
                      </div>
                      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                        <button
                          type="button"
                          disabled={rankedLoading}
                          onClick={() => setRankedAttempt((prev) => prev + 1)}
                          className="px-6 py-3 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-200 font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(returnRoute, { state: campaignSelection ?? undefined })}
                          className="px-6 py-3 rounded-2xl bg-white/10 border border-white/20 text-foreground font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-white/20"
                        >
                          {isCampaignMode ? 'Return to Campaign' : 'Return to Dashboard'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
