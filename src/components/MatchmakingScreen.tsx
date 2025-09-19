import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Clock, Target, X } from 'lucide-react';

const MatchmakingScreen: React.FC = () => {
  const [countdown, setCountdown] = useState(10);
  const [matchFound, setMatchFound] = useState(false);
  const [searchingPlayers, setSearchingPlayers] = useState(1);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { subject, mode } = location.state || { subject: 'math', mode: 'A1' };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setMatchFound(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Simulate player count fluctuation
    const playerTimer = setInterval(() => {
      setSearchingPlayers(Math.floor(Math.random() * 5) + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(playerTimer);
    };
  }, []);

  useEffect(() => {
    if (matchFound) {
      // Redirect to game after match is found
      setTimeout(() => {
        if (subject === 'math') {
          navigate('/battle', { state: { level: mode } });
        } else {
          navigate('/physics-battle', { state: { level: mode } });
        }
      }, 2000);
    }
  }, [matchFound, navigate, subject, mode]);

  const handleCancel = () => {
    navigate('/');
  };

  const getModeTitle = () => {
    const modeMap: { [key: string]: string } = {
      'A1': 'A1 Level',
      'A2_ONLY': 'A2 Only',
      'A2': 'A1 + A2 Mixed'
    };
    return modeMap[mode] || mode;
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

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-12">
        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          className="absolute top-8 right-8 p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {!matchFound ? (
          <>
            {/* Matchmaking Title */}
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Finding Match
              </h1>
              <p className="text-xl text-muted-foreground">
                {subject === 'math' ? 'Mathematics' : 'Physics'} • {getModeTitle()}
              </p>
            </motion.div>

            {/* Countdown Timer */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-12"
            >
              <div className="relative w-48 h-48 mx-auto">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    className="text-muted"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-primary"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: (10 - countdown) / 10 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      strokeDasharray: "283",
                      strokeDashoffset: "283"
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-6xl font-bold text-primary"
                  >
                    {countdown}
                  </motion.div>
                  <p className="text-sm text-muted-foreground mt-2">seconds</p>
                </div>
              </div>
            </motion.div>

            {/* Status Information */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-6 text-center"
            >
              <div className="flex items-center justify-center gap-2 text-accent">
                <Clock className="w-5 h-5" />
                <span className="text-lg font-medium">Estimated wait time: {countdown}s</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Users className="w-5 h-5" />
                <span>Players searching: {searchingPlayers}</span>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Target className="w-5 h-5" />
                <span>Skill-based matchmaking active</span>
              </div>
            </motion.div>

            {/* Searching Animation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-12"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Searching</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                      className="w-2 h-2 bg-primary rounded-full"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        ) : (
          <>
            {/* Match Found */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="w-24 h-24 mx-auto mb-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center"
              >
                <Users className="w-12 h-12 text-white" />
              </motion.div>
              
              <h1 className="text-5xl font-bold mb-4 text-green-500">
                MATCH FOUND!
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Entering battle arena...
              </p>
              
              <div className="flex items-center justify-center gap-2">
                <span className="text-muted-foreground">Loading</span>
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
                      className="w-2 h-2 bg-green-500 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default MatchmakingScreen;