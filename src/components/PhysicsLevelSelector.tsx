import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Trophy, Lock, Play } from 'lucide-react';
import { PHYSICS_LEVELS, getUnlockedChapters, getQuestionsByRank, A1_CHAPTERS } from '@/types/physics';
import { UserRankData } from '@/types/ranking';

interface PhysicsLevelSelectorProps {
  userData: UserRankData;
  onPlayLevel: (levelId: 'A1' | 'A2') => void;
  onBack: () => void;
}

const PhysicsLevelSelector: React.FC<PhysicsLevelSelectorProps> = ({
  userData,
  onPlayLevel,
  onBack
}) => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-3xl font-bold mb-2">Choose Your Physics Level</h2>
        <p className="text-muted-foreground">
          Select A1 for AS Level or A2 for complete A Level physics
        </p>
      </motion.div>

      <div className="grid gap-8 max-w-2xl mx-auto">
        {PHYSICS_LEVELS.map((level, index) => {
          const unlockedChapters = getUnlockedChapters(level.id, userData.currentPoints);
          const totalChapters = level.chapters.length;
          const progressPercentage = (unlockedChapters.length / totalChapters) * 100;
          const availableQuestions = getQuestionsByRank(level.id, userData.currentPoints, 999).length;

          return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="valorant-card p-8 relative overflow-hidden text-center"
            >
              {/* Level Icon & Title */}
              <div className="mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-primary to-accent flex items-center justify-center text-3xl mx-auto mb-4">
                  <BookOpen className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{level.title}</h3>
                <p className="text-muted-foreground mb-4">{level.description}</p>
              </div>

              {/* Stats */}
              <div className="flex justify-center gap-6 mb-6 text-sm">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span>{unlockedChapters.length}/{totalChapters} Chapters</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent"></span>
                  <span className="text-primary">{availableQuestions} Questions</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Unlocked</span>
                  <span className="text-primary font-semibold">{progressPercentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-secondary/30 rounded-full h-3">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1.2, delay: index * 0.2 + 0.3 }}
                  />
                </div>
              </div>

              {/* Rank Info */}
              <div className="mb-6 p-4 rounded-lg bg-secondary/20">
                <div className="flex items-center justify-center gap-2 text-sm mb-1">
                  <span className="text-muted-foreground">Your Rank:</span>
                  <span className="text-accent font-bold">{userData.currentRank.tier} {userData.currentRank.subRank}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {unlockedChapters.length === 0 ? (
                    `Start at Bronze 1 to unlock chapters`
                  ) : progressPercentage === 100 ? (
                    'Full syllabus unlocked!'
                  ) : (
                    `${Math.round(progressPercentage)}% of syllabus available`
                  )}
                </div>
              </div>

              {/* Play Button */}
              <motion.button 
                className="valorant-button-accent px-8 py-4 text-lg font-bold flex items-center gap-3 mx-auto"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onPlayLevel(level.id)}
                disabled={availableQuestions === 0}
              >
                <Play className="w-6 h-6" />
                Play {level.id} Physics
              </motion.button>

              {availableQuestions === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Rank up to unlock questions
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={onBack}
          className="valorant-button-accent px-6 py-2"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default PhysicsLevelSelector;