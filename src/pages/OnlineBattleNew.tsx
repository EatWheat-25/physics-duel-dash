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
  if (!match || !currentRound || !currentQuestion) {
    // Waiting for battle to start
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Waiting for battle to start…</h2>
        </div>
      </div>
    );
  }

  // Get the first step
  const firstStep = currentQuestion?.steps?.[0];

  if (!firstStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Loading question...</h2>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    submitRoundAnswer();
  };

  const selectedAnswer = playerAnswers.get(firstStep.step_index ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#14002e] to-[#3b0099] flex justify-center pt-10">
      <div className="w-full max-w-3xl bg-[#12002a]/80 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-center mb-4 text-sm opacity-80">
          <div>
            Round {currentRound.roundNumber} / {(match as any)?.max_rounds || 9}
          </div>
          <div>
            {(match as any)?.player1_score || 0} - {(match as any)?.player2_score || 0}
          </div>
        </div>

        <h1 className="text-2xl font-semibold mb-4">
          {currentQuestion.text || currentQuestion.stem || 'Question'}
        </h1>

        {firstStep.prompt && (
          <p className="text-lg text-purple-100 mb-6">{firstStep.prompt}</p>
        )}

        {firstStep && firstStep.options && (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {firstStep.options.map((opt: any) => {
              const isSelected = selectedAnswer === opt.answer_index;
              return (
                <button
                  key={opt.answer_index}
                  onClick={() => setAnswer(firstStep.step_index, opt.answer_index)}
                  disabled={hasSubmitted}
                  className={`rounded-2xl border border-purple-400/40 bg-purple-900/40 px-4 py-3 text-left text-sm text-purple-50 hover:bg-purple-700/50 transition-all ${
                    isSelected ? 'ring-2 ring-purple-400 bg-purple-700/60' : ''
                  } ${hasSubmitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={hasSubmitted || selectedAnswer === undefined}
          className="mt-6 w-full px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/40 disabled:cursor-not-allowed transition-colors"
        >
          {hasSubmitted ? 'Submitted' : 'Submit answer'}
        </button>

        {roundResult && (
          <div className="mt-4 text-sm p-4 bg-black/30 rounded-xl">
            <div>Round winner: {roundResult.roundWinnerId ?? 'Draw'}</div>
            <div>
              Round score: {roundResult.player1RoundScore} - {roundResult.player2RoundScore}
            </div>
          </div>
        )}

        {isMatchFinished && (
          <div className="mt-6 p-4 bg-black/30 rounded-xl text-sm">
            <div>Match finished.</div>
            <div>
              Winner: {(match as any)?.winner_id ? (match as any).winner_id : 'Draw'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
