import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Starfield } from './Starfield';
import TugOfWarBar from './TugOfWarBar';
import { connectGameWS, sendReady, sendAnswer, type ServerEvent } from '@/lib/ws';
import type { RoundStartEvent, RoundResultEvent, MatchEndEvent } from '@/types/gameEvents';
import { toast } from 'sonner';
import { StepBasedQuestion } from '@/types/questions';
import { mapRawQuestionToStepBasedQuestion, RawQuestion } from '@/utils/questionMapper';
import { BattleQuestionView } from './BattleQuestionView';

interface Match {
  id: string;
  p1: string;
  p2: string;
  subject: string;
  chapter: string;
  state: string;
  p1_score: number;
  p2_score: number;
  winner_id?: string;
}

export const OnlineBattle = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Battle State
  const [question, setQuestion] = useState<StepBasedQuestion | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [stepTimeLeft, setStepTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roundResult, setRoundResult] = useState<RoundResultEvent | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);

  // Connection State
  const [connectionState, setConnectionState] = useState<'connecting' | 'waiting_ready' | 'playing' | 'ended'>('connecting');
  const [yourUsername, setYourUsername] = useState<string>('You');
  const [opponentUsername, setOpponentUsername] = useState<string>('Opponent');

  const wsRef = useRef<WebSocket | null>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Auth & Match Init
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!matchId) return;
    const fetchMatch = async () => {
      const { data, error } = await supabase
        .from('matches_new')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (error) {
        toast.error('Failed to load match');
        return;
      }
      if (data) setMatch(data as Match);
    };
    fetchMatch();
  }, [matchId]);

  // 2. WebSocket Connection & Event Handling
  useEffect(() => {
    if (!matchId || !currentUser || !match) return;

    const setupWebSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const ws = connectGameWS({
        matchId,
        token: session.access_token,
        onConnected: () => {
          setConnectionState('playing');
          sendReady(ws);
          toast.success('Connected to battle server');
        },
        onRoundStart: (event: RoundStartEvent) => {
          console.log('[OnlineBattle] ROUND_START', event);

          // IMPORTANT: Map raw question using our mapper to fix step order
          const mappedQuestion = mapRawQuestionToStepBasedQuestion(event.question as unknown as RawQuestion);

          setQuestion(mappedQuestion);
          setRoundResult(null);
          setIsLoadingQuestion(false);
          setIsSubmitting(false);

          // Reset local step state
          setCurrentStepIndex(0);
          setSelectedOptionIndex(null);
        },
        onRoundResult: (event: RoundResultEvent) => {
          console.log('[OnlineBattle] ROUND_RESULT', event);
          setRoundResult(event);
          setIsSubmitting(false);

          // Update scores
          setMatch(prev => prev ? {
            ...prev,
            p1_score: event.p1Score,
            p2_score: event.p2Score,
          } : null);
        },
        onMatchEnd: (event: MatchEndEvent) => {
          console.log('[OnlineBattle] MATCH_END', event);
          setConnectionState('ended');
          setMatch(prev => prev ? {
            ...prev,
            state: 'ended',
            winner_id: event.winnerPlayerId || undefined,
            p1_score: event.summary.finalScores.p1,
            p2_score: event.summary.finalScores.p2,
          } : null);
        },
        onError: (error) => {
          console.error('WS Error:', error);
          toast.error('Connection error');
        }
      });

      wsRef.current = ws;
    };

    setupWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [matchId, currentUser, match]);

  // 3. Step State Management (The "Reset" Logic)
  useEffect(() => {
    if (!question) return;

    // Reset selection when step or question changes
    setSelectedOptionIndex(null);

    // Reset timer for current step
    const currentStep = question.steps[currentStepIndex];
    if (currentStep) {
      setStepTimeLeft(currentStep.timeLimitSeconds || 15);
    }
  }, [question?.id, currentStepIndex]);

  // 4. Timer Logic
  useEffect(() => {
    if (stepTimeLeft === null || stepTimeLeft <= 0 || roundResult) return;

    stepTimerRef.current = setInterval(() => {
      setStepTimeLeft(prev => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [stepTimeLeft, roundResult]);

  // Auto-advance on timeout
  useEffect(() => {
    if (stepTimeLeft === 0 && !isSubmitting && !roundResult && question) {
      handleStepSubmit(true); // Auto-submit as timeout
    }
  }, [stepTimeLeft]);

  // 5. Interaction Handlers
  const handleStepSubmit = (isTimeout = false) => {
    if (!question || isSubmitting) return;

    const isFinalStep = currentStepIndex === question.steps.length - 1;

    if (!isFinalStep) {
      // Local progression
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Final step: Send to backend
      if (!wsRef.current) return;

      setIsSubmitting(true);

      // If timeout, we might want to send -1 or similar, but for now sending null/selected
      // The backend expects an index. If nothing selected, maybe send -1 (if backend handles it) 
      // or just 0 (wrong answer). Let's assume -1 is safe or just don't send if timeout?
      // Actually, let's send the selectedOptionIndex if it exists, otherwise -1.
      const answerToSend = selectedOptionIndex !== null ? selectedOptionIndex : -1;

      // We need to find the ID of the step we are submitting.
      // Since we re-ordered steps, we need to be careful.
      // The backend expects the answer for the step it considers "the question".
      // In our hack, that is the step at index 0 of the raw array, which corresponds to the Final Step.
      // So we should send the ID of the current step (which is the final step).
      sendAnswer(wsRef.current, question.id, question.steps[currentStepIndex].id, answerToSend);
    }
  };

  const handleNextQuestion = () => {
    // Just clear the result and wait for next question
    // In a real implementation, we might signal "ready for next" to server,
    // but current game-ws just sends next round automatically after delay.
    // So we mainly just show loading state here.
    setRoundResult(null);
    setIsLoadingQuestion(true);
  };

  // 6. Render Helpers
  if (!match || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (connectionState === 'ended' || match.state === 'ended') {
    const isWinner = match.winner_id === currentUser;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
        <Starfield />
        <div className="z-10 text-center space-y-6 p-8 bg-card/50 backdrop-blur-xl rounded-2xl border border-border">
          <h1 className="text-6xl font-bold mb-4">
            {isWinner ? <span className="text-yellow-400">VICTORY!</span> : <span className="text-red-500">DEFEAT</span>}
          </h1>
          <div className="text-3xl font-mono">
            {match.p1_score} - {match.p2_score}
          </div>
          <Button onClick={() => navigate('/')} size="lg" className="w-full">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isPlayer1 = currentUser === match.p1;
  const yourScore = isPlayer1 ? match.p1_score : match.p2_score;
  const opponentScore = isPlayer1 ? match.p2_score : match.p1_score;
  const scoreDiff = yourScore - opponentScore;
  const tugPosition = Math.max(-4, Math.min(4, scoreDiff));

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <Starfield />

      {/* Header */}
      <div className="relative z-10 container mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-card/50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Leave
          </Button>

          <div className="flex items-center gap-8">
            <div className="text-xl font-bold text-emerald-400">{yourUsername}: {yourScore}</div>
            <div className="text-xl font-bold text-red-400">{opponentUsername}: {opponentScore}</div>
          </div>
        </div>

        <div className="mb-8">
          <TugOfWarBar position={tugPosition} maxSteps={4} />
        </div>

        {/* Battle View */}
        <div className="flex-1 flex items-center justify-center min-h-[600px]">
          {isLoadingQuestion ? (
            <div className="text-center space-y-4">
              <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
              <h2 className="text-2xl font-bold text-muted-foreground animate-pulse">
                {match.state === 'active' ? 'Loading next question...' : 'Preparing battle...'}
              </h2>
            </div>
          ) : question ? (
            <BattleQuestionView
              question={question}
              currentStepIndex={currentStepIndex}
              selectedOptionIndex={selectedOptionIndex}
              stepTimeLeft={stepTimeLeft}
              isSubmitting={isSubmitting}
              onSelectOption={setSelectedOptionIndex}
              onSubmitStep={() => handleStepSubmit(false)}
              roundResult={roundResult}
              onNextQuestion={handleNextQuestion}
              isLoadingNext={isLoadingQuestion} // Actually handled by parent loading state, but passed for button state
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
