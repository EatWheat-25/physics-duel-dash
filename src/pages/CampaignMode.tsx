import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Atom,
  Calculator,
  FlaskConical,
  Loader2,
  Swords,
  Target,
  Trophy,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { StudyPatternBackground } from '@/components/StudyPatternBackground'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import {
  CAMPAIGN_LEVEL_LABELS,
  CAMPAIGN_SUBJECT_LABELS,
  type CampaignLevel,
  type CampaignSelectionState,
  type CampaignTopicOption,
  getCampaignFallbackTopics,
  normalizeCampaignTopicValue,
} from '@/lib/campaignMode'
import { getRankByPoints, type Rank } from '@/types/ranking'
import type { QuestionSubject } from '@/types/questions'

type CampaignPrefillState = Partial<CampaignSelectionState>

const subjectCards: Array<{
  id: QuestionSubject
  title: string
  description: string
  accent: string
  glow: string
  icon: typeof Calculator
}> = [
  {
    id: 'physics',
    title: 'Physics',
    description: 'Mechanics, electricity, waves, and topic-specific ranked runs.',
    accent: 'from-violet-400/30 to-cyan-300/10',
    glow: 'rgba(168,85,247,0.32)',
    icon: Atom,
  },
  {
    id: 'chemistry',
    title: 'Chemistry',
    description: 'Organic, analytical, and reaction-based campaign practice with rank.',
    accent: 'from-emerald-400/30 to-cyan-300/10',
    glow: 'rgba(16,185,129,0.28)',
    icon: FlaskConical,
  },
  {
    id: 'math',
    title: 'Mathematics',
    description: 'Topic-locked runs for chapters like quadratics, vectors, and calculus.',
    accent: 'from-sky-400/30 to-indigo-300/10',
    glow: 'rgba(56,189,248,0.28)',
    icon: Calculator,
  },
]

const levelOptions: Array<{
  id: CampaignLevel
  title: string
  description: string
}> = [
  {
    id: 'A1',
    title: 'A1',
    description: 'AS-level campaign questions',
  },
  {
    id: 'A2',
    title: 'A2',
    description: 'A2-level campaign questions',
  },
]

const makeTopicKey = (option: Pick<CampaignTopicOption, 'kind' | 'value'>) => `${option.kind}:${option.value}`

function CompactRankIcon({ rank }: { rank: Rank }) {
  return (
    <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/25">
      {rank.imageUrl ? (
        <img
          src={rank.imageUrl}
          alt={rank.displayName}
          className="h-5 w-5 object-contain"
        />
      ) : (
        <span className="text-sm leading-none">{rank.emoji}</span>
      )}
    </div>
  )
}

