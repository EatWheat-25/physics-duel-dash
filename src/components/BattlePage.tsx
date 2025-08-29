import React, { useState } from "react";
import { motion } from "framer-motion";

interface BattlePageProps {
  goHome: () => void;
  questions: Array<{
    q: string;
    options: string[];
    answer: number;
  }>;
}

const BattlePage: React.FC<BattlePageProps> = ({ goHome, questions }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const handleAnswer = (idx: number) => {
    if (gameOver || selectedAnswer !== null) return;

    setSelectedAnswer(idx);

    setTimeout(() => {
      if (idx === questions[currentQ].answer) {
        setPlayerProgress((prev) => Math.min(prev + 20, 100));
        setMessage("🎯 Correct!");
      } else {
        setOpponentProgress((prev) => Math.min(prev + 20, 100));
        setMessage("❌ Wrong!");
      }

      setTimeout(() => {
        if (playerProgress >= 80 || opponentProgress >= 80) {
          if (playerProgress >= 80) {
            setMessage("🎉 Victory! You Win!");
          } else {
            setMessage("💀 Defeat! Opponent Wins!");
          }
          setGameOver(true);
        } else if (currentQ < questions.length - 1) {
          setCurrentQ((prev) => prev + 1);
          setSelectedAnswer(null);
          setMessage("");
        } else {
          if (playerProgress > opponentProgress) {
            setMessage("🎉 Victory! You Win!");
          } else if (opponentProgress > playerProgress) {
            setMessage("💀 Defeat! Opponent Wins!");
          } else {
            setMessage("🤝 Draw!");
          }
          setGameOver(true);
        }
      }, 1500);
    }, 500);
  };

  const getButtonVariant = (idx: number) => {
    if (selectedAnswer === null) return "battle-button";
    if (idx === questions[currentQ].answer) return "battle-button bg-battle-success";
    if (idx === selectedAnswer) return "battle-button bg-battle-danger";
    return "battle-button opacity-50";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-foreground p-4">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold mb-8 bg-gradient-to-r from-primary to-battle-secondary bg-clip-text text-transparent"
      >
        ⚔️ Physics Battle
      </motion.h1>

      {/* Progress Bars */}
      <div className="w-full max-w-2xl mb-8">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">🧠 You</span>
            <span className="text-sm opacity-80">{playerProgress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-6 overflow-hidden">
            <motion.div
              className="progress-bar player-progress"
              initial={{ width: 0 }}
              animate={{ width: `${playerProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">🤖 Opponent</span>
            <span className="text-sm opacity-80">{opponentProgress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-6 overflow-hidden">
            <motion.div
              className="progress-bar opponent-progress"
              initial={{ width: 0 }}
              animate={{ width: `${opponentProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Question Section */}
      {!gameOver ? (
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="battle-card p-8 w-full max-w-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Question {currentQ + 1}</h2>
            <span className="text-sm opacity-60">{currentQ + 1} / {questions.length}</span>
          </div>
          
          <h3 className="text-lg mb-6 leading-relaxed">{questions[currentQ].q}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions[currentQ].options.map((opt, idx) => (
              <motion.button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className={getButtonVariant(idx)}
                whileHover={selectedAnswer === null ? { scale: 1.02 } : {}}
                whileTap={selectedAnswer === null ? { scale: 0.98 } : {}}
                disabled={selectedAnswer !== null}
              >
                <span className="font-medium">{String.fromCharCode(65 + idx)})</span> {opt}
              </motion.button>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center battle-card p-8"
        >
          <div className="text-3xl font-bold mb-6">{message}</div>
          <motion.button
            onClick={goHome}
            className="battle-button text-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🏠 Back to Home
          </motion.button>
        </motion.div>
      )}

      {message && !gameOver && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-xl font-semibold"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
};

export default BattlePage;