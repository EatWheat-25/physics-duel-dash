import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import AnimatedBackground from './AnimatedBackground';
import { StepBasedQuestion, BattleProgress, StepResult } from '@/types/stepQuestion';

interface StepMatchStats {
  totalQuestions: number;
  totalSteps: number;
  playerMarks: number;
  opponentMarks: number;
  totalPossibleMarks: number;
  accuracy: number;
  won: boolean;
}

interface StepBattlePageProps {
  onGoBack: () => void;
  questions: StepBasedQuestion[];
  onBattleEnd: (won: boolean, matchStats: StepMatchStats) => void;
}

const StepBattlePage: React.FC<StepBattlePageProps> = ({ onGoBack, questions, onBattleEnd }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [playerMarks, setPlayerMarks] = useState(0);
  const [opponentMarks, setOpponentMarks] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | 'draw' | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentStep = currentQuestion?.steps[currentStepIndex];
  const totalPossibleMarks = questions.reduce((sum, q) => sum + q.totalMarks, 0);
  const totalSteps = questions.reduce((sum, q) => sum + q.steps.length, 0);

  // Calculate progress
  const completedSteps = questions.slice(0, currentQuestionIndex).reduce((sum, q) => sum + q.steps.length, 0) + currentStepIndex;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  const simulateOpponentAnswer = () => {
    // Opponent has 70% accuracy - more challenging than random
    const accuracy = 0.7;
    return Math.random() < accuracy ? currentStep.correctAnswer : Math.floor(Math.random() * currentStep.options.length);
  };

  const handleAnswer = (answerIndex: number) => {
    if (showFeedback || gameOver) return;

    setSelectedAnswer(answerIndex);
    const correct = answerIndex === currentStep.correctAnswer;
    setIsCorrect(correct);
    setShowFeedback(true);

    // Simulate opponent answer
    const opponentAnswer = simulateOpponentAnswer();
    const opponentCorrect = opponentAnswer === currentStep.correctAnswer;

    // Update marks
    const marksEarned = correct ? currentStep.marks : 0;
    const opponentMarksEarned = opponentCorrect ? currentStep.marks : 0;
    
    setPlayerMarks(prev => prev + marksEarned);
    setOpponentMarks(prev => prev + opponentMarksEarned);

    // Store step result
    const stepResult: StepResult = {
      stepId: currentStep.id,
      playerAnswer: answerIndex,
      opponentAnswer,
      correct,
      marksEarned,
      explanation: currentStep.explanation
    };
    setStepResults(prev => [...prev, stepResult]);

    // Auto advance after feedback
    setTimeout(() => {
      moveToNextStep();
    }, 3000);
  };

  const moveToNextStep = () => {
    const isLastStepInQuestion = currentStepIndex === currentQuestion.steps.length - 1;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    if (isLastStepInQuestion) {
      if (isLastQuestion) {
        // Battle complete
        endBattle();
      } else {
        // Move to next question
        setCurrentQuestionIndex(prev => prev + 1);
        setCurrentStepIndex(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
      }
    } else {
      // Move to next step in current question
      setCurrentStepIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    }
  };

  const endBattle = () => {
    const finalPlayerMarks = playerMarks + (isCorrect ? currentStep.marks : 0);
    const finalOpponentMarks = opponentMarks + (simulateOpponentAnswer() === currentStep.correctAnswer ? currentStep.marks : 0);
    
    let finalWinner: 'player' | 'opponent' | 'draw';
    if (finalPlayerMarks > finalOpponentMarks) {
      finalWinner = 'player';
    } else if (finalOpponentMarks > finalPlayerMarks) {
      finalWinner = 'opponent';
    } else {
      finalWinner = 'draw';
    }

    setWinner(finalWinner);
    setGameOver(true);

    const matchStats: StepMatchStats = {
      totalQuestions: questions.length,
      totalSteps,
      playerMarks: finalPlayerMarks,
      opponentMarks: finalOpponentMarks,
      totalPossibleMarks,
      accuracy: (finalPlayerMarks / totalPossibleMarks) * 100,
      won: finalWinner === 'player'
    };

    setTimeout(() => {
      onBattleEnd(finalWinner === 'player', matchStats);
    }, 3000);
  };

  const getButtonStyle = (index: number) => {
    if (!showFeedback) return 'cyber-button-neon';
    if (index === currentStep.correctAnswer) return 'bg-battle-success/20 border-battle-success text-battle-success';
    if (index === selectedAnswer && !isCorrect) return 'bg-battle-danger/20 border-battle-danger text-battle-danger';
    return 'bg-white/5 text-muted-foreground border-white/10';
  };

  if (gameOver) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <AnimatedBackground />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cyber-card p-8 text-center max-w-md relative z-10"
        >
          <div className="text-6xl mb-4">
            {winner === 'player' ? '🏆' : winner === 'opponent' ? '💀' : '🤝'}
          </div>
          
          <h2 className="text-3xl font-bold mb-4">
            {winner === 'player' && (
              <span className="bg-gradient-to-r from-battle-success to-primary bg-clip-text text-transparent">
                VICTORY!
              </span>
            )}
            {winner === 'opponent' && (
              <span className="bg-gradient-to-r from-battle-danger to-accent bg-clip-text text-transparent">
                DEFEAT
              </span>
            )}
            {winner === 'draw' && (
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                DRAW
              </span>
            )}
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="stat-card">
              <div className="stat-number">{playerMarks}</div>
              <div className="stat-label">Your Marks</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{opponentMarks}</div>
              <div className="stat-label">Opponent</div>
            </div>
            <div className="stat-card col-span-2">
              <div className="stat-number">{Math.round((playerMarks / totalPossibleMarks) * 100)}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
          </div>
          
          <p className="text-muted-foreground mb-6 text-sm">
            {winner === 'player' && "Excellent work! You mastered the step-by-step approach."}
            {winner === 'opponent' && "Focus on each step carefully. Practice makes perfect!"}
            {winner === 'draw' && "A close battle! Both showed strong problem-solving skills."}
          </p>

          <button 
            onClick={onGoBack}
            className="cyber-button w-full"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentQuestion || !currentStep) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <AnimatedBackground />
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-6">
        <button 
          onClick={onGoBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Math Battle Arena
        </h1>
        
        <div className="text-sm text-muted-foreground text-right">
          <div>Question {currentQuestionIndex + 1} of {questions.length}</div>
          <div>Step {currentStepIndex + 1} of {currentQuestion.steps.length}</div>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6 space-y-6">
        {/* Battle Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cyber-card p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="text-center">
              <div className="stat-number text-2xl">{playerMarks}</div>
              <div className="stat-label">Your Marks</div>
            </div>
            <div className="flex-1 mx-8">
              <div className="cyber-progress">
                <motion.div 
                  className="cyber-progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="text-center text-sm text-muted-foreground mt-2">
                {Math.round(progressPercentage)}% Complete
              </div>
            </div>
            <div className="text-center">
              <div className="stat-number text-2xl">{opponentMarks}</div>
              <div className="stat-label">Opponent</div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Total Available: {totalPossibleMarks} marks | Current Step: {currentStep.marks} marks
          </div>
        </motion.div>

        {/* Question Context */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="cyber-card p-6 border-2 border-primary/20"
        >
          <h2 className="text-xl font-bold mb-4 text-primary">
            {currentQuestion.title}
          </h2>
          
          {/* Original CAIE Question - Made Prominent */}
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg border border-primary/20 mb-4">
            <h3 className="text-sm font-semibold text-primary mb-2 uppercase tracking-wide">
              CAIE Question
            </h3>
            <p className="text-lg font-medium leading-relaxed text-foreground">
              {currentQuestion.questionText}
            </p>
            <div className="text-right mt-2">
              <span className="text-sm font-bold text-primary">
                [{currentQuestion.totalMarks} marks total]
              </span>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {currentQuestion.topicTags.map((tag, index) => (
              <span key={index} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Current Step */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentQuestionIndex}-${currentStepIndex}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="cyber-card p-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Step {currentStepIndex + 1} of {currentQuestion.steps.length}
              </h3>
              <div className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                {currentStep.marks} marks
              </div>
            </div>
            
            <h4 className="text-xl font-medium mb-6">
              {currentStep.question}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentStep.options.map((option, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  className={`p-4 rounded-xl text-left transition-all duration-300 border ${getButtonStyle(index)}`}
                  disabled={showFeedback}
                  whileHover={!showFeedback ? { scale: 1.02 } : {}}
                  whileTap={!showFeedback ? { scale: 0.98 } : {}}
                >
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                  {option}
                </motion.button>
              ))}
            </div>

            {/* Step Feedback */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className={`text-lg font-bold mb-2 ${isCorrect ? 'text-battle-success' : 'text-battle-danger'}`}>
                    {isCorrect ? `✅ Correct! +${currentStep.marks} marks` : '❌ Incorrect! +0 marks'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentStep.explanation}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StepBattlePage;