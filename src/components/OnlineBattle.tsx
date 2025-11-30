import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// New Components
import { GameLayout } from './game/GameLayout';
import { GameHeader } from './game/GameHeader';
import { ActiveQuestion } from './game/ActiveQuestion';
import { PhaseOverlay } from './game/PhaseOverlay';

// State Management & Logic
import { battleReducer, initialBattleState, BattleState } from '@/lib/battleReducer';
import { connectGameWS, sendAnswer, ServerMessage } from '@/lib/ws';
import { wsPayloadToQuestion } from '@/lib/question-contract';

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  status: string;
  created_at: string;
}

export const OnlineBattle = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();

  // -- Core State (Reducer) --
  const [state, dispatch] = useReducer(battleReducer, initialBattleState);

  // -- External Data (not in reducer) --
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [yourUsername, setYourUsername] = useState<string>('You');
  const [opponentUsername, setOpponentUsername] = useState<string>('Opponent');
  const [yourAvatar, setYourAvatar] = useState<string>();
  const [opponentAvatar, setOpponentAvatar] = useState<string>();

  const wsRef = useRef<WebSocket | null>(null);

  // -- Helpers --
  const isPlayer1 = currentUser === match?.player1_id;

  // -- WebSocket Message Handler --
  const handleWSMessage = useCallback((message: ServerMessage) => {
    console.log('[Battle] Processing WS message:', message.type, message);

    switch (message.type) {
      case 'connected':
        dispatch({ type: 'WS_CONNECTED' });
        break;


      case 'ROUND_START':
        try {
          console.log('[CONTRACT] ROUND_START - Raw payload:', message.question);

          // Use fail-fast mapper - throws descriptive errors if contract violated
          const mappedQuestion = wsPayloadToQuestion(message.question);

          console.log('[CONTRACT] ✅ Mapped to StepBasedQuestion:', {
            id: mappedQuestion.id,
            title: mappedQuestion.title,
            stepsCount: mappedQuestion.steps.length
          });

          dispatch({
            type: 'ROUND_START',
            payload: {
              roundId: message.roundId,
              roundIndex: message.roundIndex,
              question: mappedQuestion,
              thinkingEndsAt: new Date(message.thinkingEndsAt),
            },
          });
        } catch (e: any) {
          console.error('[CONTRACT VIOLATION] Failed to map question:', e.message);
          console.error('[CONTRACT VIOLATION] Raw payload was:', message.question);
          toast.error(`Question failed contract: ${e.message}`);
        }
        break;

      case 'PHASE_CHANGE':
        console.log('[Battle] PHASE_CHANGE received:', message);
        console.log('[Battle] Options in payload:', message.options);
        dispatch({
          type: 'PHASE_CHANGE',
          payload: {
            phase: message.phase,
            choosingEndsAt: message.choosingEndsAt ? new Date(message.choosingEndsAt) : undefined,
            currentStepIndex: message.currentStepIndex,
          },
        });
        break;

      case 'ROUND_RESULT':
        console.log('[Battle] ROUND_RESULT:', message);
        dispatch({
          type: 'ROUND_RESULT',
          payload: {
            roundIndex: message.roundIndex,
            questionId: message.questionId,
            correctOptionId: message.correctOptionId,
            playerResults: message.playerResults,
            tugOfWar: message.tugOfWar,
            p1Score: message.p1Score,
            p2Score: message.p2Score,
          },
        });

        // Show result feedback
        const myResult = message.playerResults.find((r) => r.playerId === currentUser);
        if (myResult?.isCorrect) {
          toast.success('Correct!');
        } else {
          toast.error('Incorrect');
        }
        break;

      case 'answer_result':
        // Individual step result (if needed for immediate feedback)
        console.log('[Battle] answer_result:', message);
        break;

      case 'MATCH_END':
        console.log('[Battle] MATCH_END:', message);
        dispatch({
          type: 'MATCH_END',
          payload: {
            winnerId: message.winnerPlayerId,
          },
        });

        const won = message.winnerPlayerId === currentUser;
        const draw = !message.winnerPlayerId;
        toast.success(draw ? 'Match ended in a draw!' : won ? 'You won!' : 'Match over');
        break;

      case 'validation_error':
        console.error('[Battle] Validation error:', message.message);
        toast.error(message.message);
        dispatch({ type: 'VALIDATION_ERROR' });
        break;

      case 'error':
        console.error('[Battle] Server error:', message.message);
        toast.error(`Error: ${message.message}`);
        break;

      default:
        console.warn('[Battle] Unknown message type:', (message as any).type);
    }
  }, [currentUser, isPlayer1]);

  // -- Answer Handler --
  const handleAnswer = useCallback((index: number) => {
    console.log('[Battle] handleAnswer called with index:', index);
    console.log('[Battle] Current state:', {
      wsConnected: !!wsRef.current,
      roundId: state.roundId,
      isSubmitting: state.isSubmitting,
      phase: state.phase,
      roundPhase: state.roundPhase
    });

    if (!wsRef.current) {
      console.warn('[Battle] Cannot submit - wsRef is null');
      toast.error('Connection error: WebSocket missing');
      return;
    }

    if (!state.roundId) {
      console.warn('[Battle] Cannot submit - roundId is missing');
      toast.error('System error: Round ID missing');
      return;
    }

    if (state.isSubmitting) {
      console.warn('[Battle] Cannot submit - already submitting');
      toast.warning('Already submitting answer...');
      return;
    }

    const currentQ = state.currentQuestion;
    const currentStep = currentQ?.steps[state.currentStepIndex];

    if (!currentQ || !currentStep) {
      console.error('[Battle] No question/step available for answer');
      return;
    }

    console.log('[Battle] ✅ Submitting answer:', {
      matchId,
      roundId: state.roundId,
      questionId: currentQ.id,
      stepId: currentStep.id,
      answerIndex: index,
    });

    // Optimistic update
    dispatch({ type: 'ANSWER_SUBMITTED', payload: { answerIndex: index } });

    // Send to server
    sendAnswer(wsRef.current, matchId!, state.roundId, currentQ.id, currentStep.id, index);
  }, [matchId, state.roundId, state.currentQuestion, state.currentStepIndex, state.isSubmitting]);

  // -- Effects --

  // 1. Auth & User Info
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.error('[Battle] Auth error:', error);
        toast.error('Authentication error');
        return;
      }
      console.log('[Battle] Current user:', data.user?.id);
      setCurrentUser(data.user?.id || null);
    });
  }, []);

  // 2. Fetch Match & Profiles
  useEffect(() => {
    if (!matchId) return;

    const fetchMatch = async () => {
      console.log('[Battle] Fetching match:', matchId);
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (error) {
        console.error('[Battle] Error fetching match:', error);
        toast.error(`Failed to load match: ${error.message}`);
        return;
      }

      if (data) {
        console.log('[Battle] Match loaded:', data);
        setMatch(data as Match);
      } else {
        console.error('[Battle] Match not found:', matchId);
        toast.error('Match not found');
      }
    };

    fetchMatch();
  }, [matchId]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !match) return;

      // Your Profile
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (myProfile) {
        setYourUsername(myProfile.username);
      }

      // Opponent Profile
      const opponentId = match.player1_id === user.id ? match.player2_id : match.player1_id;
      const { data: oppProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', opponentId)
        .single();

      if (oppProfile) {
        setOpponentUsername(oppProfile.username);
      }
    };

    fetchProfiles();
  }, [match]);

  // 3. WebSocket Connection
  useEffect(() => {
    if (!matchId || !currentUser || !match) return;

    const setupWebSocket = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      console.log('[Battle] Setting up WebSocket for match:', matchId);

      const ws = connectGameWS({
        matchId,
        token: session.access_token,
        onConnected: () => handleWSMessage({ type: 'connected', player: 'p1' }),
        onPlayerReady: (e) => handleWSMessage(e),
        onRoundStart: (e) => handleWSMessage(e),
        onPhaseChange: (e) => handleWSMessage(e),
        onRoundResult: (e) => handleWSMessage(e),
        onAnswerResult: (e) => handleWSMessage(e),
        onMatchEnd: (e) => handleWSMessage(e),
        onValidationError: (e) => handleWSMessage(e),
        onError: (err) => toast.error(`Connection Error: ${err.message}`),
        onClose: () => toast.error('Connection Lost'),
      });

      wsRef.current = ws;
    };

    setupWebSocket();

    return () => {
      wsRef.current?.close();
    };
  }, [matchId, currentUser, match, handleWSMessage]);

  // Timer update - force re-render to update countdown
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    if (state.phase !== 'in_question' || !state.phaseDeadline) return;

    const interval = setInterval(() => {
      setTimerTick(t => t + 1); // Force re-render
    }, 100);

    return () => clearInterval(interval);
  }, [state.phase, state.phaseDeadline]);

  // -- Render Based on Phase --

  // Loading State
  if (!match || !currentUser || state.phase === 'connecting') {
    return (
      <GameLayout className="items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Connecting to Battle...</h2>
        </div>
      </GameLayout>
    );
  }

  // Waiting for Opponent
  if (state.phase === 'waiting_for_opponent') {
    return (
      <GameLayout className="items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Waiting for match to start...</h2>
        </div>
      </GameLayout>
    );
  }

  // Match Over
  if (state.phase === 'match_over') {
    const won = state.winnerId === currentUser;
    const draw = !state.winnerId;

    return (
      <GameLayout className="items-center justify-center">
        <PhaseOverlay
          isVisible={true}
          type={draw ? 'draw' : won ? 'victory' : 'defeat'}
          title={draw ? 'DRAW' : won ? 'VICTORY!' : 'DEFEAT'}
          subtitle={draw ? 'Well Played!' : won ? 'You Won!' : 'Better Luck Next Time'}
        />
        <div className="mt-8">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            Back to Home
          </button>
        </div>
      </GameLayout>
    );
  }

  // In-Question Phase
  const currentQ = state.currentQuestion;
  const currentStep = currentQ?.steps[state.currentStepIndex];
  const myScore = isPlayer1 ? state.p1Score : state.p2Score;
  const oppScore = isPlayer1 ? state.p2Score : state.p1Score;

  return (
    <GameLayout>
      <GameHeader
        player={{ username: yourUsername, avatarUrl: yourAvatar }}
        opponent={{ username: opponentUsername, avatarUrl: opponentAvatar }}
        currentRound={state.currentRound}
        totalRounds={state.totalRounds}
        tugPosition={state.tugOfWarPosition}
        maxSteps={10}
        onBack={() => navigate('/')}
      />

      <div className="flex-1 flex items-center justify-center py-8">
        {currentQ && currentStep ? (
          <ActiveQuestion
            question={{
              id: currentQ.id,
              text: currentStep.prompt,
              options: currentStep.options,
              imageUrl: currentQ.imageUrl,
            }}
            phase={state.roundPhase || 'thinking'}
            timeLeft={
              Math.max(0, state.phaseDeadline ? state.phaseDeadline.getTime() - Date.now() : 0)
            }
            totalTime={state.roundPhase === 'thinking' ? 60000 : 15000}
            selectedIndex={state.selectedAnswer}
            correctIndex={state.roundPhase === 'result' ? state.correctAnswer : null}
            onAnswer={handleAnswer}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            Waiting for next round...
          </div>
        )}
      </div>

      {/* Show result overlay */}
      {state.phase === 'showing_result' && state.lastResult && (
        <PhaseOverlay
          isVisible={true}
          type="round_start"
          title={`Round ${state.lastResult.roundIndex} Complete`}
          subtitle={`Score: ${myScore} - ${oppScore}`}
        />
      )}
    </GameLayout>
  );
};
