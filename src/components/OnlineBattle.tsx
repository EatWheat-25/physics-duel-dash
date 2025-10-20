import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ArrowLeft } from 'lucide-react';
import CyberpunkBackground from './CyberpunkBackground';

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

export const OnlineBattle = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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

      // Parse questions if they're stored as JSON
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

  // Subscribe to match updates
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
        (payload) => {
          // Opponent answered, move to next step/question
          if (payload.new.user_id !== currentUser) {
            handleNextStep();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, currentUser]);

  const handleAnswer = async (answerIndex: number) => {
    if (!match || !currentUser || selectedAnswer !== null) return;

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

    // Update match score
    const isPlayer1 = currentUser === match.player1_id;
    const newScore = isPlayer1 
      ? match.player1_score + marksEarned 
      : match.player2_score + marksEarned;

    await supabase
      .from('matches')
      .update(
        isPlayer1 
          ? { player1_score: newScore }
          : { player2_score: newScore }
      )
      .eq('id', match.id);

    setTimeout(() => {
      handleNextStep();
    }, 2000);
  };

  const handleNextStep = () => {
    if (!match) return;

    const currentQuestion = match.questions[match.current_question_index];
    
    if (currentStep < currentQuestion.steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else if (match.current_question_index < match.questions.length - 1) {
      // Move to next question
      supabase
        .from('matches')
        .update({ current_question_index: match.current_question_index + 1 })
        .eq('id', match.id);
      setCurrentStep(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      // Match complete
      endMatch();
    }
  };

  const endMatch = async () => {
    if (!match) return;

    const winnerId = match.player1_score > match.player2_score 
      ? match.player1_id 
      : match.player2_score > match.player1_score 
      ? match.player2_id 
      : null;

    await supabase
      .from('matches')
      .update({
        status: 'completed',
        winner_id: winnerId,
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
        {currentStepData && (
          <motion.div
            key={`${match.current_question_index}-${currentStep}`}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-card p-8 rounded-lg"
          >
            <h2 className="text-2xl font-bold mb-6">{currentStepData.question}</h2>
            
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
        )}
      </div>
    </div>
  );
};
