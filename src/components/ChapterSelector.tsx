import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Play, Star, Trophy } from 'lucide-react';
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
  
  if (!level) return null;

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

          return (
            <motion.div
              key={chapter.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`valorant-card p-6 ${
                isUnlocked 
                  ? 'hover:scale-[1.02] cursor-pointer' 
                  : 'opacity-60 cursor-not-allowed'
              } transition-all`}
              onClick={() => isUnlocked && onSelectChapter(chapter)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl ${
                    isUnlocked 
                      ? 'bg-gradient-to-r from-primary to-accent' 
                      : 'bg-secondary/30'
                  }`}>
                    {isUnlocked ? chapter.icon : <Lock className="w-8 h-8" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">{chapter.title}</h3>
                    <p className="text-muted-foreground mb-2">{chapter.description}</p>
                    
                    {isUnlocked ? (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          {completedQuestions}/{totalQuestions} Questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          Available
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Unlocks at:
                        </span>
                        <RankBadge rank={requiredRank} size="sm" />
                      </div>
                    )}
                  </div>
                </div>
                
                {isUnlocked && (
                  <button className="valorant-button-accent p-3">
                    <Play className="w-5 h-5" />
                  </button>
                )}
              </div>

              {isUnlocked && totalQuestions > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{((completedQuestions / totalQuestions) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-secondary/30 rounded-full h-2">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${(completedQuestions / totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Stats Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="valorant-card p-4 max-w-md mx-auto"
      >
        <h3 className="font-bold mb-2">Your Progress</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Unlocked:</span>
            <div className="font-bold">{unlockedChapters.length}/{level.chapters.length}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Current Rank:</span>
            <div className="mt-1">
              <RankBadge rank={userData.currentRank} size="sm" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChapterSelector;