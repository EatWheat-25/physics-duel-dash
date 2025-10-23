import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ArrowLeft } from 'lucide-react';
import CyberpunkBackground from './CyberpunkBackground';
import TugOfWarBar from './TugOfWarBar';

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  questions: any;
  player1_score: number;
  player2_score: number;
  current_question_index: number;
  status: string;
  winner_id?: string;
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
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [tugOfWarPosition, setTugOfWarPosition] = useState(0);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [playerActions, setPlayerActions] = useState<PlayerAction[]>([]);

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
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (error) {
        console.error('Error fetching match:', error);
        return;
      }

      const parsedMatch = {
        ...data,
        questions: typeof data.questions === 'string' 
          ? JSON.parse(data.questions) 
          : data.questions
      };

      setMatch(parsedMatch);
    };

    fetchMatch();
  }, [matchId]);

  // Timer countdown
  useEffect(() => {
    if (!match || match.status !== 'active' || timeLeft <= 0 || waitingForOpponent) return;

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

  // Initialize timer when new question starts
  useEffect(() => {
    if (!match || !match.questions[match.current_question_index]) return;
    const currentQuestion = match.questions[match.current_question_index];
    setTimeLeft(currentQuestion.totalMarks * 60); // 1 mark = 1 minute
    setCurrentStep(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setWaitingForOpponent(false);
  }, [match?.current_question_index]);

  // Subscribe to match updates and player actions
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const parsedMatch = {
            ...payload.new,
            questions: typeof payload.new.questions === 'string' 
              ? JSON.parse(payload.new.questions) 
              : payload.new.questions
          };
          setMatch(parsedMatch as Match);
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
        (payload) => {
          const action = payload.new as PlayerAction;
          setPlayerActions((prev) => [...prev, action]);
          
          // Check if both players finished the question
          if (action.user_id !== currentUser && waitingForOpponent) {
            checkQuestionCompletion();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, currentUser, waitingForOpponent]);

  const handleTimeUp = async () => {
    if (!match || !currentUser) return;
    setWaitingForOpponent(true);
    await checkQuestionCompletion();
  };

  const checkQuestionCompletion = async () => {
    if (!match || !currentUser) return;

    const { data: allActions } = await supabase
      .from('player_actions')
      .select('*')
      .eq('match_id', matchId)
      .eq('question_index', match.current_question_index);

    if (!allActions) return;

    const player1Actions = allActions.filter(a => a.user_id === match.player1_id);
    const player2Actions = allActions.filter(a => a.user_id === match.player2_id);
    
    const currentQuestion = match.questions[match.current_question_index];
    
    // Check if both players have completed all steps or time ran out
    const player1Done = player1Actions.length >= currentQuestion.steps.length || timeLeft === 0;
    const player2Done = player2Actions.length >= currentQuestion.steps.length || timeLeft === 0;

    if (player1Done && player2Done) {
      await evaluateQuestionWinner(allActions);
    }
  };

  const evaluateQuestionWinner = async (allActions: PlayerAction[]) => {
    if (!match || !currentUser) return;

    const player1Actions = allActions.filter(a => a.user_id === match.player1_id);
    const player2Actions = allActions.filter(a => a.user_id === match.player2_id);
    
    const player1Marks = player1Actions.reduce((sum, a) => sum + a.marks_earned, 0);
    const player2Marks = player2Actions.reduce((sum, a) => sum + a.marks_earned, 0);

    // Update tug-of-war position
    let newPosition = tugOfWarPosition;
    if (player1Marks > player2Marks) {
      newPosition = tugOfWarPosition + 1;
    } else if (player2Marks > player1Marks) {
      newPosition = tugOfWarPosition - 1;
    }
    setTugOfWarPosition(newPosition);

    // Update match scores (wins, not total marks)
    const newPlayer1Score = match.player1_score + (player1Marks > player2Marks ? 1 : 0);
    const newPlayer2Score = match.player2_score + (player2Marks > player1Marks ? 1 : 0);

    // Move to next question or end match
    if (match.current_question_index < match.questions.length - 1) {
      await supabase
        .from('matches')
        .update({
          current_question_index: match.current_question_index + 1,
          player1_score: newPlayer1Score,
          player2_score: newPlayer2Score,
        })
        .eq('id', matchId);
    } else {
      await endMatch(newPlayer1Score, newPlayer2Score);
    }
  };

  const handleAnswer = async (answerIndex: number) => {
    if (!match || !currentUser || selectedAnswer !== null || waitingForOpponent) return;

    setSelectedAnswer(answerIndex);
    setShowFeedback(true);

    const currentQuestion = match.questions[match.current_question_index];
    const currentStepData = currentQuestion.steps[currentStep];
    const isCorrect = answerIndex === currentStepData.correctAnswer;
    const marksEarned = isCorrect ? currentStepData.marks : 0;

    // Submit answer
    await supabase.from('player_actions').insert({
      match_id: match.id,
      user_id: currentUser,
      question_index: match.current_question_index,
      step_index: currentStep,
      answer: answerIndex,
      is_correct: isCorrect,
      marks_earned: marksEarned,
    });

    setTimeout(() => {
      handleNextStep();
    }, 2000);
  };

  const handleNextStep = async () => {
    if (!match) return;

    const currentQuestion = match.questions[match.current_question_index];
    
    if (currentStep < currentQuestion.steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      // Player finished all steps, wait for opponent
      setWaitingForOpponent(true);
      await checkQuestionCompletion();
    }
  };

  const endMatch = async (finalPlayer1Score?: number, finalPlayer2Score?: number) => {
    if (!match) return;

    const p1Score = finalPlayer1Score ?? match.player1_score;
    const p2Score = finalPlayer2Score ?? match.player2_score;

    const winnerId = p1Score > p2Score ? match.player1_id : 
                     p2Score > p1Score ? match.player2_id : null;

    await supabase
      .from('matches')
      .update({
        status: 'completed',
        winner_id: winnerId,
        player1_score: p1Score,
        player2_score: p2Score,
        completed_at: new Date().toISOString(),
      })
      .eq('id', match.id);
  };

  if (!match || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading battle...</div>
      </div>
    );
  }

  const currentQuestion = match.questions[match.current_question_index];
  const currentStepData = currentQuestion?.steps?.[currentStep];
  const isPlayer1 = currentUser === match.player1_id;
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalTime = currentQuestion ? currentQuestion.totalMarks * 60 : 300;
  const timeProgress = (timeLeft / totalTime) * 100;

  if (match.status === 'completed') {
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
            {match.player1_score} - {match.player2_score}
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
            Question {match.current_question_index + 1}/{match.questions.length}
          </div>
        </div>

        {/* Tug of War Bar */}
        <div className="mb-8">
          <TugOfWarBar position={tugOfWarPosition} maxSteps={match.questions.length} />
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
          <div className={`p-4 rounded-lg ${isPlayer1 ? 'bg-primary/20' : 'bg-secondary/20'}`}>
            <div className="text-sm mb-2">YOU</div>
            <div className="text-3xl font-bold">
              {isPlayer1 ? match.player1_score : match.player2_score}
            </div>
          </div>
          <div className={`p-4 rounded-lg ${!isPlayer1 ? 'bg-primary/20' : 'bg-secondary/20'}`}>
            <div className="text-sm mb-2">OPPONENT</div>
            <div className="text-3xl font-bold">
              {!isPlayer1 ? match.player1_score : match.player2_score}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <Progress 
            value={((currentStep + 1) / currentQuestion.steps.length) * 100} 
            className="h-2"
          />
          <div className="text-sm text-center mt-2">
            Step {currentStep + 1} of {currentQuestion.steps.length}
          </div>
        </div>

        {/* Question */}
        {waitingForOpponent ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card p-8 rounded-lg text-center"
          >
            <h2 className="text-3xl font-bold mb-4">Waiting for opponent...</h2>
            <p className="text-muted-foreground">They're still working on this question</p>
          </motion.div>
        ) : (
          currentStepData && (
            <motion.div
              key={`${match.current_question_index}-${currentStep}`}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-card p-8 rounded-lg"
            >
              <h2 className="text-2xl font-bold mb-2">{currentStepData.question}</h2>
              <div className="text-sm text-muted-foreground mb-6">
                {currentStepData.marks} mark{currentStepData.marks !== 1 ? 's' : ''}
              </div>
              
              <div className="grid gap-4">
                {currentStepData.options.map((option: string, idx: number) => (
                  <Button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    disabled={selectedAnswer !== null}
                    variant={
                      selectedAnswer === idx
                        ? idx === currentStepData.correctAnswer
                          ? 'default'
                          : 'destructive'
                        : 'outline'
                    }
                    className="h-auto p-4 text-left justify-start"
                  >
                    {option}
                  </Button>
                ))}
              </div>

              {showFeedback && selectedAnswer !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-lg bg-muted"
                >
                  <p className="font-semibold mb-2">
                    {selectedAnswer === currentStepData.correctAnswer ? '✅ Correct!' : '❌ Incorrect'}
                  </p>
                  <p>{currentStepData.explanation}</p>
                </motion.div>
              )}
            </motion.div>
          )
        )}
      </div>
    </div>
  );
};