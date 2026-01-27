import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import PostMatchResults from '@/components/PostMatchResults'
import { Button } from '@/components/ui/button'
import { getRankByPoints } from '@/types/ranking'

type RankedPayload = {
  winner_id: string | null
  p1: {
    player_id: string
    outcome: 'win' | 'loss' | 'draw'
    old_points: number
    new_points: number
    delta: number
    accuracy_pct: number
    correct_parts: number
    total_parts: number
  }
  p2: RankedPayload['p1']
}

type QuestionReportRow = {
  round_index: number
  question_id: string
  title: string
  stem: string
  p1_correct_parts: number
  p1_total_parts: number
  p2_correct_parts: number
  p2_total_parts: number
}

export default function MatchResults() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [retryCounter, setRetryCounter] = useState(0)
  const [rankedPayload, setRankedPayload] = useState<RankedPayload | null>(null)
  const [questionReport, setQuestionReport] = useState<QuestionReportRow[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [matchMeta, setMatchMeta] = useState<{
    player1_id: string
    player2_id: string
    player1_score: number | null
    player2_score: number | null
    winner_id: string | null
  } | null>(null)
  const finishRequestedRef = useRef(false)

  const handleRetry = () => {
    finishRequestedRef.current = false
    setTimedOut(false)
    setLoading(true)
    setRetryCounter((prev) => prev + 1)
  }

  useEffect(() => {
    if (!matchId || !user) return
    let cancelled = false
    finishRequestedRef.current = false
    setLoading(true)
    setTimedOut(false)

    const fetchOnce = async (): Promise<{ done: boolean; needsFinish: boolean }> => {
      const { data, error } = await (supabase as any)
        .from('matches')
        .select('player1_id, player2_id, player1_score, player2_score, winner_id, ranked_payload, status, ranked_applied_at')
        .eq('id', matchId)
        .single()

      if (cancelled) return { done: true, needsFinish: false }
      if (error || !data) {
        setLoading(false)
        setTimedOut(true)
        return { done: true, needsFinish: false }
      }

      setMatchMeta({
        player1_id: data.player1_id,
        player2_id: data.player2_id,
        player1_score: data.player1_score,
        player2_score: data.player2_score,
        winner_id: data.winner_id,
      })

      if (data.ranked_payload) {
        setRankedPayload(data.ranked_payload as any)
        setLoading(false)
        return { done: true, needsFinish: false }
      }

      const needsFinish = data.status === 'finished' && !data.ranked_applied_at
      return { done: false, needsFinish }
    }

    const requestFinishMatch = async () => {
      if (finishRequestedRef.current || !matchId) return
      finishRequestedRef.current = true
      const { error } = await supabase.rpc('finish_match', { p_match_id: matchId })
      if (error) {
        console.warn('[MatchResults] finish_match RPC failed:', error)
      }
    }

    const MAX_ATTEMPTS = 120
    const POLL_DELAY_MS = 250

    // Poll until ranked_payload is present (finish_match runs server-side)
    const run = async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const { done, needsFinish } = await fetchOnce()
        if (cancelled) return
        if (done) return
        if (needsFinish) {
          await requestFinishMatch()
        }
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS))
      }
      setLoading(false)
      setTimedOut(true)
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, user?.id, retryCounter])

  useEffect(() => {
    if (!matchId || !user || !rankedPayload) return
    let cancelled = false
    setReportLoading(true)
    ;(async () => {
      const { data, error } = await supabase.rpc('get_match_question_report_v1', {
        p_match_id: matchId,
      })
      if (cancelled) return
      if (error) {
        console.warn('[MatchResults] question report RPC failed:', error)
        setQuestionReport([])
      } else {
        setQuestionReport((data as QuestionReportRow[]) || [])
      }
      setReportLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [matchId, user?.id, rankedPayload])

  const mySide = useMemo(() => {
    if (!user || !matchMeta || !rankedPayload) return null
    if (rankedPayload.p1.player_id === user.id) return rankedPayload.p1
    if (rankedPayload.p2.player_id === user.id) return rankedPayload.p2
    // Fallback by matchMeta
    if (matchMeta.player1_id === user.id) return rankedPayload.p1
    if (matchMeta.player2_id === user.id) return rankedPayload.p2
    return null
  }, [user, matchMeta, rankedPayload])

  const oppSide = useMemo(() => {
    if (!user || !rankedPayload || !mySide) return null
    return rankedPayload.p1.player_id === mySide.player_id ? rankedPayload.p2 : rankedPayload.p1
  }, [user, rankedPayload, mySide])

  if (!user) return null

  if (loading || !rankedPayload || !mySide || !oppSide) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <div className="text-white/70 font-mono text-sm">Loading match results…</div>
        {timedOut && (
          <>
            <div className="text-white/50 text-xs">Rank data is taking longer than expected.</div>
            <Button variant="secondary" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </>
        )}
      </div>
    )
  }

  const myPoints = mySide.new_points
  const myRank = getRankByPoints(myPoints)

  const matchStats = {
    totalQuestions: mySide.total_parts,
    correctAnswers: mySide.correct_parts,
    wrongAnswers: Math.max(0, mySide.total_parts - mySide.correct_parts),
    playerScore: matchMeta?.player1_id === user.id ? (matchMeta?.player1_score ?? 0) : (matchMeta?.player2_score ?? 0),
    opponentScore: matchMeta?.player1_id === user.id ? (matchMeta?.player2_score ?? 0) : (matchMeta?.player1_score ?? 0),
    pointsEarned: mySide.delta,
    won: mySide.outcome === 'win',
    outcome: mySide.outcome,
  }

  const userData = {
    username: profile?.username ?? user.email?.split('@')[0] ?? 'Player',
    currentPoints: myPoints,
    currentRank: { tier: myRank.tier, subRank: myRank.subRank },
    winStreak: 0,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    accuracy: mySide.accuracy_pct,
    history: [],
    avatar: undefined,
  }

  const isPlayer1 = matchMeta?.player1_id === user.id

  return (
    <PostMatchResults
      matchStats={matchStats}
      userData={userData as any}
      onContinue={() => navigate('/matchmaking-new')}
      onPlayAgain={() => navigate('/matchmaking-new')}
      questionReport={questionReport}
      reportLoading={reportLoading}
      isPlayer1={isPlayer1 ?? false}
    />
  )
}

