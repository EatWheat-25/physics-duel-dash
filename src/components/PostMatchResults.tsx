import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Zap, ArrowRight, Award, TrendingUp, Users, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RankBadge from '@/components/RankBadge';
import { UserRankData, getRankByPoints, getNextRank } from '@/types/ranking';

interface MatchStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  playerScore: number;
  opponentScore: number;
  pointsEarned: number;
  won: boolean;
}

interface StepMatchStats {
  totalQuestions: number;
  totalSteps: number;
  playerMarks: number;
  opponentMarks: number;
  totalPossibleMarks: number;
  accuracy: number;
  won: boolean;
}

interface PostMatchResultsProps {
  matchStats: MatchStats;
  userData: UserRankData;
  onContinue: () => void;
  onPlayAgain?: () => void;
  stepStats?: StepMatchStats;
}

const PostMatchResults: React.FC<PostMatchResultsProps> = ({
  matchStats,
  userData,
  onContinue,
  onPlayAgain,
  stepStats
}) => {
  const [showBanner, setShowBanner] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRankUp, setShowRankUp] = useState(false);
  const [pointsCounter, setPointsCounter] = useState(0);

  const previousPoints = userData.currentPoints - matchStats.pointsEarned;
  const previousRank = getRankByPoints(previousPoints);
  const currentRank = getRankByPoints(userData.currentPoints);
  const nextRank = getNextRank(currentRank);
  const hasRankedUp = (previousRank.tier !== currentRank.tier || previousRank.subRank !== currentRank.subRank);

  const accuracy = Math.round((matchStats.correctAnswers / matchStats.totalQuestions) * 100);
  const pointsIntoRank = Math.max(0, userData.currentPoints - currentRank.minPoints);
  const previousPointsIntoRank = Math.max(0, previousPoints - currentRank.minPoints);
  const pointsToNextRank = nextRank ? (nextRank.minPoints - currentRank.minPoints) : (currentRank.maxPoints - currentRank.minPoints + 1);
  const progressInCurrentRank = pointsToNextRank > 0 ? (pointsIntoRank / pointsToNextRank) * 100 : 0;
  const previousProgressInRank = pointsToNextRank > 0 ? (previousPointsIntoRank / pointsToNextRank) * 100 : 0;

  const getGameHighlight = () => {
    if (matchStats.wrongAnswers === 0 && matchStats.won) return { text: "FLAWLESS VICTORY!", color: "text-battle-success", icon: Star };
    if (Math.abs(matchStats.playerScore - matchStats.opponentScore) === 1) return { text: "CLOSE BATTLE", color: "text-battle-warning", icon: Zap };
    if (matchStats.pointsEarned >= 40) return { text: "DOMINANT WIN!", color: "text-battle-success", icon: Trophy };
    if (matchStats.pointsEarned >= 25) return { text: "SOLID VICTORY", color: "text-battle-primary", icon: Award };
    if (matchStats.won) return { text: "VICTORY", color: "text-battle-success", icon: Trophy };
    return { text: "DEFEAT", color: "text-battle-danger", icon: Target };
  };

  const highlight = getGameHighlight();

  // Animate points counter
  useEffect(() => {
    if (showPoints && pointsCounter !== matchStats.pointsEarned) {
      const increment = matchStats.pointsEarned > 0 ? 1 : -1;
      const timer = setTimeout(() => {
        setPointsCounter(prev => {
          const next = prev + increment;
          return matchStats.pointsEarned > 0 
            ? Math.min(next, matchStats.pointsEarned)
            : Math.max(next, matchStats.pointsEarned);
        });
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [showPoints, pointsCounter, matchStats.pointsEarned]);

  useEffect(() => {
    const timer1 = setTimeout(() => setShowBanner(true), 300);
    const timer2 = setTimeout(() => setShowPoints(true), 800);
    const timer3 = setTimeout(() => setAnimateProgress(true), 1400);
    const timer4 = setTimeout(() => setShowStats(true), 1800);
    const timer5 = setTimeout(() => {
      if (hasRankedUp) setShowRankUp(true);
    }, 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, [hasRankedUp]);

  // Floating particles component
  const FloatingParticles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-battle-primary/40 rounded-full"
          initial={{ 
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200), 
            y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 10,
            scale: Math.random() * 0.3 + 0.2 
          }}
          animate={{
            y: -10,
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
            opacity: [0.2, 0.6, 0]
          }}
          transition={{
            duration: Math.random() * 4 + 3,
            repeat: Infinity,
            delay: Math.random() * 3
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 relative">
      <FloatingParticles />
      
      <div className="max-w-4xl w-full space-y-12 relative z-10">
        
        {/* Victory/Defeat Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={showBanner ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 150, damping: 25 }}
          className="text-center space-y-4"
        >
          <div className={`flex items-center justify-center gap-4`}>
            <motion.div
              animate={showBanner ? { rotate: [0, 5, -5, 0] } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {matchStats.won ? 
                <Trophy className="text-battle-success" size={32} /> : 
                <Target className="text-battle-danger" size={32} />
              }
            </motion.div>
            <motion.div 
              className={`text-4xl md:text-5xl font-light tracking-wide ${matchStats.won ? 'text-battle-success' : 'text-battle-danger'}`}
              animate={showBanner ? {
                filter: [
                  'drop-shadow(0 0 8px currentColor)',
                  'drop-shadow(0 0 16px currentColor)',
                  'drop-shadow(0 0 8px currentColor)'
                ]
              } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {matchStats.won ? "VICTORY" : "DEFEAT"}
            </motion.div>
          </div>
          
          <div className={`text-sm font-medium tracking-wider uppercase opacity-80 ${highlight.color}`}>
            {highlight.text}
          </div>
        </motion.div>

        {/* Points Earned */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={showPoints ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="flex justify-center"
        >
          <div 
            className={`inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm ${
              matchStats.pointsEarned >= 0 ? 'shadow-[0_0_20px_hsl(var(--battle-primary)/0.3)]' : 'shadow-[0_0_20px_hsl(var(--battle-danger)/0.3)]'
            }`}
          >
            <div 
              className={`text-2xl font-bold ${matchStats.pointsEarned >= 0 ? 'text-battle-primary' : 'text-battle-danger'}`}
            >
              {pointsCounter > 0 ? '+' : ''}{pointsCounter}
            </div>
            <div className="text-sm text-muted-foreground font-medium">Points</div>
          </div>
        </motion.div>

        {/* Rank Progress Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showPoints ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <RankBadge rank={userData.currentRank} size="md" />
              <div>
                <div className="text-lg font-semibold">{currentRank.displayName}</div>
                <div className="text-xs text-muted-foreground">
                  {pointsIntoRank} / {pointsToNextRank} Points
                </div>
              </div>
            </div>
            
            {nextRank && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-semibold">{nextRank.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {pointsToNextRank} Points to rank up
                  </div>
                </div>
                <RankBadge rank={{ tier: nextRank.tier, subRank: nextRank.subRank }} size="md" />
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {nextRank && (
            <div className="relative px-4">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, hsl(var(--battle-primary)), hsl(var(--battle-primary)/0.8))`,
                    boxShadow: `0 0 10px hsl(var(--battle-primary)/0.4)`,
                  }}
                  initial={{ width: `${previousProgressInRank}%` }}
                  animate={animateProgress ? { width: `${progressInCurrentRank}%` } : {}}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground mt-3">
                <span>{Math.round(progressInCurrentRank)}% to next rank</span>
                <span>{nextRank.minPoints - userData.currentPoints} XP needed</span>
              </div>
            </div>
          )}

          {/* Rank Up Animation */}
          <AnimatePresence>
            {showRankUp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="relative"
                  >
                    <RankBadge rank={userData.currentRank} size="lg" showAnimation />
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border-2 border-battle-success"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4"
                  >
                    <div className="text-2xl font-bold text-battle-success mb-1 flex items-center justify-center gap-2">
                      <Sparkles size={24} />
                      RANK UP!
                      <Sparkles size={24} />
                    </div>
                    <div className="text-lg text-muted-foreground">Welcome to {currentRank.displayName}</div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Performance Stats - Single Clean Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showStats ? { opacity: 1, y: 0 } : {}}
          className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            
            {/* Accuracy Circle */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="hsl(var(--muted-foreground) / 0.2)"
                      strokeWidth="1.5"
                    />
                    <motion.path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="hsl(var(--battle-success))"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      initial={{ strokeDasharray: "0 100" }}
                      animate={animateProgress ? { strokeDasharray: `${accuracy} 100` } : {}}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-battle-success">{accuracy}%</div>
                      <div className="text-xs text-muted-foreground">Accuracy</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-battle-success">{matchStats.correctAnswers}</div>
                  <div className="text-xs text-muted-foreground">Correct</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-battle-danger">{matchStats.wrongAnswers}</div>
                  <div className="text-xs text-muted-foreground">Wrong</div>
                </div>
              </div>
            </div>

            {/* Match Details */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Questions</span>
                <span className="font-semibold">{matchStats.totalQuestions}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Your Score</span>
                <span className="font-semibold text-battle-primary">{matchStats.playerScore}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Opponent Score</span>
                <span className="font-semibold text-battle-danger">{matchStats.opponentScore}</span>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Score Difference</span>
                  <span className={`font-semibold ${matchStats.playerScore > matchStats.opponentScore ? 'text-battle-success' : 'text-battle-danger'}`}>
                    {matchStats.playerScore > matchStats.opponentScore ? '+' : ''}{Math.abs(matchStats.playerScore - matchStats.opponentScore)}
                  </span>
                </div>
              </div>
            </div>

            {/* Game Highlights */}
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-4 rounded-2xl bg-white/5 border-l-4 ${highlight.color.replace('text-', 'border-')}`}>
                <highlight.icon size={18} className={highlight.color} />
                <span className={`font-semibold text-sm ${highlight.color}`}>{highlight.text}</span>
              </div>

              {matchStats.wrongAnswers === 0 && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-battle-success/10">
                  <Star size={18} className="text-battle-success" />
                  <span className="text-battle-success font-semibold text-sm">Perfect Game!</span>
                </div>
              )}

              {hasRankedUp && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-battle-warning/10">
                  <Sparkles size={18} className="text-battle-warning" />
                  <span className="text-battle-warning font-semibold text-sm">Rank Up!</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showStats ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
          className="flex gap-4 justify-center pt-4"
        >
          {onPlayAgain && (
            <Button
              onClick={onPlayAgain}
              className="px-8 py-4 rounded-2xl bg-battle-primary/20 border border-battle-primary/40 text-battle-primary font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-battle-primary/30 hover:shadow-[0_0_20px_hsl(var(--battle-primary)/0.4)] hover:-translate-y-0.5"
            >
              <Zap size={18} className="mr-2" />
              PLAY AGAIN
            </Button>
          )}
          
          <Button
            onClick={onContinue}
            className="px-8 py-4 rounded-2xl bg-white/10 border border-white/20 text-foreground font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-white/20 hover:-translate-y-0.5"
          >
            <Trophy size={18} className="mr-2" />
            RETURN TO DASHBOARD
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default PostMatchResults;