import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// New Components
import { GameLayout } from './game/GameLayout';
import { GameHeader } from './game/GameHeader';
import { ActiveQuestion } from './game/ActiveQuestion';
import { PhaseOverlay } from './game/PhaseOverlay';

// Logic & Types
import { connectGameWS, sendReady, sendAnswer } from '@/lib/ws';
import type { RoundPhase, RoundStartEvent, PhaseChangeEvent, RoundResultEvent } from '@/types/gameEvents';
import { StepBasedQuestion } from '@/types/questions';
import { mapRawQuestionToStepBasedQuestion } from '@/utils/questionMapper';

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
  created_at: string;
  ended_at?: string;
}

export const OnlineBattle = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();

  // -- State --
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [yourUsername, setYourUsername] = useState<string>('You');
  const [opponentUsername, setOpponentUsername] = useState<string>('Opponent');
  const [yourAvatar, setYourAvatar] = useState<string>();
  const [opponentAvatar, setOpponentAvatar] = useState<string>();

  const [connectionState, setConnectionState] = useState<'connecting' | 'waiting_ready' | 'playing' | 'ended'>('connecting');
  const [youReady, setYouReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

  // Game Logic State
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<RoundPhase | null>(null);

  // Timers
  const [phaseDeadline, setPhaseDeadline] = useState<Date | null>(null);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState<number>(0);

  // Interaction State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null); // For result display

  // Overlay State
  const [overlay, setOverlay] = useState<{
    isVisible: boolean;
    type: 'round_start' | 'vs' | 'victory' | 'defeat' | 'draw';
    title: string;
    subtitle?: string;
  }>({ isVisible: false, type: 'vs', title: '' });

  const wsRef = useRef<WebSocket | null>(null);

  // -- Helpers --
  const isPlayer1 = currentUser === match?.p1;
  const myScore = match ? (isPlayer1 ? match.p1_score : match.p2_score) : 0;
  const oppScore = match ? (isPlayer1 ? match.p2_score : match.p1_score) : 0;
  const tugPosition = myScore - oppScore; // Positive = You winning

  // -- Effects --

  // 1. Auth & User Info
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user?.id || null);
    });
  }, []);

  // 2. Fetch Match & Profiles
  useEffect(() => {
    if (!matchId) return;
    const fetchMatch = async () => {
      const { data, error } = await supabase.from('matches_new').select('*').eq('id', matchId).maybeSingle();
      if (data) setMatch(data as Match);
      else if (error) toast.error('Failed to load match');
    };
    fetchMatch();
  }, [matchId]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !match) return;

      // Your Profile
      const { data: myProfile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      if (myProfile) {
        setYourUsername(myProfile.username);
        // setYourAvatar(myProfile.avatar_url); // Not in schema
      }

      // Opponent Profile
      const opponentId = match.p1 === user.id ? match.p2 : match.p1;
      const { data: oppProfile } = await supabase.from('profiles').select('username').eq('id', opponentId).single();
      if (oppProfile) {
        setOpponentUsername(oppProfile.username);
        // setOpponentAvatar(oppProfile.avatar_url); // Not in schema
      }
    };
    fetchProfiles();
  }, [match]);

  // 3. WebSocket Connection
  useEffect(() => {
    if (!matchId || !currentUser || !match) return;

    const setupWebSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const ws = connectGameWS({
        matchId,
        token: session.access_token,
        onConnected: (event) => {
          console.log('WS: Connected');
          setConnectionState('playing');
          sendReady(ws);
          setYouReady(true);

          // Show VS Overlay
          setOverlay({
            isVisible: true,
            type: 'vs',
            title: 'BATTLE START',
            subtitle: `${yourUsername} vs ${opponentUsername}`
          });
          setTimeout(() => setOverlay(prev => ({ ...prev, isVisible: false })), 3000);
        },
        onPlayerReady: (event) => {
          if (event.player !== (isPlayer1 ? 'p1' : 'p2')) setOpponentReady(true);
        },
        onRoundStart: (event: RoundStartEvent) => {
          console.log('Component: Round Start Event Received:', event);
          console.log('Component: Question Payload:', event.question);

          // Reset Round State
          setRoundId(event.roundId);
          setCurrentPhase(event.phase);
          setPhaseDeadline(new Date(event.thinkingEndsAt));
          setSelectedAnswer(null);
          setCorrectAnswer(null);
          setIsSubmitting(false);
          setCurrentStepIndex(0); // Reset step

          // Parse Question
          if (event.question) {
            try {
              console.log('Component: Mapping question...');
              const q = mapRawQuestionToStepBasedQuestion(event.question);
              console.log('Component: Mapped Question:', q);
              setQuestions([q]);
            } catch (e) {
              console.error('Component: Error mapping question:', e);
              toast.error('Error loading question data');
            }
          } else {
            console.error('Component: No question data in ROUND_START event');
            toast.error('Received empty question data');
          }

          // Show Round Overlay
          setOverlay({
            isVisible: true,
            type: 'round_start',
            title: `ROUND ${event.roundIndex}`,
            subtitle: 'Get Ready!'
          });
          setTimeout(() => setOverlay(prev => ({ ...prev, isVisible: false })), 2000);
        },
        onPhaseChange: (event: PhaseChangeEvent) => {
          console.log('Phase Change:', event.phase);
          setCurrentPhase(event.phase);
          setPhaseDeadline(event.choosingEndsAt ? new Date(event.choosingEndsAt) : null);

          if (event.phase === 'choosing') {
            if (event.currentStepIndex !== undefined) setCurrentStepIndex(event.currentStepIndex);
            toast.info('Choose your answer!');
          }
        },
        onRoundResult: (event: RoundResultEvent) => {
          console.log('Round Result:', event);
          setCorrectAnswer(event.correctOptionId);
          setMatch(prev => prev ? { ...prev, p1_score: event.p1Score, p2_score: event.p2Score } : null);

          // Show result feedback
          const myResult = event.playerResults.find(r => r.playerId === currentUser);
          if (myResult?.isCorrect) toast.success('Correct!');
          else toast.error('Incorrect');
        },
        onAnswerResult: (event) => {
          // Handled by onRoundResult mostly, but useful for immediate feedback if needed
          if (event.player_id === currentUser) {
            setIsSubmitting(false);
          }
        },
        onMatchEnd: (event) => {
          setConnectionState('ended');
          const won = event.winnerPlayerId === currentUser;
          const draw = !event.winnerPlayerId;

          setOverlay({
            isVisible: true,
            type: draw ? 'draw' : (won ? 'victory' : 'defeat'),
            title: draw ? 'DRAW' : (won ? 'VICTORY' : 'DEFEAT'),
            subtitle: draw ? 'Well Played' : (won ? 'You Won!' : 'Better Luck Next Time')
          });
        },
        onValidationError: (event) => {
          toast.error(event.message);
          setIsSubmitting(false);
        },
        onError: (err) => toast.error(`Connection Error: ${err.message}`),
        onClose: () => toast.error('Connection Lost')
      });

      wsRef.current = ws;
    };

    setupWebSocket();
    return () => { wsRef.current?.close(); };
  }, [matchId, currentUser, match]);

  // 4. Timer Logic
  useEffect(() => {
    if (!phaseDeadline) return;
    const interval = setInterval(() => {
      const ms = phaseDeadline.getTime() - Date.now();
      setPhaseTimeRemaining(Math.max(0, ms));
    }, 100);
    return () => clearInterval(interval);
  }, [phaseDeadline]);

  // 5. Handlers
  const handleAnswer = (index: number) => {
    if (!wsRef.current || !roundId || isSubmitting) return;

    // Optimistic update
    setSelectedAnswer(index);
    setIsSubmitting(true);

    const currentQ = questions[0]; // We only have 1 active question in array usually
    const currentStep = currentQ?.steps[currentStepIndex];

    if (currentQ && currentStep) {
      sendAnswer(wsRef.current, matchId!, roundId, currentQ.id, currentStep.id, index);
    }
  };

  // -- Render --

  // Loading State
  if (!match || !currentUser || connectionState === 'connecting') {
    return (
      <GameLayout className="items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-white">Connecting to Battle...</h2>
        </div>
      </GameLayout>
    );
  }

  const currentQ = questions[0];
  const currentStep = currentQ?.steps[currentStepIndex];

  return (
    <GameLayout>
      <GameHeader
        player={{ username: yourUsername, avatarUrl: yourAvatar }}
        opponent={{ username: opponentUsername, avatarUrl: opponentAvatar }}
        currentRound={1} // TODO: Get from match/event
        totalRounds={5} // Fixed for now
        tugPosition={tugPosition}
        maxSteps={10} // Adjust scale as needed
        onBack={() => navigate('/')}
      />

      <div className="flex-1 flex items-center justify-center py-8">
        {currentQ && currentStep ? (
          <ActiveQuestion
            question={{
              id: currentQ.id,
              text: currentStep.prompt,
              options: currentStep.options,
              imageUrl: currentQ.imageUrl // Assuming root image for now
            }}
            phase={currentPhase || 'thinking'}
            timeLeft={phaseTimeRemaining}
            totalTime={currentPhase === 'thinking' ? 60000 : 15000} // Approximate
            selectedIndex={selectedAnswer}
            correctIndex={correctAnswer}
            onAnswer={handleAnswer}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            Waiting for next round...
          </div>
        )}
      </div>

      <PhaseOverlay
        isVisible={overlay.isVisible}
        type={overlay.type}
        title={overlay.title}
        subtitle={overlay.subtitle}
      />
    </GameLayout>
  );
};
