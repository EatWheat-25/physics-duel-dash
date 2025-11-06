import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, X } from 'lucide-react';
import { useMatchmaking } from '@/hooks/useMatchmaking';

const MatchmakingScreen = () => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { subject, mode, rankTier } = location.state || { subject: 'math', mode: 'A1', rankTier: 'Bronze' };
  const { joinQueue, leaveQueue } = useMatchmaking(subject, mode, rankTier);

  useEffect(() => {
    // Join queue on mount
    joinQueue();

    // Start timer
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      leaveQueue();
    };
  }, []);

  const handleCancel = () => {
    leaveQueue();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.1, 0.3]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/4 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.5
            }}
            className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl"
          />
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col p-12">
        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          className="absolute top-8 right-8 p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Timer at Top Center */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center pt-8"
        >
          <div className="text-4xl font-bold text-primary">
            {elapsedTime}s
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                scale: { duration: 1, repeat: Infinity }
              }}
              className="w-24 h-24 mx-auto mb-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center"
            >
              <Users className="w-12 h-12 text-white" />
            </motion.div>
            
            <h1 className="text-5xl font-bold mb-4">
              FINDING OPPONENT
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Searching for worthy opponent...
            </p>
            
            <div className="flex items-center justify-center gap-2">
              <span className="text-muted-foreground">Searching</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                    className="w-2 h-2 bg-primary rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default MatchmakingScreen;
