import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import PostMatchResults from '@/components/PostMatchResults'
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

export default function MatchResults() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rankedPayload, setRankedPayload] = useState<RankedPayload | null>(null)
  const [matchMeta, setMatchMeta] = useState<{
    player1_id: string
    player2_id: string
    player1_score: number | null
    player2_score: number | null
    winner_id: string | null
  } | null>(null)

  useEffect(() => {
    if (!matchId || !user) return
    let cancelled = false

    const fetchOnce = async (): Promise<boolean> => {
      const { data, error } = await (supabase as any)
        .from('matches')
        .select('player1_id, player2_id, player1_score, player2_score, winner_id, results_payload')
        .eq('id', matchId)
        .single()

      if (cancelled) return
      if (error || !data) {
        setLoading(false)
        return true
      }

      setMatchMeta({
        player1_id: data.player1_id,
        player2_id: data.player2_id,
        player1_score: data.player1_score,
        player2_score: data.player2_score,
        winner_id: data.winner_id,
      })

      if (data.results_payload) {
        setRankedPayload(data.results_payload as any)
        setLoading(false)
        return true
      }

      return false
    }

    // Poll briefly until ranked_payload is present (finish_match runs server-side)
    const run = async () => {
      for (let i = 0; i < 20; i++) {
        const done = await fetchOnce()
        if (cancelled) return
        if (done) return
        // small delay
        await new Promise((r) => setTimeout(r, 250))
      }
      setLoading(false)
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, user?.id])

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
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-white/70 font-mono text-sm">Loading match results…</div>
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
  }

  const userData = {
    username: profile?.username ?? user.email?.split('@')[0] ?? 'Player',
    currentPoints: myPoints,
    currentRank: { tier: myRank.tier, subRank: 1 as const },
    winStreak: 0,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    accuracy: mySide.accuracy_pct,
    history: [],
    avatar: undefined,
  }

  return (
    <PostMatchResults
      matchStats={matchStats}
      userData={userData as any}
      onContinue={() => navigate('/matchmaking-new')}
      onPlayAgain={() => navigate('/matchmaking-new')}
    />
  )
}

