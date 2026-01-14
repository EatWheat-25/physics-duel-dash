import { useMatchmakingSimple } from '@/hooks/useMatchmakingSimple'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { playMatchStartSound } from '@/utils/matchSounds'

/**
 * Simple Matchmaking Test Page
 *
 * Click "Start" to join queue and find a match
 */
export default function MatchmakingTest() {
  const { status, startMatchmaking, leaveQueue } = useMatchmakingSimple()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Simple 1v1 Matchmaking</h1>
          <p className="text-muted-foreground">Clean, minimal implementation</p>
        </div>

        <div className="p-8 border border-border rounded-lg bg-card min-w-[400px]">
          {status === 'idle' && (
            <div className="space-y-4">
              <p className="text-lg">Ready to find an opponent?</p>
              <Button
                onClick={() => {
                  playMatchStartSound()
                  startMatchmaking()
                }}
                size="lg"
                className="w-full"
              >
                Start Matchmaking
              </Button>
            </div>
          )}

          {status === 'queuing' && (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-lg font-bold">Finding opponent...</p>
              <Button
                onClick={leaveQueue}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          )}

          {status === 'matched' && (
            <div className="space-y-4">
              <p className="text-lg font-bold text-green-500">Match Found!</p>
              <p className="text-sm text-muted-foreground">Navigating to battle...</p>
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Status: {status}</p>
        </div>
      </div>
    </div>
  )
}
