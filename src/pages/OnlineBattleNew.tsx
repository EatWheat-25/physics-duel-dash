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
    submitRoundAnswer,
    // Step-by-step state
    currentStepIndex,
    stepTimeLeft,
    hasAnsweredCurrentStep,
    submitStepAnswer,
    // Thinking phase state
    isThinkingPhase,
    thinkingTimeLeft
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

  // Tug-of-war progress bar component
  const TugOfWarBar = ({ playerScore, opponentScore, targetPoints }: { 
    playerScore: number; 
    opponentScore: number; 
    targetPoints: number 
  }) => {
    const playerPercentage = (playerScore / targetPoints) * 100
    const opponentPercentage = (opponentScore / targetPoints) * 100
    const isPlayerWinning = playerScore > opponentScore
    const isDraw = playerScore === opponentScore
    
    // Clamp percentages to 0-100
    const clampedPlayer = Math.min(100, Math.max(0, playerPercentage))
    const clampedOpponent = Math.min(100, Math.max(0, opponentPercentage))
    
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-blue-400">You: {playerScore}</span>
          <span className="text-xs text-slate-400">Target: {targetPoints}</span>
          <span className="text-sm font-semibold text-white">Opponent: {opponentScore}</span>
        </div>
        <div className="relative h-6 bg-slate-700 rounded-full overflow-hidden border-2 border-slate-600">
          {/* Player side (left, blue) */}
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${clampedPlayer}%` }}
          />
          {/* Center divider */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/50 transform -translate-x-1/2 z-10" />
          {/* Opponent side (right, grey/red) */}
          <div 
            className="absolute right-0 top-0 h-full bg-gradient-to-l from-slate-500 to-slate-600 transition-all duration-500 ease-out"
            style={{ width: `${clampedOpponent}%` }}
          />
          {/* Winning indicator */}
          {isPlayerWinning && clampedPlayer >= 50 && (
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-blue-400 transform -translate-x-1/2 z-20 animate-pulse" />
          )}
          {!isPlayerWinning && !isDraw && clampedOpponent >= 50 && (
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-red-400 transform -translate-x-1/2 z-20 animate-pulse" />
          )}
        </div>
        {/* Score difference indicator */}
        <div className="text-center mt-1">
          {isDraw ? (
            <span className="text-xs text-slate-400">Tied</span>
          ) : isPlayerWinning ? (
            <span className="text-xs text-blue-400">+{playerScore - opponentScore} ahead</span>
          ) : (
            <span className="text-xs text-red-400">-{opponentScore - playerScore} behind</span>
          )}
        </div>
      </div>
    )
  }

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

  // 4. Round result banner (show as banner, not full screen) with auto-hide
  const [showRoundResultBanner, setShowRoundResultBanner] = useState(false);
  
  useEffect(() => {
    if (roundResult && currentRound && !isMatchFinished) {
      setShowRoundResultBanner(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowRoundResultBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowRoundResultBanner(false);
    }
  }, [roundResult, currentRound, isMatchFinished]);

  const roundResultBanner = showRoundResultBanner && roundResult && currentRound && !isMatchFinished ? (() => {
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
    // Check if in thinking phase
    const isInThinkingPhase = isThinkingPhase || currentStepIndex === -1
    
    // Check if all steps are done
    const allStepsDone = !isInThinkingPhase && currentStepIndex >= (currentQuestion.steps?.length || 0)
    
    // Get current step
    const currentStep = !isInThinkingPhase && !allStepsDone && currentQuestion.steps?.[currentStepIndex] 
      ? currentQuestion.steps[currentStepIndex]
      : null

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white px-4 py-8">
        {/* Top: Match info + scores */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm text-slate-400">Round {currentRound.roundNumber} / {(match as any)?.max_rounds || 3}</p>
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

          {/* Tug-of-war progress bar */}
          <TugOfWarBar 
            playerScore={playerScore} 
            opponentScore={opponentScore} 
            targetPoints={(match as any)?.target_points || 5} 
          />

          {/* Round result banner */}
          {roundResultBanner}
        </div>

        {/* Main question stem - ALWAYS VISIBLE, directly on background */}
        <div className="max-w-4xl mx-auto mb-8">
          <h1 className="text-3xl font-bold text-white text-center">
            {currentQuestion.stem || currentQuestion.text || 'Question'}
          </h1>
        </div>

        {/* Step content - directly on background */}
        <div className="max-w-4xl mx-auto">
          {isInThinkingPhase ? (
            // Thinking phase - only show timer
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
              <div className={`px-8 py-4 rounded-full font-bold text-4xl ${
                (thinkingTimeLeft || 0) <= 10 
                  ? 'bg-red-500/20 text-red-400 border-4 border-red-400' 
                  : 'bg-blue-500/20 text-blue-400 border-4 border-blue-400'
              }`}>
                {thinkingTimeLeft || 0}s
              </div>
              <h2 className="text-2xl font-semibold text-white">Read the question carefully...</h2>
              <p className="text-slate-300 text-center max-w-md">
                Think about your approach. The steps will appear once the timer runs out.
              </p>
            </div>
          ) : allStepsDone ? (
            // All steps done - waiting for opponent
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
              <Loader2 className="w-16 h-16 animate-spin text-blue-400" />
              <h2 className="text-3xl font-bold text-white">Waiting for opponent...</h2>
              <p className="text-slate-300">You've completed all steps. Waiting for your opponent to finish.</p>
            </div>
          ) : currentStep ? (
            // Current step with options
            <div>
              {/* Step header with timer */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">
                    {currentStep.title || `Step ${currentStepIndex + 1}`}
                  </h2>
                  {stepTimeLeft !== null && (
                    <div className={`px-4 py-2 rounded-full font-bold text-lg ${
                      stepTimeLeft <= 5 
                        ? 'bg-red-500/20 text-red-400 border-2 border-red-400' 
                        : 'bg-blue-500/20 text-blue-400 border-2 border-blue-400'
                    }`}>
                      {stepTimeLeft}s
                    </div>
                  )}
                </div>
                <p className="text-lg text-slate-200">{currentStep.prompt}</p>
              </div>

              {/* Step options */}
              {currentStep.options && Array.isArray(currentStep.options) && currentStep.options.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {currentStep.options.map((optText: string, optIndex: number) => {
                    if (!optText || optText.trim() === '') {
                      return null
                    }
                    
                    const isSelected = playerAnswers.get(currentStep.index) === optIndex
                    return (
                      <button
                        key={optIndex}
                        onClick={() => submitStepAnswer(currentStep.index, optIndex)}
                        disabled={hasAnsweredCurrentStep}
                        className={`rounded-lg border-2 px-4 py-3 text-left text-sm transition-all ${
                          isSelected
                            ? 'border-blue-400 bg-blue-500/20 text-white'
                            : 'border-slate-600 bg-slate-700/50 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
                        } ${hasAnsweredCurrentStep ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {optText}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
                  <p className="text-red-400 text-sm">No options available for this step.</p>
                </div>
              )}

              {/* Step progress indicator */}
              <div className="text-center text-sm text-slate-400">
                Step {currentStepIndex + 1} of {currentQuestion.steps.length}
              </div>
            </div>
          ) : (
            // No step available
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
            </div>
          )}
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
