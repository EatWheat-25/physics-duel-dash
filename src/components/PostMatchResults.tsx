import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RankBadge from '@/components/RankBadge';
import { UserRankData, getRankByPoints, RANKS } from '@/types/ranking';

interface MatchStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  playerScore: number;
  opponentScore: number;
  pointsEarned: number;
  won: boolean;
}

interface PostMatchResultsProps {
  matchStats: MatchStats;
  userData: UserRankData;
  onContinue: () => void;
}

const PostMatchResults: React.FC<PostMatchResultsProps> = ({
  matchStats,
  userData,
  onContinue
}) => {
  const [showResults, setShowResults] = useState(false);
  const [animatePoints, setAnimatePoints] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [showRankUp, setShowRankUp] = useState(false);

  const previousPoints = userData.currentPoints - matchStats.pointsEarned;
  const previousRank = getRankByPoints(previousPoints);
  const currentRank = getRankByPoints(userData.currentPoints);
  const nextRank = getRankByPoints(currentRank.maxPoints + 1);
  const hasRankedUp = previousRank.name !== currentRank.name;

  const accuracy = Math.round((matchStats.correctAnswers / matchStats.totalQuestions) * 100);
  const progressInCurrentRank = ((userData.currentPoints - currentRank.minPoints) / (currentRank.maxPoints - currentRank.minPoints)) * 100;
  const previousProgressInRank = Math.max(0, ((previousPoints - currentRank.minPoints) / (currentRank.maxPoints - currentRank.minPoints)) * 100);

  const getPerformanceHighlight = () => {
    if (matchStats.pointsEarned >= 50) return "FLAWLESS VICTORY!";
    if (matchStats.pointsEarned >= 30) return "DOMINANT WIN!";
    if (matchStats.pointsEarned >= 20) return "SOLID VICTORY!";
    if (matchStats.pointsEarned >= 10) return "CLOSE BATTLE";
    if (matchStats.pointsEarned > 0) return "NARROW WIN";
    return "DEFEAT";
  };

  const getPerformanceColor = () => {
    if (matchStats.pointsEarned >= 30) return "text-battle-success";
    if (matchStats.pointsEarned >= 10) return "text-battle-warning";
    return "text-battle-danger";
  };

  useEffect(() => {
    const timer1 = setTimeout(() => setShowResults(true), 500);
    const timer2 = setTimeout(() => setAnimatePoints(true), 1000);
    const timer3 = setTimeout(() => setAnimateProgress(true), 1500);
    const timer4 = setTimeout(() => {
      if (hasRankedUp) setShowRankUp(true);
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [hasRankedUp]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full"
      >
        {/* Header */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={showResults ? { y: 0, opacity: 1 } : {}}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className={`text-4xl font-bold mb-2 ${getPerformanceColor()}`}>
            {matchStats.won ? "VICTORY" : "DEFEAT"}
          </div>
          <div className={`text-xl ${getPerformanceColor()}`}>
            {getPerformanceHighlight()}
          </div>
        </motion.div>

        {/* Points Earned */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={animatePoints ? { scale: 1, opacity: 1 } : {}}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center mb-8"
        >
          <div className="text-6xl font-bold text-battle-primary mb-2">
            {matchStats.pointsEarned > 0 ? '+' : ''}{matchStats.pointsEarned}
          </div>
          <div className="text-lg text-muted-foreground">POINTS EARNED</div>
        </motion.div>

        {/* Rank Progress Section */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={showResults ? { y: 0, opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          className="valorant-card p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <RankBadge rank={currentRank.name} size="lg" />
              <div>
                <div className="text-lg font-bold">{currentRank.name}</div>
                <div className="text-sm text-muted-foreground">
                  {userData.currentPoints} / {currentRank.maxPoints} XP
                </div>
              </div>
            </div>
            <ArrowRight className="text-muted-foreground" size={24} />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-lg font-bold">{nextRank.name}</div>
                <div className="text-sm text-muted-foreground">
                  {currentRank.maxPoints + 1} XP
                </div>
              </div>
              <RankBadge rank={nextRank.name} size="lg" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${currentRank.color}, ${currentRank.color}cc)`,
                boxShadow: `0 0 20px ${currentRank.color}40`,
              }}
              initial={{ width: `${previousProgressInRank}%` }}
              animate={animateProgress ? { width: `${progressInCurrentRank}%` } : {}}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>

          {/* Rank Up Celebration */}
          <AnimatePresence>
            {showRankUp && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <RankBadge rank={currentRank.name} size="lg" />
                  </motion.div>
                  <div className="text-2xl font-bold text-battle-success mt-4">
                    RANK UP!
                  </div>
                  <div className="text-lg text-muted-foreground">
                    Welcome to {currentRank.name}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Summary */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={showResults ? { x: 0, opacity: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="valorant-card p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-battle-primary" size={20} />
              <h3 className="text-lg font-bold">PERFORMANCE</h3>
            </div>

            {/* Accuracy Circle */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="2"
                  />
                  <motion.path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--battle-success))"
                    strokeWidth="2"
                    initial={{ strokeDasharray: "0 100" }}
                    animate={animateProgress ? { strokeDasharray: `${accuracy} 100` } : {}}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-battle-success">
                      {accuracy}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ACCURACY
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-battle-success">
                  {matchStats.correctAnswers}
                </div>
                <div className="text-xs text-muted-foreground">CORRECT</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-battle-danger">
                  {matchStats.wrongAnswers}
                </div>
                <div className="text-xs text-muted-foreground">WRONG</div>
              </div>
            </div>
          </motion.div>

          {/* Match Breakdown */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={showResults ? { x: 0, opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className="valorant-card p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="text-battle-warning" size={20} />
              <h3 className="text-lg font-bold">MATCH BREAKDOWN</h3>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Questions</span>
                <span className="font-bold">{matchStats.totalQuestions}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Your Score</span>
                <span className="font-bold text-battle-primary">
                  {matchStats.playerScore}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Opponent Score</span>
                <span className="font-bold text-battle-danger">
                  {matchStats.opponentScore}
                </span>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Final Result</span>
                  <span className={`font-bold ${matchStats.won ? 'text-battle-success' : 'text-battle-danger'}`}>
                    {matchStats.won ? 'VICTORY' : 'DEFEAT'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Continue Button */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={showResults ? { y: 0, opacity: 1 } : {}}
          transition={{ delay: 1.0 }}
          className="text-center mt-8"
        >
          <Button
            onClick={onContinue}
            className="valorant-button px-8 py-3 text-lg"
          >
            <Trophy size={20} className="mr-2" />
            CONTINUE
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PostMatchResults;