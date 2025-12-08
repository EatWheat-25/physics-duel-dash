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

  // Use game hook for connection - MUST be declared before useEffect that uses its values
  const { 
    status, 
    playerRole, 
    errorMessage, 
    question, 
    answerSubmitted, 
    waitingForOpponent, 
    results,
    submitAnswer 
  } = useGame(match);

  // Polling fallback: Check match state every 2 seconds to catch missed WS messages
  useEffect(() => {
    if (!match || !matchId || status !== 'playing' || !question) {
      return;
    }

    let localResultsReceived = false;

    const pollInterval = setInterval(async () => {
      try {
        const { data: matchData, error } = await supabase
          .from('matches')
          .select('player1_answer, player2_answer, results_computed_at, correct_answer, player1_correct, player2_correct, round_winner')
          .eq('id', matchId)
          .single();

        // If columns don't exist (migration not applied), skip polling
        if (error) {
          if (error.code === 'PGRST116' || error.message?.includes('column') || error.message?.includes('does not exist')) {
            console.warn('[BattleConnected] Stage 2 columns not found - migrations may not be applied. Skipping polling.');
            return;
          }
          // Other errors - log but don't spam
          return;
        }

        if (matchData?.results_computed_at && !localResultsReceived) {
          localResultsReceived = true;
          console.log('[BattleConnected] Polling detected results - manually triggering display');
          // Results will be displayed via RESULTS_RECEIVED message handler
          // This is just a fallback in case the message was missed
        }
      } catch (err) {
        // Silently handle errors in polling
        console.warn('[BattleConnected] Polling error (non-critical):', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [match, matchId, status, question]);

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
                  <p className="text-slate-300">Starting game...</p>
                </>
              )}
              {status === 'playing' && question && (() => {
                const firstStep = question.steps?.[0];
                const nonEmptyOptions = (firstStep?.options ?? []).filter((o: string) => String(o).trim() !== '');
                
                return (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">Question Ready!</h2>
                    <div className="mt-4 p-4 bg-slate-700/50 rounded-lg text-left">
                      <h3 className="text-xl font-semibold mb-2">{question.title}</h3>
                      <p className="text-slate-300 mb-4">{question.stem || question.questionText}</p>

                      {/* UI Guard: Check for valid True/False structure */}
                      {!question.steps || question.steps.length === 0 || !firstStep ? (
                        <div className="text-red-500 p-4 border border-red-500 rounded">
                          <p>No True/False questions found. Add one in admin panel.</p>
                          <p className="text-sm">Question has no steps or step[0] is missing.</p>
                        </div>
                      ) : nonEmptyOptions.length !== 2 ? (
                        <div className="text-red-500 p-4 border border-red-500 rounded">
                          <p>No True/False questions found. Add one in admin panel.</p>
                          <p className="text-sm">Step[0] has {nonEmptyOptions.length} options (need exactly 2).</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {nonEmptyOptions.map((option: string, index: number) => (
                            <Button
                              key={index}
                              className="w-full justify-start"
                              variant="outline"
                              disabled={answerSubmitted}
                              onClick={() => submitAnswer(index)}
                            >
                              {String.fromCharCode(65 + index)}. {option}
                            </Button>
                          ))}
                          {answerSubmitted && (
                            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded text-center">
                              <p className="text-blue-300">
                                {waitingForOpponent 
                                  ? 'Waiting for opponent to answer...' 
                                  : 'Answer submitted!'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              {status === 'results' && results && (
                <>
                  <h2 className="text-2xl font-bold text-white mb-4">Round Results</h2>
                  <div className="mt-4 p-4 bg-slate-700/50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Correct Answer:</span>
                      <span className="text-white font-semibold">
                        {results.correct_answer === 0 ? 'A. True' : 'B. False'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Your Answer:</span>
                      <span className={`font-semibold ${
                        (playerRole === 'player1' && results.player1_correct) ||
                        (playerRole === 'player2' && results.player2_correct)
                          ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {(playerRole === 'player1' ? results.player1_answer : results.player2_answer) === 0 ? 'A. True' : 'B. False'}
                        {(playerRole === 'player1' && results.player1_correct) ||
                         (playerRole === 'player2' && results.player2_correct)
                          ? ' ✓' : ' ✗'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Opponent's Answer:</span>
                      <span className={`font-semibold ${
                        (playerRole === 'player1' && results.player2_correct) ||
                        (playerRole === 'player2' && results.player1_correct)
                          ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {(playerRole === 'player1' ? results.player2_answer : results.player1_answer) === 0 ? 'A. True' : 'B. False'}
                        {(playerRole === 'player1' && results.player2_correct) ||
                         (playerRole === 'player2' && results.player1_correct)
                          ? ' ✓' : ' ✗'}
                      </span>
                    </div>
                    {results.round_winner && (
                      <div className="mt-4 p-3 bg-purple-500/20 border border-purple-500/50 rounded text-center">
                        <p className="text-purple-300 font-semibold">
                          {results.round_winner === currentUser 
                            ? '🎉 You won this round!' 
                            : 'Opponent won this round'}
                        </p>
                      </div>
                    )}
                    {!results.round_winner && (
                      <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded text-center">
                        <p className="text-yellow-300 font-semibold">Draw - Both players answered correctly</p>
                      </div>
                    )}
                  </div>
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
                    status === 'both_connected' || status === 'playing' ? 'bg-green-400' : 'bg-gray-400'
                  }`} />
                  <span className="font-semibold">Opponent</span>
                </div>
                {status === 'both_connected' || status === 'playing' ? (
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

