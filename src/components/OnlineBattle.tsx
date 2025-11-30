import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useGame } from '@/hooks/useGame'
import type { MatchRow } from '@/types/schema'

/**
 * Simplified OnlineBattle component
 * 
 * Uses the new clean pipeline:
 * 1. Fetch match from URL param
 * 2. Use useGame hook to connect and get question
 * 3. Display question or loading/error state
 */
export const OnlineBattle = () => {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState<MatchRow | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  // Fetch match from database
  useEffect(() => {
    if (!matchId) {
      toast.error('No match ID provided')
      navigate('/')
      return
    }

    const fetchMatch = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle()

      if (error) {
        console.error('[Battle] Error fetching match:', error)
        toast.error('Failed to load match')
        navigate('/')
        return
      }

      if (!data) {
        console.error('[Battle] Match not found:', matchId)
        toast.error('Match not found')
        navigate('/')
        return
      }

      // Verify structure
      if (!data.player1_id || !data.player2_id) {
        console.error('[Battle] Match has wrong structure')
        toast.error('Invalid match structure')
        navigate('/')
        return
      }

      setMatch(data as MatchRow)
    }

    fetchMatch()
  }, [matchId, navigate])

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user.id)
      }
    }
    getUser()
  }, [])

  // Use the new useGame hook
  const { question, gameStatus, errorMessage } = useGame(match)

  // Verify user is part of match
  useEffect(() => {
    if (match && currentUser) {
      if (match.player1_id !== currentUser && match.player2_id !== currentUser) {
        toast.error('You are not part of this match')
        navigate('/')
      }
    }
  }, [match, currentUser, navigate])

  // Render based on state
  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Loading match...</h2>
        </div>
      </div>
    )
  }

  if (gameStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-xl">⚠️ Error</div>
          <p className="text-white">{errorMessage || 'Unknown error'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (gameStatus === 'connecting' || gameStatus === 'waiting_for_round') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">
            {gameStatus === 'connecting' ? 'Connecting to battle...' : 'Waiting for question...'}
          </h2>
        </div>
      </div>
    )
  }

  if (gameStatus === 'round_active' && question) {
    // Simple question display
    const steps = question.steps
    const options = steps?.options || []
    const correctAnswer = steps?.answer ?? 0

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20">
            <h1 className="text-3xl font-bold text-white mb-6">Battle Question</h1>
            
            <div className="mb-8">
              <p className="text-xl text-white mb-6">{question.text}</p>
            </div>

            {steps?.type === 'mcq' && options.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Select your answer:</h3>
                <div className="grid gap-4">
                  {options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // TODO: Implement answer submission
                        toast.info(`Selected: ${option} (Answer ${index})`)
                      }}
                      className="p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-left text-white transition-colors"
                    >
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 text-sm text-slate-400">
              <p>Question ID: {question.id}</p>
              <p>Match ID: {match.id}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <h2 className="text-2xl font-bold text-white">Loading...</h2>
      </div>
    </div>
  )
}
