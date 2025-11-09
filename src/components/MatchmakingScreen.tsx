import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMatchmaking } from '@/hooks/useMatchmaking';

const MatchmakingScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { subject, chapter } = location.state || { subject: 'math', chapter: 'A1' };
  const { createInstantMatch } = useMatchmaking(subject, chapter);

  useEffect(() => {
    createInstantMatch();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.1, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center"
      >
        <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
        <h1 className="text-4xl font-bold mb-2">Preparing Battle</h1>
        <p className="text-muted-foreground">Starting your match...</p>
      </motion.div>
    </div>
  );
};

export default MatchmakingScreen;
