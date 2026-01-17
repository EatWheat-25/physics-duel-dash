import React from 'react';
import { motion } from 'framer-motion';
import { RankHistory as RankHistoryType } from '@/types/ranking';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RankHistoryProps {
  history: RankHistoryType[];
}

const RankHistory: React.FC<RankHistoryProps> = ({ history }) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPointsChange = (points: number) => {
    return points > 0 ? `+${points}` : points.toString();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Recent Matches
      </h3>
      
      <div className="space-y-2">
        {history.slice(0, 5).map((match, index) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${
                match.outcome === 'win'
                  ? 'bg-battle-success'
                  : match.outcome === 'draw'
                  ? 'bg-battle-warning'
                  : 'bg-battle-danger'
              }`} />
              
              <div className="text-xs">
                <div className="text-muted-foreground">
                  {formatDate(match.date)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                match.pointsChange > 0
                  ? 'text-battle-success'
                  : match.pointsChange < 0
                  ? 'text-battle-danger'
                  : 'text-battle-warning'
              }`}>
                {match.pointsChange > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : match.pointsChange < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <span className="w-3 h-3 inline-flex items-center justify-center">•</span>
                )}
                {formatPointsChange(match.pointsChange)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {history.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-4">
          No matches played yet
        </div>
      )}
    </div>
  );
};

export default RankHistory;