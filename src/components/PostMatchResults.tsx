import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Zap, ArrowRight, Award, TrendingUp, Users, Star } from 'lucide-react';
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
  onPlayAgain?: () => void;
}

const PostMatchResults: React.FC<PostMatchResultsProps> = ({
  matchStats,
  userData,
  onContinue,
  onPlayAgain
}) => {
  const [showBanner, setShowBanner] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRankUp, setShowRankUp] = useState(false);

  const previousPoints = userData.currentPoints - matchStats.pointsEarned;
  const previousRank = getRankByPoints(previousPoints);
  const currentRank = getRankByPoints(userData.currentPoints);
  const nextRank = getRankByPoints(currentRank.maxPoints + 1);
  const hasRankedUp = previousRank.name !== currentRank.name;

  const accuracy = Math.round((matchStats.correctAnswers / matchStats.totalQuestions) * 100);
  const progressInCurrentRank = ((userData.currentPoints - currentRank.minPoints) / (currentRank.maxPoints - currentRank.minPoints)) * 100;
  const previousProgressInRank = Math.max(0, ((previousPoints - currentRank.minPoints) / (currentRank.maxPoints - currentRank.minPoints)) * 100);

  const getGameHighlight = () => {
    if (matchStats.wrongAnswers === 0 && matchStats.won) return { text: "FLAWLESS VICTORY!", color: "text-battle-success", icon: Star };
    if (Math.abs(matchStats.playerScore - matchStats.opponentScore) === 1) return { text: "CLOSE BATTLE", color: "text-battle-warning", icon: Zap };
    if (matchStats.pointsEarned >= 40) return { text: "DOMINANT WIN!", color: "text-battle-success", icon: Trophy };
    if (matchStats.pointsEarned >= 25) return { text: "SOLID VICTORY", color: "text-battle-primary", icon: Award };
    if (matchStats.won) return { text: "VICTORY", color: "text-battle-success", icon: Trophy };
    return { text: "DEFEAT", color: "text-battle-danger", icon: Target };
  };

  const highlight = getGameHighlight();

  useEffect(() => {
    const timer1 = setTimeout(() => setShowBanner(true), 300);
    const timer2 = setTimeout(() => setShowPoints(true), 800);
    const timer3 = setTimeout(() => setAnimateProgress(true), 1200);
    const timer4 = setTimeout(() => setShowStats(true), 1600);
    const timer5 = setTimeout(() => {
      if (hasRankedUp) setShowRankUp(true);
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, [hasRankedUp]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full space-y-8">
        
        {/* Victory/Defeat Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={showBanner ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="text-center"
        >
          <div 
            className={`text-6xl md:text-8xl font-black mb-4 ${matchStats.won ? 'text-battle-success' : 'text-battle-danger'}`}
            style={{
              textShadow: matchStats.won 
                ? '0 0 30px hsl(var(--battle-success)), 0 0 60px hsl(var(--battle-success))' 
                : '0 0 30px hsl(var(--battle-danger)), 0 0 60px hsl(var(--battle-danger))',
              filter: 'drop-shadow(0 0 20px currentColor)'
            }}
          >
            {matchStats.won ? "VICTORY" : "DEFEAT"}
          </div>
          
          <div className={`flex items-center justify-center gap-3 text-2xl font-bold ${highlight.color}`}>
            <highlight.icon size={28} />
            {highlight.text}
          </div>
        </motion.div>

        {/* Points Earned */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={showPoints ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-center"
        >
          <div 
            className={`text-5xl font-bold mb-2 ${matchStats.pointsEarned >= 0 ? 'text-battle-primary' : 'text-battle-danger'}`}
            style={{
              textShadow: '0 0 20px currentColor',
              filter: 'drop-shadow(0 0 10px currentColor)'
            }}
          >
            {matchStats.pointsEarned > 0 ? '+' : ''}{matchStats.pointsEarned}
          </div>
          <div className="text-lg text-muted-foreground font-semibold">POINTS EARNED</div>
        </motion.div>

        {/* Rank Progress Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={showPoints ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="valorant-card p-8 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <RankBadge rank={currentRank.name} size="lg" />
              <div>
                <div className="text-2xl font-bold">{currentRank.name}</div>
                <div className="text-muted-foreground">
                  {userData.currentPoints} / {currentRank.maxPoints} XP
                </div>
              </div>
            </div>
            
            <ArrowRight className="text-muted-foreground mx-4" size={32} />
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold">{nextRank.name}</div>
                <div className="text-muted-foreground">
                  {currentRank.maxPoints + 1} XP
                </div>
              </div>
              <RankBadge rank={nextRank.name} size="lg" />
            </div>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="relative">
            <div className="h-6 bg-black/30 rounded-full overflow-hidden border border-white/20">
              <motion.div
                className="h-full rounded-full relative"
                style={{
                  background: `linear-gradient(90deg, ${currentRank.color}, ${currentRank.color}aa)`,
                  boxShadow: `inset 0 0 20px ${currentRank.color}40, 0 0 20px ${currentRank.color}40`,
                }}
                initial={{ width: `${previousProgressInRank}%` }}
                animate={animateProgress ? { width: `${progressInCurrentRank}%` } : {}}
                transition={{ duration: 2, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
              </motion.div>
            </div>
            
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>{Math.round(progressInCurrentRank)}% to next rank</span>
              <span>{currentRank.maxPoints - userData.currentPoints} XP needed</span>
            </div>
          </div>

          {/* Rank Up Animation */}
          <AnimatePresence>
            {showRankUp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 flex items-center justify-center backdrop-blur-sm"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <RankBadge rank={currentRank.name} size="lg" showAnimation />
                  </motion.div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6"
                  >
                    <div className="text-3xl font-bold text-battle-success mb-2">RANK UP!</div>
                    <div className="text-xl text-muted-foreground">Welcome to {currentRank.name}</div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Performance Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={showStats ? { opacity: 1, y: 0 } : {}}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Accuracy Chart */}
          <div className="valorant-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Target className="text-battle-primary" size={24} />
              <h3 className="text-xl font-bold">ACCURACY</h3>
            </div>

            <div className="flex items-center justify-center mb-6">
              <div className="relative w-36 h-36">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--muted) / 0.3)"
                    strokeWidth="3"
                  />
                  <motion.path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--battle-success))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 100" }}
                    animate={animateProgress ? { strokeDasharray: `${accuracy} 100` } : {}}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-battle-success">{accuracy}%</div>
                    <div className="text-sm text-muted-foreground">SUCCESS</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-battle-success/10 rounded-lg">
                <div className="text-2xl font-bold text-battle-success">{matchStats.correctAnswers}</div>
                <div className="text-xs text-muted-foreground">CORRECT</div>
              </div>
              <div className="text-center p-3 bg-battle-danger/10 rounded-lg">
                <div className="text-2xl font-bold text-battle-danger">{matchStats.wrongAnswers}</div>
                <div className="text-xs text-muted-foreground">WRONG</div>
              </div>
            </div>
          </div>

          {/* Match Statistics */}
          <div className="valorant-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="text-battle-warning" size={24} />
              <h3 className="text-xl font-bold">MATCH STATS</h3>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Users size={16} />
                  Total Questions
                </span>
                <span className="font-bold text-lg">{matchStats.totalQuestions}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-battle-primary/10 rounded-lg">
                <span className="text-muted-foreground">Your Score</span>
                <span className="font-bold text-lg text-battle-primary">{matchStats.playerScore}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-battle-danger/10 rounded-lg">
                <span className="text-muted-foreground">Opponent Score</span>
                <span className="font-bold text-lg text-battle-danger">{matchStats.opponentScore}</span>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Score Difference</span>
                  <span className={`font-bold text-lg ${matchStats.playerScore > matchStats.opponentScore ? 'text-battle-success' : 'text-battle-danger'}`}>
                    {matchStats.playerScore > matchStats.opponentScore ? '+' : ''}{matchStats.playerScore - matchStats.opponentScore}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Highlights */}
          <div className="valorant-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="text-battle-success" size={24} />
              <h3 className="text-xl font-bold">HIGHLIGHTS</h3>
            </div>

            <div className="space-y-4">
              <div className={`p-4 rounded-lg border-l-4 ${highlight.color.replace('text-', 'border-')} bg-white/5`}>
                <div className={`flex items-center gap-2 text-lg font-bold ${highlight.color}`}>
                  <highlight.icon size={20} />
                  {highlight.text}
                </div>
              </div>

              {matchStats.wrongAnswers === 0 && (
                <div className="p-4 rounded-lg bg-battle-success/10 border border-battle-success/20">
                  <div className="text-battle-success font-semibold">Perfect Game!</div>
                  <div className="text-sm text-muted-foreground">No mistakes made</div>
                </div>
              )}

              {matchStats.pointsEarned > 30 && (
                <div className="p-4 rounded-lg bg-battle-primary/10 border border-battle-primary/20">
                  <div className="text-battle-primary font-semibold">High Scorer!</div>
                  <div className="text-sm text-muted-foreground">Earned {matchStats.pointsEarned} points</div>
                </div>
              )}

              {hasRankedUp && (
                <div className="p-4 rounded-lg bg-battle-warning/10 border border-battle-warning/20">
                  <div className="text-battle-warning font-semibold">Promotion!</div>
                  <div className="text-sm text-muted-foreground">Advanced to {currentRank.name}</div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={showStats ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="flex gap-4 justify-center"
        >
          <Button
            onClick={onContinue}
            className="valorant-button px-8 py-4 text-lg"
          >
            <Trophy size={20} className="mr-2" />
            RETURN TO DASHBOARD
          </Button>
          
          {onPlayAgain && (
            <Button
              onClick={onPlayAgain}
              className="valorant-button-accent px-8 py-4 text-lg"
            >
              <Zap size={20} className="mr-2" />
              PLAY AGAIN
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PostMatchResults;