import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Question, GameEvent } from '@/types/schema'

/**
 * Simple Battle Page
 *
 * Connects to game-ws-simple and displays questions
 */
export default function BattleSimple() {
  const { matchId } = useParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState<'connecting' | 'connected' | 'playing'>('connecting')
  const [question, setQuestion] = useState<Question | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!matchId) return

    const connectWebSocket = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          toast.error('Not authenticated')
          navigate('/')
          return
        }

        const wsUrl = `${import.meta.env.VITE_SUPABASE_URL?.replace('http', 'ws')}/functions/v1/game-ws-simple?token=${session.access_token}&match_id=${matchId}`

        console.log('[BATTLE] Connecting to WebSocket:', wsUrl)

        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('[BATTLE] WebSocket connected')
          setStatus('connected')
          toast.success('Connected to game')
        }

        ws.onmessage = (event) => {
          try {
            const message: GameEvent = JSON.parse(event.data)
            console.log('[BATTLE] Message received:', message.type)

            if (message.type === 'ROUND_START') {
              console.log('[BATTLE] Question received:', message.question)
              setQuestion(message.question)
              setStatus('playing')
            } else if (message.type === 'GAME_ERROR') {
              console.error('[BATTLE] Game error:', message.message)
              toast.error(message.message)
            }
          } catch (error) {
            console.error('[BATTLE] Error parsing message:', error)
          }
        }

        ws.onerror = (error) => {
          console.error('[BATTLE] WebSocket error:', error)
          toast.error('Connection error')
        }

        ws.onclose = () => {
          console.log('[BATTLE] WebSocket closed')
          setStatus('connecting')
        }

        wsRef.current = ws
      } catch (error: any) {
        console.error('[BATTLE] Connection error:', error)
        toast.error('Failed to connect')
      }
    }

    connectWebSocket()

    return () => {
      wsRef.current?.close()
    }
  }, [matchId, navigate])

  if (status === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Connecting to match...</h2>
        </div>
      </div>
    )
  }

  if (status === 'connected' && !question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Waiting for question...</h2>
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No question available</h2>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-white rounded"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // Parse steps from JSONB
  const steps = question.steps as { type: string; options: string[]; answer: number }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-6">{question.text}</h1>

          <div className="space-y-4">
            {steps.options.map((option, index) => (
              <button
                key={index}
                className="w-full text-left p-4 border border-border rounded-lg hover:bg-accent transition"
              >
                <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                {option}
              </button>
            ))}
          </div>

          <div className="mt-8 text-sm text-muted-foreground">
            <p>Question ID: {question.id}</p>
            <p>Match ID: {matchId}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
