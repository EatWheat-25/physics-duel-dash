import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Trophy, Lock, ChevronRight } from 'lucide-react';
import { PHYSICS_LEVELS, getUnlockedChapters } from '@/types/physics';
import { UserRankData } from '@/types/ranking';

interface PhysicsLevelSelectorProps {
  userData: UserRankData;
  onSelectLevel: (levelId: 'A1' | 'A2') => void;
  onBack: () => void;
}

const PhysicsLevelSelector: React.FC<PhysicsLevelSelectorProps> = ({
  userData,
  onSelectLevel,
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

      <div className="grid gap-6 max-w-4xl mx-auto">
        {PHYSICS_LEVELS.map((level, index) => {
          const unlockedChapters = getUnlockedChapters(level.id, userData.currentPoints);
          const totalChapters = level.chapters.length;
          const progressPercentage = (unlockedChapters.length / totalChapters) * 100;

          return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2 }}
              className="valorant-card p-6 hover:scale-[1.02] transition-transform cursor-pointer"
              onClick={() => onSelectLevel(level.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-primary to-accent flex items-center justify-center text-2xl">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">{level.title}</h3>
                    <p className="text-muted-foreground mb-2">{level.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        {unlockedChapters.length}/{totalChapters} Chapters
                      </span>
                      <span className="text-primary">
                        {progressPercentage.toFixed(0)}% Unlocked
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground" />
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-secondary/30 rounded-full h-2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1, delay: index * 0.2 + 0.5 }}
                  />
                </div>
              </div>

              {/* Chapter Preview */}
              <div className="mt-4 flex gap-2 flex-wrap">
                {level.chapters.slice(0, 6).map((chapter, chapterIndex) => {
                  const isUnlocked = userData.currentPoints >= chapter.requiredRankPoints;
                  return (
                    <div
                      key={chapter.id}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                        isUnlocked 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-secondary/20 text-muted-foreground'
                      }`}
                    >
                      {isUnlocked ? (
                        <span>{chapter.icon}</span>
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      {chapter.title}
                    </div>
                  );
                })}
                {level.chapters.length > 6 && (
                  <div className="px-2 py-1 rounded-md text-xs bg-secondary/20 text-muted-foreground">
                    +{level.chapters.length - 6} more
                  </div>
                )}
              </div>
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