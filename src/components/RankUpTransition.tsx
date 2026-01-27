import { AnimatePresence, motion } from 'framer-motion';
import RankBadge from '@/components/RankBadge';
import { RANKS, RankName } from '@/types/ranking';

interface RankUpTransitionProps {
  fromRank: RankName;
  toRank: RankName;
  active: boolean;
}

const findRank = (rank: RankName) =>
  RANKS.find(r => r.tier === rank.tier && r.subRank === rank.subRank) || RANKS[0];

const RankUpTransition = ({ fromRank, toRank, active }: RankUpTransitionProps) => {
  const from = findRank(fromRank);
  const to = findRank(toRank);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="absolute inset-0 z-20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: from.gradient }}
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0"
            style={{ background: to.gradient }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0"
            style={{ boxShadow: `0 0 140px ${to.glowColor}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <div className="absolute inset-x-0 top-6 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-xs font-mono tracking-[0.4em] text-white/80"
            >
              RANK UP
            </motion.div>
          </div>
          <div className="absolute inset-x-0 top-12 flex items-center justify-center gap-6">
            <motion.div
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              <RankBadge rank={{ tier: from.tier, subRank: from.subRank }} size="md" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.2 }}
            >
              <RankBadge rank={{ tier: to.tier, subRank: to.subRank }} size="md" showAnimation />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RankUpTransition;
