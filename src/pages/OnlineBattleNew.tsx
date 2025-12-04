import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMatchFlow } from '@/hooks/useMatchFlow';
import { CircularTimer } from '@/components/CircularTimer';
import { GameLoader } from '@/components/GameLoader';
import { RoundTransition } from '@/components/RoundTransition';
import '@/styles/match-battle.css';

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
    thinkingTimeLeft,
    skipThinkingPhase,
    // Round transition state
    isShowingRoundTransition
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
    const totalScore = playerScore + opponentScore
    const playerPercentage = totalScore > 0 ? (playerScore / totalScore) * 100 : 50
    const isPlayerWinning = playerScore > opponentScore
    const isDraw = playerScore === opponentScore
    
    // Clamp percentage to 0-100
    const clampedPlayer = Math.min(100, Math.max(0, playerPercentage))
    
    return (
      <div className="tug-of-war mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: '#06b6d4' }}>You: {playerScore}</span>
          <span className="text-xs text-slate-400">Target: {targetPoints}</span>
          <span className="text-sm font-semibold text-white">Opponent: {opponentScore}</span>
        </div>
        <div className="tug-bar">
          <div 
            className="tug-progress"
            style={{ width: `${clampedPlayer}%` }}
          />
        </div>
        {/* Score difference indicator */}
        <div className="text-center mt-1">
          {isDraw ? (
            <span className="text-xs text-slate-400">Tied</span>
          ) : isPlayerWinning ? (
            <span className="text-xs" style={{ color: '#06b6d4' }}>+{playerScore - opponentScore} ahead</span>
          ) : (
            <span className="text-xs" style={{ color: '#ec4899' }}>-{opponentScore - playerScore} behind</span>
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
          <GameLoader text="loading match" />
        </div>
      </div>
    );
  }

  // 2. Connecting state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <GameLoader text="connecting" />
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

  // 4. Round transition overlay (priority - shows before active round)
  if (roundResult && isShowingRoundTransition && match && currentUser) {
    const totalPossiblePoints = 
      currentQuestion?.steps?.reduce((sum, step) => sum + (step.marks ?? 1), 0) ?? 4

    return (
      <RoundTransition
        roundResult={roundResult}
        currentUserId={currentUser}
        player1Id={match.player1_id}
        player2Id={match.player2_id}
        totalPossiblePoints={totalPossiblePoints}
      />
    )
  }

  // 5. Round result banner (show as banner, not full screen - only when not in transition)
  const roundResultBanner = roundResult && currentRound && !isMatchFinished && !isShowingRoundTransition ? (() => {
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
      <div className="round-result mb-4">
        <div className="result-icon">🎉</div>
        <div className={`result-text ${roundWon ? 'win' : isDraw ? '' : 'lose'}`}>{bannerText}</div>
        <p className="text-sm text-slate-300 mt-1">Next round starting soon...</p>
      </div>
    );
  })() : null;

  // 6. Waiting for opponent state
  if (hasSubmitted && !roundResult && currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-slate-800/90 backdrop-blur-lg rounded-xl p-8 border-2 border-slate-600 text-center space-y-6">
          <div className="flex justify-center">
            <GameLoader text="waiting" />
          </div>
          <h2 className="text-3xl font-bold text-white">Waiting for opponent...</h2>
          <p className="text-slate-300">Your answer has been submitted. Waiting for your opponent to answer.</p>
        </div>
      </div>
    );
  }

  // 7. Active round with question
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white px-4 py-8" style={{ background: 'linear-gradient(125deg, #0a0e27 0%, #0f1535 25%, #141b3d 50%, #1a2350 75%, #0d1229 100%)' }}>
        <div className="max-w-4xl mx-auto">
          {/* Match Header */}
          <div className="match-header mb-6">
            <div className="round-info">
              <span className="round-badge">⚔️ ROUND {currentRound.roundNumber} / {(match as any)?.max_rounds || 3}</span>
            </div>
            <div className="match-timer">
              <span>⏱️</span>
              <span>{isInThinkingPhase ? 'THINKING' : allStepsDone ? 'WAITING' : 'ANSWERING'}</span>
            </div>
          </div>

          {/* Players Section */}
          <div className="players-section mb-6">
            <div className="player-card you">
              <div className="player-avatar">👤</div>
              <div className="player-info">
                <h3>You</h3>
                <div className="player-score">{playerScore}</div>
              </div>
            </div>
            <div className="vs-badge">VS</div>
            <div className="player-card opponent">
              <div className="player-avatar">🤖</div>
              <div className="player-info">
                <h3>Opponent</h3>
                <div className="player-score">{opponentScore}</div>
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

          {/* Question Card */}
          <div className="question-section">
            <div className="question-card">
              <div className="question-header">
                <span className="question-number">Question <span>{currentRound.roundNumber}</span></span>
                {!isInThinkingPhase && !allStepsDone && stepTimeLeft !== null && (
                  <CircularTimer timeLeft={stepTimeLeft} totalTime={15} />
                )}
                {isInThinkingPhase && thinkingTimeLeft !== null && (
                  <CircularTimer timeLeft={thinkingTimeLeft} totalTime={60} />
                )}
              </div>

              {/* Step Indicator */}
              {!isInThinkingPhase && currentQuestion.steps && currentQuestion.steps.length > 0 && (
                <div className="step-indicator">
                  {currentQuestion.steps.map((_, index) => (
                    <div
                      key={index}
                      className={`step-dot ${
                        index < currentStepIndex ? 'completed' : 
                        index === currentStepIndex ? 'active' : ''
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Question Content */}
              <div className="question-content">
                <div className="question-stem">
                  {currentQuestion.stem || currentQuestion.text || 'Question'}
                </div>

                {isInThinkingPhase ? (
                  // Thinking phase
                  <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6">
                    <h2 className="text-2xl font-semibold text-white">Read the question carefully...</h2>
                    <p className="text-slate-300 text-center max-w-md">
                      Think about your approach. The steps will appear once the timer runs out.
                    </p>
                    <button
                      onClick={skipThinkingPhase}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      Start Answering Early
                    </button>
                  </div>
                ) : allStepsDone ? (
                  // All steps done - waiting for opponent
                  <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6">
                    <div className="flex justify-center">
                      <GameLoader text="waiting" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">Waiting for opponent...</h2>
                    <p className="text-slate-300">You've completed all steps. Waiting for your opponent to finish.</p>
                  </div>
                ) : currentStep ? (
                  // Current step with options
                  <>
                    <div className="step-prompt">
                      {currentStep.prompt}
                    </div>

                    {/* Answer Options */}
                    {currentStep.options && Array.isArray(currentStep.options) && currentStep.options.length > 0 ? (
                      <div className="answer-options">
                        {currentStep.options.map((optText: string, optIndex: number) => {
                          if (!optText || optText.trim() === '') {
                            return null
                          }
                          
                          const roundLocked = !!roundResult || isMatchFinished || isShowingRoundTransition
                          const isSelected = playerAnswers.get(currentStep.index) === optIndex
                          return (
                            <button
                              key={optIndex}
                              onClick={() => {
                                if (!roundLocked) submitStepAnswer(currentStep.index, optIndex)
                              }}
                              disabled={hasAnsweredCurrentStep || roundLocked}
                              className={`answer-option ${isSelected ? 'selected' : ''} ${hasAnsweredCurrentStep || roundLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    <div className="text-center text-sm text-slate-400 mt-4">
                      Step {currentStepIndex + 1} of {currentQuestion.steps.length}
                    </div>
                  </>
                ) : (
                  // No step available
                  <div className="flex items-center justify-center min-h-[300px]">
                    <GameLoader text="loading" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 8. Default: Waiting for battle to start
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-4">
        <GameLoader text="starting" />
        <h2 className="text-2xl font-bold text-white">Waiting for battle to start…</h2>
      </div>
    </div>
  );
}
