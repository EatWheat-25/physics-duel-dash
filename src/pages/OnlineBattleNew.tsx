import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMatchFlow } from '@/hooks/useMatchFlow';

/**
 * OnlineBattleNew - Stage 2.5 Runtime Flow
 * 
 * Uses useMatchFlow hook to manage full match lifecycle:
 * - Match start and round progression
 * - Answer submission
 * - Round evaluation and match completion
 */
export default function OnlineBattleNew() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Use match flow hook
  const {
    match,
    currentRound,
    currentQuestion,
    roundResult,
    isMatchFinished,
    playerAnswers,
    isConnected,
    hasSubmitted,
    setAnswer,
    submitRoundAnswer
  } = useMatchFlow(matchId || null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user.id);
      }
    };
    getUser();
  }, []);

  // Verify user is part of match
  useEffect(() => {
    if (match && currentUser) {
      if (match.player1_id !== currentUser && match.player2_id !== currentUser) {
        toast.error('You are not part of this match');
        navigate('/matchmaking-new');
      }
    }
  }, [match, currentUser, navigate]);


  // Determine if current user is player1
  const isPlayer1 = match && currentUser ? match.player1_id === currentUser : false;
  const playerScore = isPlayer1 
    ? ((match as any)?.player1_score || 0)
    : ((match as any)?.player2_score || 0);
  const opponentScore = isPlayer1
    ? ((match as any)?.player2_score || 0)
    : ((match as any)?.player1_score || 0);

  // State priority order (explicit, non-overlapping):
  // 1. Loading/connecting states
  // 2. Match finished
  // 3. Round result (banner)
  // 4. Waiting for opponent
  // 5. Active round with question
  // 6. Default waiting state

  // 1. Loading state
  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Loading match...</h2>
        </div>
      </div>
    );
  }

  // 2. Connecting state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Connecting to battle...</h2>
        </div>
      </div>
    );
  }

  // 3. Match finished state
  if (isMatchFinished) {
    const winnerId = (match as any)?.winner_id;
    const isWinner = winnerId === currentUser;
    const isDraw = !winnerId;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-slate-800/90 backdrop-blur-lg rounded-xl p-8 border-2 border-slate-600">
          <div className="text-center space-y-6">
            {isDraw ? (
              <>
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
                <h1 className="text-4xl font-bold text-white">Draw!</h1>
              </>
            ) : isWinner ? (
              <>
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
                <h1 className="text-4xl font-bold text-white">You Won! 🎉</h1>
              </>
            ) : (
              <>
                <Trophy className="w-16 h-16 text-gray-500 mx-auto" />
                <h1 className="text-4xl font-bold text-white">You Lost</h1>
              </>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-700/50 rounded-lg">
                <span className="text-white font-semibold">Your Score:</span>
                <span className="text-2xl font-bold text-blue-400">{playerScore}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-700/50 rounded-lg">
                <span className="text-white font-semibold">Opponent Score:</span>
                <span className="text-2xl font-bold text-white">{opponentScore}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-700/50 rounded-lg">
                <span className="text-white font-semibold">Total Rounds:</span>
                <span className="text-2xl font-bold text-white">{(match as any)?.current_round_number || 0}</span>
              </div>
            </div>

            <Button
              onClick={() => navigate('/matchmaking-new')}
              className="mt-6"
              size="lg"
            >
              Back to Lobby
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Round result banner (show as banner, not full screen)
  const roundResultBanner = roundResult && currentRound && !isMatchFinished ? (() => {
    const roundWon = roundResult.roundWinnerId === currentUser;
    const isDraw = !roundResult.roundWinnerId;
    
    let bannerText = '';
    if (isDraw) {
      bannerText = 'Round Draw';
    } else if (roundWon) {
      bannerText = `You won this round! +${roundResult.player1RoundScore}`;
    } else {
      bannerText = `Opponent won this round +${roundResult.player2RoundScore}`;
    }
    
    return (
      <div className="mb-4 p-4 bg-blue-500/20 border-2 border-blue-400 rounded-lg text-center">
        <p className="text-lg font-bold text-white">{bannerText}</p>
        <p className="text-sm text-slate-300 mt-1">Next round starting soon...</p>
      </div>
    );
  })() : null;

  // 5. Waiting for opponent state
  if (hasSubmitted && !roundResult && currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-slate-800/90 backdrop-blur-lg rounded-xl p-8 border-2 border-slate-600 text-center space-y-6">
          <Loader2 className="w-16 h-16 animate-spin text-blue-400 mx-auto" />
          <h2 className="text-3xl font-bold text-white">Waiting for opponent...</h2>
          <p className="text-slate-300">Your answer has been submitted. Waiting for your opponent to answer.</p>
        </div>
      </div>
    );
  }

  // 6. Active round with question
  if (currentQuestion && currentRound) {
    const firstStep = currentQuestion.steps && currentQuestion.steps.length > 0 
      ? currentQuestion.steps[0] 
      : null;
    
    if (!firstStep) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Loading question...</h2>
          </div>
        </div>
      );
    }

    // Debug logging
    console.log('[OnlineBattleNew] firstStep:', firstStep);
    console.log('[OnlineBattleNew] firstStep.options:', firstStep.options);
    console.log('[OnlineBattleNew] options type:', typeof firstStep.options);
    console.log('[OnlineBattleNew] is array:', Array.isArray(firstStep.options));
    console.log('[OnlineBattleNew] options length:', firstStep.options?.length);

    const selectedAnswer = playerAnswers.get(firstStep.index ?? 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex justify-center pt-10 pb-10 px-4">
        <div className="w-full max-w-3xl bg-slate-800/90 backdrop-blur-lg rounded-xl p-6 border-2 border-slate-600 text-white">
          {/* Top: Match info + scores */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-600">
            <div>
              <p className="text-sm text-slate-400">Round {currentRound.roundNumber} / {(match as any)?.max_rounds || 9}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400">You</p>
                <p className="text-2xl font-bold text-blue-400">{playerScore}</p>
              </div>
              <Users className="w-5 h-5 text-slate-400" />
              <div className="text-center">
                <p className="text-xs text-slate-400">Opponent</p>
                <p className="text-2xl font-bold text-white">{opponentScore}</p>
              </div>
            </div>
          </div>

          {/* Round result banner */}
          {roundResultBanner}

          {/* Middle: Question + step prompt */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-4 text-white">
              {currentQuestion.stem || currentQuestion.text || 'Question'}
            </h1>
            {firstStep.prompt && (
              <p className="text-lg text-slate-200 mb-4">{firstStep.prompt}</p>
            )}
          </div>

          {/* Below: 2x2 grid of options */}
          {firstStep.options && Array.isArray(firstStep.options) && firstStep.options.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {firstStep.options.map((optText: string, optIndex: number) => {
                // Skip empty options
                if (!optText || optText.trim() === '') {
                  return null;
                }
                
                const isSelected = selectedAnswer === optIndex;
                return (
                  <button
                    key={optIndex}
                    onClick={() => setAnswer(firstStep.index, optIndex)}
                    disabled={hasSubmitted}
                    className={`rounded-lg border-2 px-4 py-3 text-left text-sm transition-all ${
                      isSelected
                        ? 'border-blue-400 bg-blue-500/20 text-white'
                        : 'border-slate-600 bg-slate-700/50 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
                    } ${hasSubmitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {optText}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm font-semibold mb-2">⚠️ No options available</p>
              <p className="text-red-300 text-xs mb-2">Debug info:</p>
              <pre className="text-xs text-red-200 overflow-auto max-h-40">
                {JSON.stringify({
                  hasOptions: !!firstStep.options,
                  isArray: Array.isArray(firstStep.options),
                  optionsLength: firstStep.options?.length,
                  options: firstStep.options,
                  firstStep: firstStep
                }, null, 2)}
              </pre>
            </div>
          )}

          {/* Bottom: Submit button + match info */}
          <div className="space-y-3">
            <button
              onClick={submitRoundAnswer}
              disabled={hasSubmitted || selectedAnswer === undefined}
              className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {hasSubmitted ? 'Submitted' : 'Submit answer'}
            </button>
            <p className="text-xs text-center text-slate-400">
              Target points: {(match as any)?.target_points || 5} | Max rounds: {(match as any)?.max_rounds || 9}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 7. Default: Waiting for battle to start
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">Waiting for battle to start…</h2>
      </div>
    </div>
  );
}
