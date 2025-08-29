import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import TugOfWarBar from './TugOfWarBar';
import AnimatedBackground from './AnimatedBackground';
import { Question } from '@/data/questions';

interface BattlePageProps {
  onGoBack: () => void;
  questions: Question[];
}

const BattlePageNew: React.FC<BattlePageProps> = ({ onGoBack, questions }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [tugPosition, setTugPosition] = useState(0); // -4 to 4
  const [gameOver, setGameOver] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);

  const maxSteps = 4;

  const handleAnswer = (answerIndex: number) => {
    if (showFeedback || gameOver) return;

    setSelectedAnswer(answerIndex);
    const correct = answerIndex === questions[currentQuestion].answer;
    setIsCorrect(correct);
    setShowFeedback(true);

    // Update tug position
    const newPosition = correct ? tugPosition + 1 : tugPosition - 1;
    setTugPosition(newPosition);

    // Check for game end
    if (Math.abs(newPosition) >= maxSteps) {
      setWinner(newPosition >= maxSteps ? 'player' : 'opponent');
      setGameOver(true);
    }

    // Auto advance after feedback
    setTimeout(() => {
      if (Math.abs(newPosition) < maxSteps && currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
      } else if (Math.abs(newPosition) < maxSteps) {
        // No more questions, determine winner by position
        setWinner(newPosition > 0 ? 'player' : newPosition < 0 ? 'opponent' : null);
        setGameOver(true);
      }
    }, 2000);
  };

  const getButtonStyle = (index: number) => {
    if (!showFeedback) return 'valorant-button-accent';
    if (index === questions[currentQuestion].answer) return 'bg-battle-success text-white';
    if (index === selectedAnswer && !isCorrect) return 'bg-battle-danger text-white';
    return 'bg-white/10 text-muted-foreground';
  };

  if (gameOver) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <AnimatedBackground />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="valorant-card p-8 text-center max-w-md relative z-10"
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
            {!winner && (
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                DRAW
              </span>
            )}
          </h2>
          
          <p className="text-muted-foreground mb-6">
            {winner === 'player' && "Outstanding performance! You dominated the physics battlefield."}
            {winner === 'opponent' && "Better luck next time. Study harder and come back stronger!"}
            {!winner && "A perfectly balanced battle. Both warriors showed equal skill."}
          </p>

          <button 
            onClick={onGoBack}
            className="valorant-button w-full"
          >
            Return to Dashboard
          </button>
        </motion.div>
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
          Physics Battle Arena
        </h1>
        
        <div className="text-sm text-muted-foreground">
          Question {currentQuestion + 1} / {questions.length}
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-6 space-y-8">
        {/* Tug of War Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TugOfWarBar position={tugPosition} maxSteps={maxSteps} />
        </motion.div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="valorant-card p-8"
          >
            <h2 className="text-xl font-semibold mb-6 text-center">
              {questions[currentQuestion].q}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questions[currentQuestion].options.map((option, index) => (
                <motion.button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  className={`p-4 rounded-xl text-left transition-all duration-300 ${getButtonStyle(index)}`}
                  disabled={showFeedback}
                  whileHover={!showFeedback ? { scale: 1.02 } : {}}
                  whileTap={!showFeedback ? { scale: 0.98 } : {}}
                >
                  <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                  {option}
                </motion.button>
              ))}
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-center"
                >
                  <div className={`text-lg font-bold ${isCorrect ? 'text-battle-success' : 'text-battle-danger'}`}>
                    {isCorrect ? '✅ Correct!' : '❌ Wrong!'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {isCorrect ? 'You pushed forward!' : 'Opponent gains ground!'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BattlePageNew;