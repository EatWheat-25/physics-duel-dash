import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star } from 'lucide-react';
import RankBadge from './RankBadge';
import { RankName } from '@/types/ranking';

interface RankUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  newRank: RankName;
  pointsGained: number;
}

const RankUpModal: React.FC<RankUpModalProps> = ({ 
  isOpen, 
  onClose, 
  newRank, 
  pointsGained 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: 10, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              duration: 0.6
            }}
            className="valorant-card p-8 max-w-md w-full text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Celebration particles */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-primary rounded-full"
                  initial={{ 
                    scale: 0,
                    x: '50%',
                    y: '50%',
                    opacity: 0
                  }}
                  animate={{ 
                    scale: [0, 1, 0],
                    x: `${50 + (Math.cos(i * 30 * Math.PI / 180) * 100)}%`,
                    y: `${50 + (Math.sin(i * 30 * Math.PI / 180) * 100)}%`,
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 2,
                    delay: 0.5 + (i * 0.1),
                    ease: "easeOut"
                  }}
                />
              ))}
            </div>

            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: 2,
                delay: 0.3
              }}
              className="text-6xl mb-4"
            >
              🎉
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
            >
              RANK UP!
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-muted-foreground mb-6"
            >
              Congratulations! You've reached a new rank!
            </motion.p>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-6"
            >
              <RankBadge rank={newRank} showAnimation={true} size="lg" />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-2 mb-6"
            >
              <Star className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                +{pointsGained} points earned
              </span>
              <Star className="w-4 h-4 text-primary" />
            </motion.div>

            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={onClose}
              className="valorant-button w-full"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RankUpModal;