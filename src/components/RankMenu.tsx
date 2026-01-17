import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { RANKS, RankTier } from '@/types/ranking';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RankMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMMR?: number;
}

export function RankMenu({ open, onOpenChange, currentMMR = 0 }: RankMenuProps) {
  // Group ranks by tier
  const ranksByTier: Record<RankTier, typeof RANKS> = {
    'Bronze': [],
    'Silver': [],
    'Gold': [],
    'Platinum': [],
    'Diamond': [],
    'Ruby': [],
  };

  RANKS.forEach(rank => {
    ranksByTier[rank.tier].push(rank);
  });

  const tierOrder: RankTier[] = [
    'Bronze',
    'Silver',
    'Gold',
    'Platinum',
    'Diamond',
    'Ruby',
  ];

  const getCurrentRankIndex = () => {
    const currentRank = RANKS.find(r => 
      currentMMR >= r.minPoints && currentMMR <= r.maxPoints
    );
    if (!currentRank) return -1;
    return RANKS.findIndex(r => 
      r.tier === currentRank.tier && r.subRank === currentRank.subRank
    );
  };

  const currentRankIndex = getCurrentRankIndex();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#060914] border border-white/20 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" style={{ color: 'var(--aqua)' }} />
            Ranking System
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {tierOrder.map((tier, tierIndex) => {
            const tierRanks = ranksByTier[tier];
            if (tierRanks.length === 0) return null;

            const tierData = tierRanks[0];
            const isCurrentTier = tierRanks.some(r => {
              const rankIndex = RANKS.findIndex(rank => 
                rank.tier === r.tier && rank.subRank === r.subRank
              );
              return rankIndex === currentRankIndex;
            });

            return (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: tierIndex * 0.15,
                  ease: [0.23, 1, 0.32, 1]
                }}
                className={`rounded-xl p-6 border-2 transition-all ${
                  isCurrentTier
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-white/10 bg-white/5'
                }`}
                style={{
                  boxShadow: isCurrentTier
                    ? `0 0 30px ${tierData.glowColor}40`
                    : '0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                <div className="flex items-center gap-4 mb-4">
                  {tierData.imageUrl ? (
                    <img 
                      src={tierData.imageUrl} 
                      alt={tier}
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <div className="text-4xl">{tierData.emoji}</div>
                  )}
                  <div className="flex-1">
                    <h3
                      className="text-xl font-bold mb-1"
                      style={{ color: tierData.color }}
                    >
                      {tier}
                      {isCurrentTier && (
                        <span className="ml-2 text-sm text-primary">(Current Tier)</span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {tierRanks.length} sub-rank{tierRanks.length === 1 ? '' : 's'} available
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {tierRanks.map((rank, rankSubIndex) => {
                    const rankIndex = RANKS.findIndex(r => 
                      r.tier === rank.tier && r.subRank === rank.subRank
                    );
                    const isCurrentRank = rankIndex === currentRankIndex;
                    const isUnlocked = currentMMR >= rank.minPoints;

                    return (
                      <motion.div
                        key={`${rank.tier}-${rank.subRank}`}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          duration: 0.4,
                          delay: tierIndex * 0.15 + rankSubIndex * 0.1,
                          ease: [0.23, 1, 0.32, 1]
                        }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        className={`p-4 rounded-lg border transition-all ${
                          isCurrentRank
                            ? 'border-primary bg-primary/20'
                            : isUnlocked
                            ? 'border-white/20 bg-white/10'
                            : 'border-white/5 bg-white/5 opacity-60'
                        }`}
                        style={{
                          boxShadow: isCurrentRank
                            ? `0 0 20px ${rank.glowColor}60`
                            : 'none',
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {rank.imageUrl ? (
                              <img 
                                src={rank.imageUrl} 
                                alt={rank.displayName}
                                className="w-6 h-6 object-contain"
                              />
                            ) : (
                              <span className="text-2xl">{rank.emoji}</span>
                            )}
                            <span
                              className="font-bold text-sm"
                              style={{ color: rank.color }}
                            >
                              {rank.displayName}
                            </span>
                          </div>
                          {isCurrentRank && (
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>
                            {rank.minPoints === 0
                              ? 'Starting rank'
                              : `${rank.minPoints} - ${rank.maxPoints} points`}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <h4 className="font-bold text-sm mb-2 text-primary">How Ranking Works</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Rank points are based on win/loss/draw accuracy</li>
            <li>Accuracy is rounded down to the nearest even percent</li>
            <li>Draws always award +5 points</li>
            <li>Rank up by reaching the required point threshold</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

