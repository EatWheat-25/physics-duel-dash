import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Play, Star, Trophy, Sparkles, Crown } from 'lucide-react';
import { Chapter, getUnlockedChapters, PHYSICS_LEVELS } from '@/types/physics';
import { UserRankData, getRankByPoints } from '@/types/ranking';
import RankBadge from './RankBadge';

interface ChapterSelectorProps {
  levelId: 'A1' | 'A2';
  userData: UserRankData;
  onSelectChapter: (chapter: Chapter) => void;
  onBack: () => void;
}

const ChapterSelector: React.FC<ChapterSelectorProps> = ({
  levelId,
  userData,
  onSelectChapter,
  onBack
}) => {
  const level = PHYSICS_LEVELS.find(l => l.id === levelId);
  const unlockedChapters = getUnlockedChapters(levelId, userData.currentPoints);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState<string[]>([]);
  
  if (!level) return null;

  // Helper function to get unlock status description
  const getUnlockDescription = (points: number): string => {
    if (points >= 1200) return "Diamond Rank - Full Access";
    if (points >= 1000) return "Platinum 2+ - Advanced Integration";
    if (points >= 900) return "Platinum 1 - Final Chapter";
    if (points >= 800) return "Gold 3 - Advanced Topics";
    if (points >= 700) return "Gold 2 - Circuit Analysis";
    if (points >= 600) return "Gold 1 - Electricity";
    if (points >= 500) return "Silver 3 - Wave Physics";
    if (points >= 400) return "Silver 2 - Oscillations";
    if (points >= 300) return "Silver 1 - Circular Motion";
    if (points >= 200) return "Bronze 3 - Momentum";
    if (points >= 100) return "Bronze 2 - Energy";
    return "Bronze 1 - Foundation";
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-3xl font-bold">{level.title}</h2>
          <p className="text-muted-foreground">{level.description}</p>
        </div>
      </motion.div>

      <div className="grid gap-4 max-w-4xl mx-auto">
        {level.chapters.map((chapter, index) => {
          const isUnlocked = unlockedChapters.some(c => c.id === chapter.id);
          const requiredRank = getRankByPoints(chapter.requiredRankPoints);
          const completedQuestions = 0; // TODO: Track completed questions
          const totalQuestions = chapter.questions.length;
          const isRecentlyUnlocked = showUnlockAnimation.includes(chapter.id);
          const isDiamondUnlocked = userData.currentPoints >= 1200;
          const isPlatinumIntegration = userData.currentPoints >= 1000 && userData.currentPoints < 1200;

          return (
            <motion.div
              key={chapter.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`valorant-card p-6 relative overflow-hidden ${
                isUnlocked 
                  ? 'hover:scale-[1.02] cursor-pointer' 
                  : 'opacity-60 cursor-not-allowed'
              } transition-all`}
              onClick={() => isUnlocked && onSelectChapter(chapter)}
            >
              {/* Unlock Animation Overlay */}
              <AnimatePresence>
                {isRecentlyUnlocked && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg pointer-events-none"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute top-2 right-2"
                    >
                      <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl relative ${
                    isUnlocked 
                      ? 'bg-gradient-to-r from-primary to-accent' 
                      : 'bg-secondary/30'
                  }`}>
                    {isUnlocked ? (
                      <>
                        <span className="text-2xl">{chapter.icon}</span>
                        {isDiamondUnlocked && (
                          <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400" />
                        )}
                      </>
                    ) : (
                      <Lock className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                      {chapter.title}
                      {isPlatinumIntegration && isUnlocked && (
                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                          INTEGRATION
                        </span>
                      )}
                      {isDiamondUnlocked && isUnlocked && (
                        <span className="text-xs px-2 py-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 rounded-full">
                          MASTERY
                        </span>
                      )}
                    </h3>
                    <p className="text-muted-foreground mb-2">{chapter.description}</p>
                    
                    {isUnlocked ? (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          {completedQuestions}/{totalQuestions} Questions
                        </span>
                        <span className="flex items-center gap-1 text-green-400">
                          <Trophy className="w-4 h-4" />
                          Unlocked
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-3">
                          <span className="text-sm text-muted-foreground pt-1">
                            Unlocks at:
                          </span>
                          <RankBadge rank={requiredRank} size="sm" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {getUnlockDescription(chapter.requiredRankPoints)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {isUnlocked && (
                  <motion.button 
                    className="valorant-button-accent p-3"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play className="w-5 h-5" />
                  </motion.button>
                )}
              </div>

              {isUnlocked && totalQuestions > 0 && (
                <div className="mt-4 relative z-10">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{((completedQuestions / totalQuestions) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-secondary/30 rounded-full h-2">
                    <motion.div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedQuestions / totalQuestions) * 100}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Stats Summary & Progression Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="valorant-card p-6 max-w-2xl mx-auto"
      >
        <h3 className="font-bold mb-4 text-center">A1 Physics Progression System</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <span className="text-muted-foreground text-sm">Unlocked Chapters</span>
            <div className="font-bold text-2xl text-primary">{unlockedChapters.length}/{level.chapters.length}</div>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground text-sm">Current Status</span>
            <div className="mt-1 flex justify-center">
              <RankBadge rank={userData.currentRank} size="sm" />
            </div>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground text-sm">Next Unlock</span>
            <div className="font-bold text-sm text-accent">
              {unlockedChapters.length < level.chapters.length 
                ? `${level.chapters[unlockedChapters.length]?.requiredRankPoints - userData.currentPoints} XP`
                : 'All Unlocked!'
              }
            </div>
          </div>
        </div>

        {/* Progression Guide */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p className="font-semibold text-primary">Chapter Unlock System:</p>
          <p>Bronze: Foundation (Ch 1-4) • Silver: Advanced (Ch 5-7) • Gold: Specialized (Ch 8-10)</p>
          <p>Platinum: Integration & Mastery • Diamond: Full Access to All Chapters</p>
        </div>
      </motion.div>
    </div>
  );
};

export default ChapterSelector;