import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ArrowLeft } from 'lucide-react';
import CyberpunkBackground from './CyberpunkBackground';
import TugOfWarBar from './TugOfWarBar';

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

interface PlayerAction {
  user_id: string;
  question_index: number;
  step_index: number;
  is_correct: boolean;
  marks_earned: number;
}

export const OnlineBattle = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [tugOfWarPosition, setTugOfWarPosition] = useState(0);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [playerActions, setPlayerActions] = useState<PlayerAction[]>([]);
  const [yourUsername, setYourUsername] = useState<string>('You');
  const [opponentUsername, setOpponentUsername] = useState<string>('Opponent');
  const [matchReady, setMatchReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Get usernames from navigation state or fetch from database
  useEffect(() => {
    const fetchUsernames = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !match) return;

      // Get your username from location state or profile
      if (location.state?.yourUsername) {
        setYourUsername(location.state.yourUsername);
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) setYourUsername(profile.username);
      }

      // Get opponent username from location state or fetch from database
      const opponentId = match.p1 === user.id ? match.p2 : match.p1;
      
      if (location.state?.opponentName) {
        setOpponentUsername(location.state.opponentName);
      } else {
        const { data: opponentProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', opponentId)
          .maybeSingle();
        if (opponentProfile) setOpponentUsername(opponentProfile.username);
      }
    };

    fetchUsernames();
  }, [location.state, match]);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user?.id || null);
    });
  }, []);

  // Fetch match data
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
        return;
      }

      if (data) {
        setMatch(data as Match);
      }
    };

    fetchMatch();
  }, [matchId]);

  // Timer countdown
  useEffect(() => {
    if (!match || match.state !== 'active' || timeLeft <= 0 || waitingForOpponent) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, match, waitingForOpponent]);

  useEffect(() => {
    if (!match || !currentUser) return;

    const checkBothPlayersReady = async () => {
      console.log('Checking if both players are ready...');

      if (match.state === 'active') {
        console.log('Match is active, starting immediately...');
        setMatchReady(true);
        setCountdown(null);
        setTimeLeft(300);
        setCurrentStep(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setWaitingForOpponent(false);
      }
    };

    checkBothPlayersReady();
  }, [match, currentUser]);

  // Countdown removed - instant start

  // Subscribe to match updates and player actions
  useEffect(() => {
    if (!matchId || !currentUser) return;

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches_new',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          setMatch(payload.new as Match);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_actions',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const action = payload.new as PlayerAction;
          setPlayerActions((prev) => [...prev, action]);
          
          // Check if both players finished the question when opponent answers
          if (action.user_id !== currentUser) {
            await checkQuestionCompletion();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, currentUser]);

  const handleTimeUp = async () => {
    if (!match || !currentUser) return;
    setWaitingForOpponent(true);
    await checkQuestionCompletion();
  };

  const checkQuestionCompletion = async () => {
    // TODO: Implement with new schema
    console.log('Check question completion - needs implementation');
  };

  const evaluateQuestionWinner = async () => {
    // TODO: Implement with new schema
    console.log('Evaluate question winner - needs implementation');
  };

  const handleAnswer = async (answerIndex: number) => {
    // TODO: Implement with new schema and match_events
    console.log('Handle answer - needs implementation', answerIndex);
  };

  const handleNextStep = async () => {
    // TODO: Implement with new schema
    console.log('Handle next step - needs implementation');
  };

  const endMatch = async (finalP1Score?: number, finalP2Score?: number) => {
    if (!match) return;

    const p1Score = finalP1Score ?? match.p1_score;
    const p2Score = finalP2Score ?? match.p2_score;

    const winnerId = p1Score > p2Score ? match.p1 :
                     p2Score > p1Score ? match.p2 : null;

    await supabase
      .from('matches_new')
      .update({
        state: 'ended',
        winner_id: winnerId,
        p1_score: p1Score,
        p2_score: p2Score,
        ended_at: new Date().toISOString(),
      })
      .eq('id', match.id);
  };

  if (!match || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CyberpunkBackground />
        <div className="relative z-10 text-2xl">Loading battle...</div>
      </div>
    );
  }

  if (countdown !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <CyberpunkBackground />
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 text-center"
        >
          <h2 className="text-3xl font-bold mb-8">Get Ready!</h2>
          <motion.div
            key={countdown}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="text-9xl font-bold text-primary"
          >
            {countdown}
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

  if (match.state === 'ended') {
    const won = match.winner_id === currentUser;
    const draw = !match.winner_id;

    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <CyberpunkBackground />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 text-center"
        >
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

  return (
    <div className="min-h-screen relative">
      <CyberpunkBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2" />
            Leave Match
          </Button>
          <div className="text-2xl font-bold">
            {match.subject} - {match.chapter}
          </div>
        </div>

        {/* Tug of War Bar */}
        <div className="mb-8">
          <TugOfWarBar position={tugOfWarPosition} maxSteps={5} />
        </div>

        {/* Timer */}
        <div className="mb-6 bg-card p-4 rounded-lg">
          <div className="text-center mb-2">
            <div className="text-3xl font-bold">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-muted-foreground">Time Remaining</div>
          </div>
          <Progress value={timeProgress} className="h-2" />
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className={`p-4 rounded-lg border-2 ${isPlayer1 ? 'bg-primary/20 border-primary' : 'bg-secondary/20 border-secondary'}`}>
            <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">YOU</div>
            <div className="text-lg font-semibold mb-2 truncate">{yourUsername}</div>
            <div className="text-3xl font-bold">
              {isPlayer1 ? match.p1_score : match.p2_score}
            </div>
          </div>
          <div className={`p-4 rounded-lg border-2 ${!isPlayer1 ? 'bg-primary/20 border-primary' : 'bg-secondary/20 border-secondary'}`}>
            <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">OPPONENT</div>
            <div className="text-lg font-semibold mb-2 truncate">{opponentUsername}</div>
            <div className="text-3xl font-bold">
              {!isPlayer1 ? match.p1_score : match.p2_score}
            </div>
          </div>
        </div>

        {/* Battle Area - TODO: Implement question display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card p-8 rounded-lg text-center"
        >
          <h2 className="text-3xl font-bold mb-4">Battle System Under Construction</h2>
          <p className="text-muted-foreground mb-4">The online battle system needs to be fully implemented with the new schema.</p>
          <p className="text-sm text-muted-foreground">Match ID: {matchId}</p>
        </motion.div>
      </div>
    </div>
  );
};