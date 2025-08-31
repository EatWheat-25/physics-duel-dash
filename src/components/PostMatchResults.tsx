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
  const [pointsCounter, setPointsCounter] = useState(0);

  const previousPoints = userData.currentPoints - matchStats.pointsEarned;
  const previousRank = getRankByPoints(previousPoints);
  const currentRank = getRankByPoints(userData.currentPoints);
  const nextRank = getNextRank(currentRank);
  const hasRankedUp = (previousRank.tier !== currentRank.tier || previousRank.subRank !== currentRank.subRank);

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
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-battle-primary rounded-full opacity-60"
          initial={{ 
            x: Math.random() * window.innerWidth, 
            y: window.innerHeight + 10,
            scale: Math.random() * 0.5 + 0.5 
          }}
          animate={{
            y: -10,
            x: Math.random() * window.innerWidth,
            opacity: [0.6, 1, 0]
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            repeat: Infinity,
            delay: Math.random() * 2
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex items-center justify-center p-4 relative">
      <FloatingParticles />
      
      <div className="max-w-5xl w-full space-y-6 relative z-10">
        
        {/* Victory/Defeat Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -30 }}
          animate={showBanner ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 150, damping: 20 }}
          className="text-center"
        >
          <motion.div 
            className={`text-5xl md:text-7xl font-bold mb-2 ${matchStats.won ? 'text-battle-success' : 'text-battle-danger'}`}
            animate={showBanner ? {
              textShadow: [
                '0 0 20px currentColor',
                '0 0 40px currentColor',
                '0 0 20px currentColor'
              ]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              filter: 'drop-shadow(0 0 10px currentColor)'
            }}
          >
            {matchStats.won ? "VICTORY" : "DEFEAT"}
          </motion.div>
          
          <div className={`flex items-center justify-center gap-2 text-lg font-semibold ${highlight.color}`}>
            <highlight.icon size={20} />
            {highlight.text}
          </div>
        </motion.div>

        {/* Points Earned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showPoints ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <motion.div 
            className="valorant-card p-6 inline-block"
            whileHover={{ scale: 1.05 }}
          >
            <div 
              className={`text-4xl font-bold mb-1 ${matchStats.pointsEarned >= 0 ? 'text-battle-primary' : 'text-battle-danger'}`}
              style={{
                textShadow: '0 0 15px currentColor',
                filter: 'drop-shadow(0 0 8px currentColor)'
              }}
            >
              {pointsCounter > 0 ? '+' : ''}{pointsCounter}
            </div>
            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">XP Points {matchStats.won ? 'Earned' : 'Lost'}</div>
          </motion.div>
        </motion.div>

        {/* Rank Progress Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showPoints ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="valorant-card p-6 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <RankBadge rank={userData.currentRank} size="md" />
              <div>
                <div className="text-xl font-bold">{currentRank.displayName}</div>
                <div className="text-sm text-muted-foreground">
                  {userData.currentPoints} / {currentRank.maxPoints === 99999 ? '∞' : currentRank.maxPoints} XP
                </div>
              </div>
            </div>
            
            {nextRank && (
              <>
                <ArrowRight className="text-muted-foreground mx-3" size={24} />
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xl font-bold">{nextRank.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {nextRank.minPoints} XP
                    </div>
                  </div>
                  <RankBadge rank={{ tier: nextRank.tier, subRank: nextRank.subRank }} size="md" />
                </div>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {nextRank && (
            <div className="relative">
              <div className="h-4 bg-white/10 rounded-full overflow-hidden border border-white/20">
                <motion.div
                  className="h-full rounded-full relative"
                  style={{
                    background: `linear-gradient(90deg, ${currentRank.color}, ${currentRank.color}cc)`,
                    boxShadow: `inset 0 0 10px ${currentRank.color}60, 0 0 15px ${currentRank.color}40`,
                  }}
                  initial={{ width: `${previousProgressInRank}%` }}
                  animate={animateProgress ? { width: `${progressInCurrentRank}%` } : {}}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-60" />
                </motion.div>
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
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

        {/* Performance Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showStats ? { opacity: 1, y: 0 } : {}}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Accuracy */}
          <div className="valorant-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-battle-primary" size={20} />
              <h3 className="text-lg font-bold">ACCURACY</h3>
            </div>

            <div className="flex items-center justify-center mb-4">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--muted) / 0.3)"
                    strokeWidth="2"
                  />
                  <motion.path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--battle-success))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 100" }}
                    animate={animateProgress ? { strokeDasharray: `${accuracy} 100` } : {}}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-bold text-battle-success">{accuracy}%</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-battle-success/10 rounded-lg">
                <div className="text-lg font-bold text-battle-success">{matchStats.correctAnswers}</div>
                <div className="text-xs text-muted-foreground">CORRECT</div>
              </div>
              <div className="text-center p-2 bg-battle-danger/10 rounded-lg">
                <div className="text-lg font-bold text-battle-danger">{matchStats.wrongAnswers}</div>
                <div className="text-xs text-muted-foreground">WRONG</div>
              </div>
            </div>
          </div>

          {/* Match Stats */}
          <div className="valorant-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="text-battle-warning" size={20} />
              <h3 className="text-lg font-bold">MATCH STATS</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                <span className="text-muted-foreground text-sm">Total Questions</span>
                <span className="font-bold">{matchStats.totalQuestions}</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-battle-primary/10 rounded-lg">
                <span className="text-muted-foreground text-sm">Your Score</span>
                <span className="font-bold text-battle-primary">{matchStats.playerScore}</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-battle-danger/10 rounded-lg">
                <span className="text-muted-foreground text-sm">Opponent Score</span>
                <span className="font-bold text-battle-danger">{matchStats.opponentScore}</span>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Score Difference</span>
                  <span className={`font-bold ${matchStats.playerScore > matchStats.opponentScore ? 'text-battle-success' : 'text-battle-danger'}`}>
                    {matchStats.playerScore > matchStats.opponentScore ? '+' : ''}{matchStats.playerScore - matchStats.opponentScore}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Highlights */}
          <div className="valorant-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-battle-success" size={20} />
              <h3 className="text-lg font-bold">HIGHLIGHTS</h3>
            </div>

            <div className="space-y-3">
              <div className={`p-3 rounded-lg border-l-4 ${highlight.color.replace('text-', 'border-')} bg-white/5`}>
                <div className={`flex items-center gap-2 font-bold ${highlight.color}`}>
                  <highlight.icon size={16} />
                  {highlight.text}
                </div>
              </div>

              {matchStats.wrongAnswers === 0 && (
                <div className="p-3 rounded-lg bg-battle-success/10 border border-battle-success/30">
                  <div className="text-battle-success font-semibold text-sm">Perfect Game!</div>
                  <div className="text-xs text-muted-foreground">No mistakes made</div>
                </div>
              )}

              {matchStats.pointsEarned > 20 && matchStats.won && (
                <div className="p-3 rounded-lg bg-battle-primary/10 border border-battle-primary/30">
                  <div className="text-battle-primary font-semibold text-sm">High Scorer!</div>
                  <div className="text-xs text-muted-foreground">Earned {matchStats.pointsEarned} XP</div>
                </div>
              )}

              {hasRankedUp && (
                <div className="p-3 rounded-lg bg-battle-warning/10 border border-battle-warning/30">
                  <div className="text-battle-warning font-semibold text-sm">Promotion!</div>
                  <div className="text-xs text-muted-foreground">Advanced to {currentRank.displayName}</div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showStats ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="flex gap-4 justify-center"
        >
          <Button
            onClick={onContinue}
            className="valorant-button px-6 py-3 text-sm"
          >
            <Trophy size={18} className="mr-2" />
            RETURN TO DASHBOARD
          </Button>
          
          {onPlayAgain && (
            <Button
              onClick={onPlayAgain}
              className="valorant-button-accent px-6 py-3 text-sm"
            >
              <Zap size={18} className="mr-2" />
              PLAY AGAIN
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PostMatchResults;