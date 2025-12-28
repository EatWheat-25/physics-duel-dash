import { motion } from 'framer-motion';

interface PlayerInfo {
  name: string;
  subtitle: string;
}

interface MatchupIntroProps {
  left: PlayerInfo;
  right: PlayerInfo;
  active: boolean;
  onComplete?: () => void;
}

export function MatchupIntro({ left, right, active, onComplete }: MatchupIntroProps) {
  if (!active) return null;
  
  return (
    <motion.div 
      className="flex items-center justify-center gap-8 text-center w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => onComplete?.()}
    >
      <div className="flex-1 text-right">
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-3xl font-bold text-primary">{left.name}</div>
          <div className="text-sm text-muted-foreground uppercase tracking-wider">{left.subtitle}</div>
        </motion.div>
      </div>
      
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, type: 'spring' }}
        className="text-5xl font-bold text-accent"
      >
        VS
      </motion.div>
      
      <div className="flex-1 text-left">
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-3xl font-bold text-destructive">{right.name}</div>
          <div className="text-sm text-muted-foreground uppercase tracking-wider">{right.subtitle}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}