export default function CampaignMode() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const prefill = ((location.state ?? {}) as CampaignPrefillState) || {}

  const prefilledSubject: QuestionSubject | null =
    prefill.subject === 'math' || prefill.subject === 'physics' || prefill.subject === 'chemistry'
      ? prefill.subject
      : null
  const prefilledLevel: CampaignLevel = prefill.level === 'A2' ? 'A2' : 'A1'
  const prefilledTopicKey =
    (prefill.topicKind === 'chapter' || prefill.topicKind === 'topicTag') &&
    typeof prefill.topicValue === 'string' &&
    prefill.topicValue.trim().length > 0
      ? makeTopicKey({ kind: prefill.topicKind, value: prefill.topicValue.trim() })
      : ''

  const [subject, setSubject] = useState<QuestionSubject | null>(prefilledSubject)
  const [level, setLevel] = useState<CampaignLevel>(prefilledLevel)
  const [topicOptions, setTopicOptions] = useState<CampaignTopicOption[]>([])
  const [selectedTopicKey, setSelectedTopicKey] = useState(prefilledTopicKey)
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [topicsError, setTopicsError] = useState<string | null>(null)
  const [topicRanksLoading, setTopicRanksLoading] = useState(false)
  const [topicRankMap, setTopicRankMap] = useState<Record<string, number>>({})

  const selectedTopic = useMemo(
    () => topicOptions.find((option) => makeTopicKey(option) === selectedTopicKey) ?? null,
    [selectedTopicKey, topicOptions]
  )
  const selectedTopicPoints =
    selectedTopic ? (topicRankMap[makeTopicKey(selectedTopic)] ?? 0) : 0
  const selectedTopicRank = getRankByPoints(selectedTopicPoints)

  useEffect(() => {
    document.title = 'Campaign | BattleNerds'
  }, [])

  useEffect(() => {
    if (!subject) {
      setTopicOptions([])
      setSelectedTopicKey('')
      setTopicsError(null)
      return
    }

    let cancelled = false
    setTopicsLoading(true)
    setTopicsError(null)

    ;(async () => {
      const { data, error } = await (supabase.rpc as any)('get_question_topics_v1', {
        p_subject: subject,
        p_level: level,
      }) as { data: Array<{ chapter: string; topic_tags: string[] }> | null; error: { message?: string } | null }

      if (cancelled) return

      if (error) {
        setTopicsError(error.message ?? 'Failed to load topic options')
        setTopicOptions(getCampaignFallbackTopics(subject, level))
        setTopicsLoading(false)
        return
      }

      const chapterSet = new Set<string>()
      const topicTagSet = new Set<string>()

      for (const row of data ?? []) {
        if (typeof row.chapter === 'string') {
          const chapter = normalizeCampaignTopicValue(row.chapter)
          if (chapter) chapterSet.add(chapter)
        }

        if (Array.isArray(row.topic_tags)) {
          for (const tag of row.topic_tags) {
            const topicTag = normalizeCampaignTopicValue(String(tag))
            if (topicTag) topicTagSet.add(topicTag)
          }
        }
      }

      let nextOptions: CampaignTopicOption[] = Array.from(chapterSet)
        .sort((a, b) => a.localeCompare(b))
        .map((chapter) => ({
          kind: 'chapter',
          value: chapter,
          label: chapter,
        }))

      if (!nextOptions.length) {
        nextOptions = Array.from(topicTagSet)
          .sort((a, b) => a.localeCompare(b))
          .map((topicTag) => ({
            kind: 'topicTag',
            value: topicTag,
            label: topicTag,
          }))
      }

      if (!nextOptions.length) {
        nextOptions = getCampaignFallbackTopics(subject, level)
      }

      setTopicOptions(nextOptions)
      setTopicsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [level, subject])

  useEffect(() => {
    if (!topicOptions.length) {
      setSelectedTopicKey('')
      return
    }

    if (selectedTopicKey && topicOptions.some((option) => makeTopicKey(option) === selectedTopicKey)) {
      return
    }

    const preferredOption =
      topicOptions.find((option) => makeTopicKey(option) === prefilledTopicKey) ??
      topicOptions[0]

    setSelectedTopicKey(makeTopicKey(preferredOption))
  }, [prefilledTopicKey, selectedTopicKey, topicOptions])

  useEffect(() => {
    if (!user || !subject) {
      setTopicRankMap({})
      setTopicRanksLoading(false)
      return
    }

    let cancelled = false
    setTopicRanksLoading(true)

    ;(async () => {
      const { data, error } = await supabase
        .from('campaign_rank_points')
        .select('topic_kind, topic_key, rank_points')
        .eq('subject', subject)
        .eq('level', level)
        .limit(1000)

      if (cancelled) return

      if (error) {
        setTopicRankMap({})
        setTopicRanksLoading(false)
        return
      }

      const nextRankMap: Record<string, number> = {}
      for (const row of data ?? []) {
        const key = `${row.topic_kind}:${row.topic_key}`
        nextRankMap[key] = row.rank_points ?? 0
      }

      setTopicRankMap(nextRankMap)
      setTopicRanksLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [level, subject, user?.id])

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  const handleStartCampaign = () => {
    if (!subject || !selectedTopic) return

    navigate('/campaign/play', {
      state: {
        mode: 'campaign',
        subject,
        level,
        topicKind: selectedTopic.kind,
        topicValue: selectedTopic.value,
        topicLabel: selectedTopic.label,
        topicRankPoints: selectedTopicPoints,
      } satisfies CampaignSelectionState,
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white font-sans">
      <StudyPatternBackground />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(900px 600px at 20% 15%, rgba(59,130,246,0.12) 0%, transparent 58%), radial-gradient(840px 520px at 80% 20%, rgba(16,185,129,0.12) 0%, transparent 58%), radial-gradient(920px 700px at 50% 100%, rgba(15,23,42,0.88) 20%, rgba(2,6,23,0.98) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-white/50">BattleNerds</div>
              <div className="text-2xl font-black tracking-tight">Campaign</div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            className="h-11 rounded-2xl border-white/15 bg-white/5 px-4 text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lobby
          </Button>
        </header>

        <main className="mt-8 grid flex-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/12 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100">
                <Trophy className="h-4 w-4" />
                Ranked By Topic
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                Build your campaign run
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                Pick a subject, lock in A1 or A2, then choose one topic to fight through. Each
                campaign run updates its own ladder instead of one shared global bucket.
              </p>
            </div>

            <div className="mt-8 space-y-8">
              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
                  1. Select subject
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {subjectCards.map((card) => {
                    const Icon = card.icon
                    const active = card.id === subject
                    return (
                      <motion.button
                        key={card.id}
                        type="button"
                        onClick={() => setSubject(card.id)}
                        className={`relative overflow-hidden rounded-[1.75rem] border p-5 text-left transition-all ${
                          active
                            ? 'border-white/30 bg-white/[0.09]'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                        }`}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        style={{ boxShadow: active ? `0 0 40px ${card.glow}` : undefined }}
                      >
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent}`} />
                        <div className="relative z-10">
                          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-black/20">
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="mt-4 text-xl font-bold">{card.title}</div>
                          <p className="mt-2 text-sm leading-6 text-white/65">{card.description}</p>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
                  2. Choose level
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {levelOptions.map((option) => {
                    const active = option.id === level
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLevel(option.id)}
                        className={`rounded-[1.5rem] border px-5 py-4 text-left transition-all ${
                          active
                            ? 'border-cyan-300/35 bg-cyan-400/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="text-lg font-bold text-white">{option.title}</div>
                        <div className="mt-1 text-sm text-white/60">{option.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
                    3. Pick one topic
                  </div>
                  {topicsLoading ? (
                    <div className="inline-flex items-center gap-2 text-xs text-white/55">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading live topics
                    </div>
                  ) : topicRanksLoading ? (
                    <div className="inline-flex items-center gap-2 text-xs text-white/55">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Syncing ranks
                    </div>
                  ) : null}
                </div>

                {!subject ? (
                  <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-black/20 p-5 text-sm text-white/55">
                    Choose a subject first and the topic list will appear here.
                  </div>
                ) : (
                  <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
                    {topicsError ? (
                      <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                        Live topics could not be loaded, so campaign is using the authoring catalog for this subject.
                      </div>
                    ) : null}

                    {topicOptions.length === 0 && !topicsLoading ? (
                      <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/55">
                        No topic options are available for this level yet.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {topicOptions.map((option) => {
                          const active = makeTopicKey(option) === selectedTopicKey
                          const points = topicRankMap[makeTopicKey(option)] ?? 0
                          const rank = getRankByPoints(points)
                          return (
                            <button
                              key={makeTopicKey(option)}
                              type="button"
                              onClick={() => setSelectedTopicKey(makeTopicKey(option))}
                              className={`rounded-[1.25rem] border px-4 py-4 text-left transition-all ${
                                active
                                  ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-50'
                                  : 'border-white/10 bg-white/[0.03] text-white/85 hover:border-white/20 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                                    <CompactRankIcon rank={rank} />
                                    <span>{rank.displayName}</span>
                                  </div>
                                  <div className="mt-2 text-sm font-semibold leading-6">{option.label}</div>
                                </div>
                                <div className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/80">
                                  {points} RP
                                </div>
                              </div>
                              <div className="mt-3 text-[11px] uppercase tracking-[0.24em] text-white/45">
                                {option.kind === 'chapter' ? 'Chapter ladder' : 'Topic ladder'}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/12 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:p-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
              Campaign summary
            </div>
            <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm text-white/55">Subject</div>
              <div className="mt-1 text-xl font-bold text-white">
                {subject ? CAMPAIGN_SUBJECT_LABELS[subject] : 'Select a subject'}
              </div>

              <div className="mt-5 text-sm text-white/55">Level</div>
              <div className="mt-1 text-xl font-bold text-white">{CAMPAIGN_LEVEL_LABELS[level]}</div>

              <div className="mt-5 text-sm text-white/55">Topic</div>
              <div className="mt-1 text-xl font-bold text-white">
                {selectedTopic?.label ?? 'Choose a topic'}
              </div>

              <div className="mt-5 text-sm text-white/55">Topic rank</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                {selectedTopic ? (
                  <>
                    <div className="flex items-center gap-3">
                      <CompactRankIcon rank={selectedTopicRank} />
                      <div className="text-xl font-bold text-white">{selectedTopicRank.displayName}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-semibold text-white/80">
                      {selectedTopicPoints} RP
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-white/55">Choose a topic to view its rank.</div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <Swords className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Topic-locked match pool</div>
                    <div className="text-sm text-white/55">Runs pull only from the chosen campaign topic.</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <Target className="h-5 w-5 text-emerald-200" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Dedicated campaign rank</div>
                    <div className="text-sm text-white/55">
                      Rank changes are tracked for this subject, level, and topic combination.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                    <Trophy className="h-5 w-5 text-amber-200" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Learning-focused RP</div>
                    <div className="text-sm text-white/55">
                      Campaign wins grant +50 RP and losses only cost -10 RP.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleStartCampaign}
              disabled={!subject || !selectedTopic || topicOptions.length === 0 || topicsLoading}
              className="mt-8 h-14 w-full rounded-2xl bg-amber-300 text-slate-950 hover:bg-amber-200 disabled:bg-white/10 disabled:text-white/40"
            >
              {topicsLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing campaign
                </>
              ) : (
                'Start Campaign'
              )}
            </Button>

            <p className="mt-4 text-sm leading-6 text-white/55">
              Need one focused ladder run? Choose a single topic like quadratics and jump straight
              in.
            </p>
          </aside>
        </main>
      </div>
    </div>
  )
}
