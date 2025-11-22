import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ArrowLeft, Loader2, Trophy, Award, AlertCircle } from 'lucide-react';
import { Starfield } from './Starfield';
import TugOfWarBar from './TugOfWarBar';
import { connectGameWS, sendReady, sendAnswer, sendReadyForOptions, type ServerEvent } from '@/lib/ws';
import type { RoundPhase, RoundStartEvent, PhaseChangeEvent, RoundResultEvent } from '@/types/gameEvents';
import { toast } from 'sonner';
import { StepBasedQuestion, QuestionSubject, QuestionLevel } from '@/types/questions';
import { useQuestions } from '@/hooks/useQuestions';
import { QuestionViewer } from './questions/QuestionViewer';
import { Card, CardContent } from './ui/card';

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
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [yourUsername, setYourUsername] = useState<string>('You');
  const [opponentUsername, setOpponentUsername] = useState<string>('Opponent');
  const [connectionState, setConnectionState] = useState<'connecting' | 'waiting_ready' | 'playing' | 'ended'>('connecting');
  const [opponentReady, setOpponentReady] = useState(false);
  const [youReady, setYouReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [hasSubmittedWork, setHasSubmittedWork] = useState(false);

  // 3-phase state
  const [currentPhase, setCurrentPhase] = useState<RoundPhase | null>(null);
  const [phaseDeadline, setPhaseDeadline] = useState<Date | null>(null);
  const [roundOptions, setRoundOptions] = useState<Array<{ id: number; text: string }> | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState<number | null>(null);
  const [isServerDriven, setIsServerDriven] = useState(false);
  const [, setTimerTick] = useState(0); // Dummy state to force re-renders for timer

  // Step-based timer state
  const [stepDeadline, setStepDeadline] = useState<Date | null>(null);
  const [stepTimeLeft, setStepTimeLeft] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Fallback: fetch questions from database if WebSocket doesn't provide them
  const fallbackSubject = (match?.subject as QuestionSubject) || 'math';
  const fallbackLevel = (match?.chapter?.includes('A1') ? 'A1' : match?.chapter?.includes('A2') ? 'A2' : undefined) as QuestionLevel | undefined;

  console.log('[OnlineBattle] Match info:', { subject: match?.subject, chapter: match?.chapter });
  console.log('[OnlineBattle] Fallback filters:', { subject: fallbackSubject, level: fallbackLevel });

  const {
    data: fallbackQuestions,
    isLoading: isFetchingFallback,
    isError: fallbackError
  } = useQuestions({
    subject: fallbackSubject,
    level: fallbackLevel,
    limit: 5
  });

  console.log('[OnlineBattle] Fallback questions:', fallbackQuestions?.length || 0);

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
        console.error('Error fetching match:', error);
        toast.error('Failed to load match');
        return;
      }

      if (data) {
        console.log('Match loaded:', data);
        setMatch(data as Match);
      }
    };

    fetchMatch();
  }, [matchId]);

  useEffect(() => {
    const fetchUsernames = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !match) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) setYourUsername(profile.username);

      const opponentId = match.p1 === user.id ? match.p2 : match.p1;
      const { data: opponentProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', opponentId)
        .maybeSingle();
      if (opponentProfile) setOpponentUsername(opponentProfile.username);
    };

    fetchUsernames();
  }, [match]);

  useEffect(() => {
    if (!matchId || !currentUser || !match) return;

    const setupWebSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('WS: No access token found');
        toast.error('Authentication error');
        return;
      }

      console.log('WS: Setting up WebSocket connection');

      const ws = connectGameWS({
        matchId,
        token: session.access_token,
        onConnected: (event) => {
          console.log('WS: Connected as', event.player);
          setConnectionState('playing'); // Skip waiting_ready

          // Force initialize phase for instant start
          setCurrentPhase('thinking');
          setPhaseDeadline(new Date(Date.now() + 60000)); // 60s default

          sendReady(ws);
          setYouReady(true);
          toast.success('Connected to battle server');
        },
        onPlayerReady: (event) => {
          console.log('WS: Player ready event:', event.player);
          if (event.player === 'p1' || event.player === 'p2') {
            const isOpponent = (match.p1 === currentUser && event.player === 'p2') ||
              (match.p2 === currentUser && event.player === 'p1');
            if (isOpponent) {
              setOpponentReady(true);
            }
          }
        },
        onRoundStart: (event: RoundStartEvent) => {
          console.log('[OnlineBattle] ✅ ROUND_START received', event);
          console.log('[OnlineBattle] Phase:', event.phase, 'Deadline:', event.thinkingEndsAt);
          setIsServerDriven(true);

          // Reset state for new round
          setShowResult(false);
          setCorrectAnswer(null);
          setIsSubmitting(false);
          setRoundIndex(event.roundIndex);
          setCurrentPhase(event.phase);
          setPhaseDeadline(new Date(event.thinkingEndsAt));
          setPhaseDeadline(new Date(event.thinkingEndsAt));
          setRoundOptions(null); // No options during thinking phase
          setHasSubmittedWork(false); // Reset for new round
          setCurrentStepIndex(0); // Reset step index for new round
          setStepDeadline(null); // Reset step timer

          console.log('[OnlineBattle] State updated - currentPhase:', event.phase, 'phaseDeadline:', new Date(event.thinkingEndsAt));

          if (!event.question) {
            console.error('WS: event.question is null/undefined!', event);
            toast.error('Failed to load question - no question in payload');
            return;
          }

          const q = event.question;
          console.log('WS: Question keys:', Object.keys(q));
          console.log('WS: Question steps:', q.steps);

          if (!q.steps || !Array.isArray(q.steps) || q.steps.length === 0) {
            console.error('WS: Question has no valid steps!', q);
            toast.error('Question has no steps - invalid format');
            return;
          }

          const formattedQuestion = {
            id: q.id,
            title: q.title,
            subject: q.subject as QuestionSubject,
            chapter: q.chapter,
            level: q.level as QuestionLevel,
            difficulty: q.difficulty as any, // Cast to any to avoid strict type check for now, or import QuestionDifficulty
            rankTier: (q.rankTier || 'Bronze') as any,
            totalMarks: q.totalMarks,
            questionText: q.questionText,
            topicTags: q.topicTags || [],
            steps: q.steps as any
          };

          console.log('WS: Formatted question:', formattedQuestion);
          setQuestions([formattedQuestion]);

          if (event.roundIndex === 0) {
            toast.success('Battle begins!');
            setCountdown(3);
          } else {
            toast.info(`Round ${event.roundIndex + 1}`);
            setConnectionState('playing');
          }
        },
        onPhaseChange: (event: PhaseChangeEvent) => {
          console.log('[OnlineBattle] ✅ PHASE_CHANGE received', event);
          console.log('[OnlineBattle] New phase:', event.phase);

          setCurrentPhase(event.phase);

          if (event.phase === 'choosing') {
            console.log('[OnlineBattle] Choosing phase - Options:', event.options?.length || 0, 'Deadline:', event.choosingEndsAt);
            setPhaseDeadline(event.choosingEndsAt ? new Date(event.choosingEndsAt) : null);
            setRoundOptions(event.options || null);
            console.log('[OnlineBattle] State updated - roundOptions:', event.options?.length || 0);
            toast.info('Choose your answer now!', { duration: 2000 });
          } else if (event.phase === 'result') {
            console.log('[OnlineBattle] Result phase');
            setPhaseDeadline(null);
            toast.info('Calculating results...');
          }
        },
        onRoundResult: (event: RoundResultEvent) => {
          console.log('[OnlineBattle] Round result received', event);
          setShowResult(true);
          setCorrectAnswer(event.correctOptionId);

          // Update scores
          setMatch(prev => prev ? {
            ...prev,
            p1_score: event.p1Score,
            p2_score: event.p2Score,
          } : null);

          // Find current user's result
          const myResult = event.playerResults.find(r => r.playerId === currentUser);
          if (myResult) {
            if (myResult.isCorrect) {
              toast.success('Correct answer!');
            } else {
              toast.error('Incorrect answer');
            }
          }
        },
        onGameStart: (event) => {
          console.log('[OnlineBattle] Legacy game_start event (should not happen with 3-phase)', event);
        },
        onNextQuestion: (event) => {
          console.log('[OnlineBattle] Legacy next_question event (should not happen with 3-phase)', event);
        },
        onAnswerResult: (event) => {
          console.log('[OnlineBattle] Legacy answer_result event (should not happen with 3-phase)', event);
          setIsSubmitting(false);
        },
        onScoreUpdate: (event) => {
          console.log(`WS: Legacy score_update event (should not happen with 3-phase)`, event);
        },
        onOpponentDisconnect: (event) => {
          console.log('WS: Opponent disconnected');
          toast.warning(`Opponent disconnected: ${event.reason}`);
          if (event.you_win) {
            toast.success('You win by forfeit!');
            setTimeout(() => navigate('/'), 5000);
          }
        },
        onMatchEnd: (event) => {
          console.log('WS: Match ended', event);
          setConnectionState('ended');

          // Handle new event format
          const winnerId = event.winnerPlayerId;
          const finalScores = event.summary.finalScores;

          setMatch(prev => prev ? {
            ...prev,
            state: 'ended',
            winner_id: winnerId,
            p1_score: finalScores.p1,
            p2_score: finalScores.p2,
          } : null);

          if (winnerId === currentUser) {
            toast.success('Victory!', { duration: 5000 });
          } else if (winnerId) {
            toast.error('Defeat', { duration: 5000 });
          } else {
            toast.info('Match ended in a draw', { duration: 5000 });
          }
        },
        onError: (error) => {
          console.error('WS: Error:', error);
          toast.error(`Connection error: ${error.message}`);
        },
        onClose: () => {
          console.log('WS: Connection closed');
          if (connectionState !== 'ended') {
            toast.error('Connection to server lost');
          }
        },
      });

      wsRef.current = ws;
    };

    setupWebSocket();

    return () => {
      if (wsRef.current) {
        console.log('WS: Cleaning up connection');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [matchId, currentUser, match, navigate, connectionState]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      console.log('Countdown complete! Questions in state:', questions.length);
      if (questions.length > 0) {
        console.log('First question:', questions[0].id, 'Steps:', questions[0].steps.length);
      } else {
        console.error('Countdown finished but NO QUESTIONS in state!');
      }
      setCountdown(null);
      setConnectionState('playing');
      setTimeLeft(300);
    }
  }, [countdown, questions]);

  // Answer submission handler
  const handleSubmitAnswer = (questionId: string, stepId: string, answerIndex: number) => {
    if (!wsRef.current || isSubmitting) return;

    const currentQ = questions[currentQuestionIndex];
    const totalSteps = currentQ?.steps?.length || 0;

    console.log(`[OnlineBattle] step answered`, currentStepIndex, totalSteps);
    console.log('[OnlineBattle] Submitting answer:', { questionId, stepId, answerIndex });
    setIsSubmitting(true);

    sendAnswer(wsRef.current, questionId, stepId, answerIndex);

    // Handle step progression locally
    if (currentQ && currentQ.steps && currentStepIndex < currentQ.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      console.log(`[OnlineBattle] moving to step`, nextIndex);

      setTimeout(() => {
        setCurrentStepIndex(nextIndex);
        setIsSubmitting(false);

        // Reset step timer for next step
        const nextStep = currentQ.steps[nextIndex];
        // Use timeLimitSeconds from step or default to 15s
        const limit = (nextStep as any).timeLimitSeconds || 15;
        setStepDeadline(new Date(Date.now() + limit * 1000));
      }, 500); // Small delay for UX
    } else {
      console.log(`[OnlineBattle] last step complete, finishing round`);
      // If it's the last step, we just wait for the round to end naturally via server events
      // or for the user to wait for the next question.
      // We keep isSubmitting true to prevent double clicks until the server responds
      // But actually, we might need to allow the user to see the result state locally?
      // The server sends 'round_result' event which handles the transition.
      // So keeping isSubmitting=true is probably fine, or we can set it to false if we want to show a "Waiting..." state.
      // Let's set it to false to allow UI updates if needed, but the button should be disabled by "Answer Selected" state.
      setIsSubmitting(false);
    }
  };

  const handleReadyForOptions = () => {
    if (hasSubmittedWork) return;

    console.log('[OnlineBattle] Sending ready for options');
    setHasSubmittedWork(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendReadyForOptions(wsRef.current, matchId!);
    }

    // Local immediate transition if not server driven (or to feel responsive)
    if (!isServerDriven) {
      console.log('[OnlineBattle] Local transition to choosing (user ready)');
      // Short delay to simulate network/waiting
      setTimeout(() => {
        const currentQ = questions[currentQuestionIndex];
        const currentStep = currentQ?.steps[currentStepIndex];
        if (currentStep) {
          const options = currentStep.options.map((text, i) => ({ id: i, text }));
          setRoundOptions(options);
          setCurrentPhase('choosing');
          setPhaseDeadline(new Date(Date.now() + 45000)); // 45s for choosing
        }
      }, 500);
    }
  };

  // If game is playing but no questions from WebSocket, use fallback
  useEffect(() => {
    if (connectionState === 'playing' && questions.length === 0 && fallbackQuestions && fallbackQuestions.length > 0) {
      console.log('[OnlineBattle] Using fallback questions since WebSocket provided none');
      console.log('[OnlineBattle] Fallback question count:', fallbackQuestions.length);
      setQuestions(fallbackQuestions);

      // Initialize phase if not set (e.g. if WS failed to provide it)
      if (!currentPhase) {
        console.log('[OnlineBattle] Initializing fallback phase to THINKING');
        setCurrentPhase('thinking');
        setPhaseDeadline(new Date(Date.now() + 60000)); // 60s default
      }
    }
  }, [connectionState, questions.length, fallbackQuestions, currentPhase]);

  // Debug: Log questions state changes
  useEffect(() => {
    console.log('[OnlineBattle] Questions state updated:', {
      count: questions.length,
      connectionState,
      hasQuestions: questions.length > 0
    });
  }, [questions, connectionState]);

  // Debug: Log phase state changes
  useEffect(() => {
    console.log('[OnlineBattle] Phase state:', {
      currentPhase,
      phaseDeadline: phaseDeadline?.toISOString(),
      hasPhaseDeadline: !!phaseDeadline,
      roundOptions: roundOptions?.length || 0
    });
  }, [currentPhase, phaseDeadline, roundOptions]);

  // Timer logic for ALL phases
  useEffect(() => {
    if (!phaseDeadline) {
      setPhaseTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const deadline = new Date(phaseDeadline).getTime();
      const diffMs = Math.max(0, deadline - now);
      const seconds = Math.ceil(diffMs / 1000);
      setPhaseTimeRemaining(seconds);
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [phaseDeadline]);

  // Step Timer Logic
  useEffect(() => {
    if (!stepDeadline) {
      setStepTimeLeft(null);
      return;
    }

    const updateStepTimer = () => {
      const now = Date.now();
      const deadline = new Date(stepDeadline).getTime();
      const diffMs = Math.max(0, deadline - now);
      const seconds = Math.ceil(diffMs / 1000);
      setStepTimeLeft(seconds);

      if (diffMs <= 0) {
        // Time's up for this step!
        // Auto-advance or lock
        console.log('[OnlineBattle] Step time up!');
        setStepDeadline(null);
        // If we haven't answered, maybe we should auto-submit or just move on?
        // For now, let's just move to next step if possible, or mark as done.
        // But we can't auto-submit an answer if we don't know what to pick.
        // We'll just let the UI lock.
        // Actually, the user said: "automatically lock the current step and either: move to the next step... or finish".

        const currentQ = questions[currentQuestionIndex];
        if (currentQ && currentQ.steps && currentStepIndex < currentQ.steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
          // Start timer for next step
          const nextStep = currentQ.steps[currentStepIndex + 1];
          const limit = (nextStep as any).timeLimitSeconds || 15;
          setStepDeadline(new Date(Date.now() + limit * 1000));
        } else {
          // Last step finished
          // Maybe set some state to show we are done?
        }
      }
    };

    updateStepTimer();
    const interval = setInterval(updateStepTimer, 1000);
    return () => clearInterval(interval);
  }, [stepDeadline, currentQuestionIndex, currentStepIndex, questions]);

  // Initialize step timer when entering Choosing phase (or whenever steps start)
  useEffect(() => {
    if (currentPhase === 'choosing' && questions.length > 0) {
      // If we just entered choosing, start step 1 timer if not already started
      // But we need to be careful not to reset it if we are already in the middle of steps.
      // Maybe only if stepDeadline is null and currentStepIndex is 0?
      if (!stepDeadline && currentStepIndex === 0) {
        const currentQ = questions[currentQuestionIndex];
        const step = currentQ?.steps[0];
        const limit = (step as any)?.timeLimitSeconds || 15;
        setStepDeadline(new Date(Date.now() + limit * 1000));
      }
    }
  }, [currentPhase, questions, currentQuestionIndex, stepDeadline, currentStepIndex]);

  // Force re-render every 100ms when there's an active phase deadline to update timer display
  useEffect(() => {
    if (!phaseDeadline || !currentPhase) {
      return;
    }
    // ... existing tick logic ...
    const interval = setInterval(() => {
      setTimerTick(prev => prev + 1); // Force re-render
    }, 100);

    return () => {
      clearInterval(interval);
    };
    return () => {
      clearInterval(interval);
    };
  }, [phaseDeadline, currentPhase]);

  // Local Phase Transition Logic (Failsafe / Single Player)
  useEffect(() => {
    if (isServerDriven || !currentPhase || !phaseDeadline) return;

    const now = Date.now();
    const deadline = new Date(phaseDeadline).getTime();

    if (now >= deadline) {
      console.log('[OnlineBattle] Local phase transition triggered due to timeout');

      if (currentPhase === 'thinking') {
        // Transition to Choosing
        const currentQ = questions[currentQuestionIndex];
        const currentStep = currentQ?.steps[currentStepIndex];
        if (currentStep) {
          const options = currentStep.options.map((text, i) => ({ id: i, text }));
          setRoundOptions(options);
          setCurrentPhase('choosing');
          setPhaseDeadline(new Date(Date.now() + 45000)); // 45s for choosing
        }
      } else if (currentPhase === 'choosing') {
        // Transition to Result
        setCurrentPhase('result');
        setPhaseDeadline(null);
        // Auto-submit if not submitted?
        // For now just show result
      }
    }
  }, [isServerDriven, currentPhase, phaseDeadline, phaseTimeRemaining, questions, currentQuestionIndex, currentStepIndex]);

  useEffect(() => {
    if (connectionState === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [connectionState, timeLeft]);

  if (!match || !currentUser) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Starfield />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <div className="text-2xl">Loading battle...</div>
        </div>
      </div>
    );
  }

  if (countdown !== null) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Starfield />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 text-center">
          <h2 className="text-3xl font-bold mb-8">Get Ready!</h2>
          <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="text-9xl font-bold text-primary">
            {countdown === 0 ? 'START!' : countdown}
          </motion.div>
          <div className="mt-8 text-xl text-muted-foreground">
            {yourUsername} vs {opponentUsername}
          </div>
        </motion.div>
      </div>
    );
  }


  const isPlayer1 = currentUser === match.p1;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalTime = 300;
  const timeProgress = (timeLeft / totalTime) * 100;

  if (match.state === 'ended' || connectionState === 'ended') {
    const won = match.winner_id === currentUser;
    const draw = !match.winner_id;

    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Starfield />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 text-center">
          <h1 className="text-6xl font-bold mb-4">
            {draw ? 'DRAW!' : won ? 'VICTORY!' : 'DEFEAT'}
          </h1>
          <div className="text-3xl mb-8">
            {match.p1_score} - {match.p2_score}
          </div>
          <Button onClick={() => navigate('/')} size="lg">
            Return to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  if (connectionState === 'playing' && questions.length > 0) {
    const yourScore = isPlayer1 ? match.p1_score : match.p2_score;
    const opponentScore = isPlayer1 ? match.p2_score : match.p1_score;
    const scoreDiff = yourScore - opponentScore;
    const tugPosition = Math.max(-4, Math.min(4, scoreDiff));

    return (
      <div className="relative min-h-screen overflow-hidden flex flex-col">
        <Starfield />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />

        <div className="relative z-10 container mx-auto px-4 py-8 flex-1">
          <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" onClick={() => navigate('/')} className="backdrop-blur-sm bg-card/50 border border-border/50 hover:bg-card/70 hover:border-border">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Leave Match
            </Button>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold backdrop-blur-sm bg-card/50 px-6 py-2 rounded-xl border border-border/50">
                {match.subject} - {match.chapter}
              </div>
              {currentPhase === 'choosing' && phaseTimeRemaining !== null && (
                <div className="text-xl font-mono font-bold backdrop-blur-sm bg-amber-500/20 text-amber-500 px-4 py-2 rounded-xl border border-amber-500/50 animate-pulse">
                  Choosing: 00:{String(phaseTimeRemaining).padStart(2, '0')}
                </div>
              )}
            </div>
          </div>

          {/* Phase-based Timer Display */}
          {(() => {
            console.log('[OnlineBattle] Render check - Timer visible?', {
              currentPhase,
              hasDeadline: !!phaseDeadline,
              phaseDeadline,
              connectionState,
              questionsLength: questions.length
            });
            return null;
          })()}
          {currentPhase && phaseDeadline && (
            <div className="mb-4 backdrop-blur-sm bg-card/50 p-4 rounded-xl border border-border/50 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full font-bold text-sm text-white ${currentPhase === 'thinking' ? 'bg-blue-500' :
                    currentPhase === 'choosing' ? 'bg-amber-500' :
                      'bg-green-500'
                    }`}>
                    {currentPhase === 'thinking' ? 'THINKING' : currentPhase === 'choosing' ? 'CHOOSING' : 'RESULT'}
                  </div>
                  <div className="text-3xl font-bold font-mono">
                    {phaseTimeRemaining !== null ? `${phaseTimeRemaining}s` : '0s'}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentPhase === 'thinking' ? 'Read the question' : currentPhase === 'choosing' ? 'Select your answer!' : 'Calculating...'}
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex justify-between text-lg font-bold backdrop-blur-sm bg-card/50 px-6 py-3 rounded-xl border border-border/50">
            <span className="text-emerald-500">{yourUsername}: {yourScore}</span>
            <span className="text-red-500">{opponentUsername}: {opponentScore}</span>
          </div>

          <div className="mb-8">
            <TugOfWarBar position={tugPosition} maxSteps={4} />
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="backdrop-blur-sm bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <QuestionViewer
                  questions={questions}
                  isOnlineMode={true}
                  onSubmitAnswer={handleSubmitAnswer}
                  isSubmitting={isSubmitting}
                  correctAnswer={correctAnswer}
                  showResult={showResult}
                  currentPhase={currentPhase || undefined}
                  phaseDeadline={phaseDeadline}
                  options={roundOptions}
                  currentStepIndex={currentStepIndex}
                  stepTimeLeft={stepTimeLeft}
                  totalSteps={questions[currentQuestionIndex]?.steps?.length || 0}
                />

                {currentPhase === 'thinking' && !hasSubmittedWork && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      size="lg"
                      onClick={handleReadyForOptions}
                      className="w-full max-w-md text-lg py-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
                    >
                      I'm done – show options
                    </Button>
                  </div>
                )}

                {currentPhase === 'thinking' && hasSubmittedWork && (
                  <div className="mt-6 text-center p-4 rounded-lg bg-secondary/20 border border-secondary/30 animate-pulse">
                    <p className="text-muted-foreground font-medium">Waiting for other player...</p>
                    <p className="text-xs text-muted-foreground mt-1">Options will appear when both are ready or time is up.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      <Starfield />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)' }} />

      <div className="relative z-10 container mx-auto px-4 py-8 flex-1">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="backdrop-blur-sm bg-card/50 border border-border/50 hover:bg-card/70 hover:border-border">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Leave Match
          </Button>
          <div className="text-2xl font-bold backdrop-blur-sm bg-card/50 px-6 py-2 rounded-xl border border-border/50">
            {match.subject} - {match.chapter}
          </div>
        </div>

        {connectionState !== 'waiting_ready' && connectionState !== 'connecting' && (
          <div className="mb-8">
            <TugOfWarBar position={0} maxSteps={5} />
          </div>
        )}

        {connectionState === 'waiting_ready' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-sm bg-card/50 p-8 rounded-2xl border border-border/50 text-center shadow-lg mb-6">
            <h2 className="text-2xl font-bold mb-4">Waiting for players to ready up...</h2>
            <div className="flex justify-center gap-8">
              <div className={`flex items-center gap-2 ${youReady ? 'text-green-500' : 'text-muted-foreground'}`}>
                {youReady ? '✓' : '○'} You {youReady && '(Ready)'}
              </div>
              <div className={`flex items-center gap-2 ${opponentReady ? 'text-green-500' : 'text-muted-foreground'}`}>
                {opponentReady ? '✓' : '○'} {opponentUsername} {opponentReady && '(Ready)'}
              </div>
            </div>
          </motion.div>
        )}

        {connectionState === 'playing' && (
          <>
            <div className="mb-6 backdrop-blur-sm bg-card/50 p-6 rounded-2xl border border-border/50 relative shadow-lg">
              <div className="text-center mb-3">
                <div className="text-4xl font-bold">
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Time Remaining</div>
              </div>
              <Progress value={timeProgress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`p-6 rounded-2xl backdrop-blur-sm border-2 shadow-lg ${isPlayer1 ? 'bg-primary/10 border-primary/50' : 'bg-card/50 border-border/50'}`}>
                <div className="text-xs uppercase tracking-wide mb-2 text-muted-foreground">YOU</div>
                <div className="text-lg font-semibold mb-2 truncate">{yourUsername}</div>
                <div className="text-4xl font-bold">{isPlayer1 ? match.p1_score : match.p2_score}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`p-6 rounded-2xl backdrop-blur-sm border-2 shadow-lg ${!isPlayer1 ? 'bg-primary/10 border-primary/50' : 'bg-card/50 border-border/50'}`}>
                <div className="text-xs uppercase tracking-wide mb-2 text-muted-foreground">OPPONENT</div>
                <div className="text-lg font-semibold mb-2 truncate">{opponentUsername}</div>
                <div className="text-4xl font-bold">{!isPlayer1 ? match.p1_score : match.p2_score}</div>
              </motion.div>
            </div>
          </>
        )}

        {/* Question Display Area */}
        {isFetchingFallback && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-sm bg-card/50 p-8 rounded-2xl border border-border/50 text-center shadow-lg">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Loading Questions</h2>
            <p className="text-muted-foreground">Fetching questions from database...</p>
          </motion.div>
        )}

        {!isFetchingFallback && fallbackError && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-sm bg-red-900/20 p-8 rounded-2xl border border-red-700 text-center shadow-lg">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-red-300">Failed to Load Questions</h2>
            <p className="text-red-200">There was an error fetching questions from the database.</p>
          </motion.div>
        )}

        {!isFetchingFallback && !fallbackError && (!fallbackQuestions || fallbackQuestions.length === 0) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-sm bg-yellow-900/20 p-8 rounded-2xl border border-yellow-700 text-center shadow-lg">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4 text-yellow-300">No Questions Available</h2>
            <p className="text-yellow-200 mb-4">
              No questions found for {match?.subject} - {match?.chapter}
            </p>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 text-left max-w-md mx-auto">
              <p className="text-xs text-gray-400 font-bold mb-2">TO FIX THIS:</p>
              <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                <li>Add SUPABASE_SERVICE_ROLE_KEY to .env</li>
                <li>Run: <code className="bg-gray-800 px-1 rounded text-green-400">npm run seed:questions</code></li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground mt-4">Match ID: {matchId}</p>
          </motion.div>
        )}

        {!isFetchingFallback && !fallbackError && fallbackQuestions && fallbackQuestions.length > 0 && connectionState !== 'waiting_ready' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="backdrop-blur-sm bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <QuestionViewer
                  questions={fallbackQuestions}
                  isOnlineMode={true}
                  onSubmitAnswer={handleSubmitAnswer}
                  isSubmitting={isSubmitting}
                  correctAnswer={correctAnswer}
                  showResult={showResult}
                  currentPhase={currentPhase || undefined}
                  phaseDeadline={phaseDeadline}
                  options={roundOptions}
                  onFinished={() => {
                    console.log('[OnlineBattle] Questions finished');
                    toast.success('All questions completed!');
                  }}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};
