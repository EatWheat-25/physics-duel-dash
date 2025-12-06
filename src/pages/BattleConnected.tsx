import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';

/**
 * Minimal Battle Connection UI
 * 
 * Shows:
 * - Match ID
 * - Connection status for both players
 * - "Both players connected!" when ready
 */
export default function BattleConnected() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Try to use match from navigation state first
  useEffect(() => {
    const stateMatch = location.state?.match as MatchRow | undefined;
    if (stateMatch && stateMatch.id === matchId) {
      console.log('[BattleConnected] ✅ Using match from navigation state:', stateMatch.id);
      setMatch(stateMatch);
      return;
    }
  }, [location.state, matchId]);

  // Fetch match from database if not in state
  useEffect(() => {
    if (match) return; // Already have match from state

    if (!matchId) {
      toast.error('No match ID provided');
      navigate('/matchmaking-new');
      return;
    }

    const fetchMatch = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('[BattleConnected] User not authenticated:', userError);
        toast.error('Please log in to view match');
        navigate('/matchmaking-new');
        return;
      }

      setCurrentUser(user.id);
      console.log('[BattleConnected] Fetching match from DB:', matchId);

      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (error || !data) {
        toast.error('Match not found');
        navigate('/matchmaking-new');
        return;
      }

      // Verify user is part of match
      if (data.player1_id !== user.id && data.player2_id !== user.id) {
        toast.error('You are not part of this match');
        navigate('/matchmaking-new');
        return;
      }

      console.log('[BattleConnected] ✅ Match loaded:', data.id);
      setMatch(data as MatchRow);
    };

    fetchMatch();
  }, [matchId, navigate, match]);

  // Get current user if not set
  useEffect(() => {
    if (!currentUser) {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user.id);
        }
      };
      getUser();
    }
  }, [currentUser]);

  // Use game hook for connection
  const { status, playerRole, errorMessage, question } = useGame(match);
  
  // Local state for answer selection (no network calls)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Render loading state
  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Loading match...</h2>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-xl">⚠️ Error</div>
          <p className="text-white">{errorMessage || 'Unknown error'}</p>
          <Button
            onClick={() => navigate('/matchmaking-new')}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isPlayer1 = match.player1_id === currentUser;
  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

  // UI Guard: Check if question has valid steps[0]
  if (question && (!question.steps || question.steps.length === 0 || !question.steps[0])) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-yellow-400 text-xl">⚠️ No True/False questions found.</div>
          <p className="text-slate-300">Add one in admin panel.</p>
          <Button
            onClick={() => navigate('/matchmaking-new')}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Render question if received
  if (question && question.steps && question.steps.length > 0 && question.steps[0]) {
    const firstStep = question.steps[0];
    const options = firstStep.options || [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/matchmaking-new')}
              className="text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-white">Battle Question</h1>
            <p className="text-gray-400">Match ID: {match.id}</p>
          </div>

          {/* Question Card */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20">
            <div className="space-y-6">
              {/* Question Stem */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">{question.stem || question.title}</h2>
              </div>

              {/* True/False Options (step[0] only) */}
              {options.length === 2 ? (
                <div className="space-y-3">
                  {options.map((option: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setSelectedAnswer(index)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedAnswer === index
                          ? 'border-blue-400 bg-blue-500/20 text-white'
                          : 'border-slate-600 bg-slate-700/50 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 bg-yellow-500/20 border border-yellow-500 rounded-lg">
                  <p className="text-yellow-400">Question must have exactly 2 options (True/False)</p>
                </div>
              )}

              {/* Selection Status */}
              {selectedAnswer !== null && (
                <div className="text-center text-sm text-slate-300">
                  Selected: {options[selectedAnswer]}
                </div>
              )}

              {/* Note */}
              <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-700">
                Answer stored locally. Submission coming in Stage 2.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: Connection status (no question yet)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/matchmaking-new')}
            className="text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-white">Battle Connection</h1>
          <p className="text-gray-400">Match ID: {match.id}</p>
        </div>

        {/* Connection Status Card */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20">
          <div className="space-y-6">
            {/* Status Header */}
            <div className="text-center">
              {status === 'connecting' && (
                <>
                  <Loader2 className="w-16 h-16 animate-spin text-blue-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Connecting...</h2>
                  <p className="text-slate-300">Establishing connection to game server</p>
                </>
              )}
              {status === 'connected' && (
                <>
                  <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">You're Connected!</h2>
                  <p className="text-slate-300">Waiting for opponent to connect...</p>
                </>
              )}
              {status === 'both_connected' && (
                <>
                  <Users className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Both Players Connected!</h2>
                  <p className="text-slate-300">Ready to start (game logic coming soon)</p>
                </>
              )}
            </div>

            {/* Player Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    status !== 'connecting' ? 'bg-green-400' : 'bg-yellow-400'
                  }`} />
                  <span className="font-semibold">You ({playerRole || 'connecting...'})</span>
                </div>
                {status !== 'connecting' && (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    status === 'both_connected' ? 'bg-green-400' : 'bg-gray-400'
                  }`} />
                  <span className="font-semibold">Opponent</span>
                </div>
                {status === 'both_connected' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                )}
              </div>
            </div>

            {/* Match Info */}
            <div className="pt-4 border-t border-slate-700">
              <div className="text-sm text-slate-400 space-y-1">
                <p>Match ID: <span className="text-white font-mono">{match.id}</span></p>
                <p>Your Role: <span className="text-white">{playerRole || 'connecting...'}</span></p>
                <p>Status: <span className="text-white capitalize">{status.replace('_', ' ')}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

