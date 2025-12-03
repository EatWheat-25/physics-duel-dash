import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMatchFlow } from '@/hooks/useMatchFlow';
import type { MatchRow } from '@/types/schema';

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
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

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
    startStepTimer,
    stopStepTimer,
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

  // Start timer when step becomes active
  useEffect(() => {
    if (currentQuestion && currentQuestion.steps && currentQuestion.steps.length > 0) {
      const step = currentQuestion.steps[currentStepIndex];
      if (step) {
        startStepTimer(step.index);
      }
    }
  }, [currentQuestion, currentStepIndex, startStepTimer]);

  // Handle answer selection
  const handleAnswerClick = (stepIndex: number, answerIndex: number) => {
    if (hasSubmitted) return;
    
    stopStepTimer(stepIndex);
    setAnswer(stepIndex, answerIndex);
    
    // Auto-advance to next step if available
    if (currentQuestion && currentStepIndex < currentQuestion.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  // Determine if current user is player1
  const isPlayer1 = match && currentUser ? match.player1_id === currentUser : false;
  const playerScore = isPlayer1 
    ? ((match as any)?.player1_score || 0)
    : ((match as any)?.player2_score || 0);
  const opponentScore = isPlayer1
    ? ((match as any)?.player2_score || 0)
    : ((match as any)?.player1_score || 0);

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

  // Render connecting state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Connecting to battle...</h2>
        </div>
      </div>
    );
  }

  // Render match finished state
  if (isMatchFinished) {
    const winnerId = (match as any)?.winner_id;
    const isWinner = winnerId === currentUser;
    const isDraw = !winnerId;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20">
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
                <span className="text-2xl font-bold text-primary">{playerScore}</span>
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

  // Render round result
  if (roundResult && currentRound) {
    const roundWon = roundResult.roundWinnerId === currentUser;
    const isDraw = !roundResult.roundWinnerId;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20">
          <div className="text-center space-y-6">
            {isDraw ? (
              <h2 className="text-3xl font-bold text-white">Round {currentRound.roundNumber}: Draw</h2>
            ) : roundWon ? (
              <h2 className="text-3xl font-bold text-green-500">Round {currentRound.roundNumber}: You Won! +{roundResult.player1RoundScore}</h2>
            ) : (
              <h2 className="text-3xl font-bold text-red-500">Round {currentRound.roundNumber}: Opponent Won +{roundResult.player2RoundScore}</h2>
            )}

            <div className="space-y-2">
              <p className="text-white">Your Score: {playerScore}</p>
              <p className="text-white">Opponent Score: {opponentScore}</p>
            </div>

            <p className="text-gray-400">Next round starting soon...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render active round with question
  if (currentQuestion && currentRound) {
    const currentStep = currentQuestion.steps[currentStepIndex];
    const selectedAnswer = playerAnswers.get(currentStep?.index || 0);
    const allStepsAnswered = currentQuestion.steps.every(step => playerAnswers.has(step.index));

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
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
            
            {/* Match Info */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white">Round {currentRound.roundNumber}</h1>
                <p className="text-gray-400">
                  Target: {(match as any)?.target_points || 5} points | 
                  Max Rounds: {(match as any)?.max_rounds || 9}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-400">You</p>
                  <p className="text-2xl font-bold text-primary">{playerScore}</p>
                </div>
                <Users className="w-6 h-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm text-gray-400">Opponent</p>
                  <p className="text-2xl font-bold text-white">{opponentScore}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20">
            {/* Question Stem */}
            {currentQuestion.stem && (
              <div className="mb-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-white text-lg">{currentQuestion.stem}</p>
              </div>
            )}

            {/* Step Info */}
            {currentQuestion.steps.length > 1 && (
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  Step {currentStepIndex + 1} of {currentQuestion.steps.length}
                </p>
                {currentStep && (
                  <p className="text-sm text-gray-400">{currentStep.marks} marks</p>
                )}
              </div>
            )}

            {/* Step Prompt */}
            {currentStep && (
              <>
                {currentStep.title && (
                  <h3 className="text-xl font-semibold text-white mb-4">{currentStep.title}</h3>
                )}
                <p className="text-lg text-white mb-6">{currentStep.prompt}</p>

                {/* Answer Options */}
                <div className="space-y-3 mb-6">
                  {currentStep.options.map((option, index) => {
                    const isSelected = selectedAnswer === index;
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerClick(currentStep.index, index)}
                        disabled={hasSubmitted}
                        className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'bg-primary/20 border-primary text-white'
                            : 'bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500'
                        } ${hasSubmitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                        {option}
                      </button>
                    );
                  })}
                </div>

                {/* Step Navigation */}
                {currentQuestion.steps.length > 1 && (
                  <div className="flex justify-between mb-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                      disabled={currentStepIndex === 0}
                    >
                      Previous Step
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStepIndex(Math.min(currentQuestion.steps.length - 1, currentStepIndex + 1))}
                      disabled={currentStepIndex === currentQuestion.steps.length - 1}
                    >
                      Next Step
                    </Button>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={submitRoundAnswer}
                    disabled={!allStepsAnswered || hasSubmitted}
                    size="lg"
                    className="min-w-[200px]"
                  >
                    {hasSubmitted ? 'Submitted' : allStepsAnswered ? 'Submit Answer' : 'Complete All Steps'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback - waiting for round
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <h2 className="text-2xl font-bold text-white">Waiting for round to start...</h2>
      </div>
    </div>
  );
}
