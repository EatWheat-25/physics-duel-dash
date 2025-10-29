import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, X } from 'lucide-react';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const MatchmakingScreen = () => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { subject, chapter } = location.state || { subject: 'math', chapter: 'A1' };
  const { joinQueue, leaveQueue } = useMatchmaking(subject, chapter);

  useEffect(() => {
    console.log('🎮 MatchmakingScreen mounted - joining queue for', subject, chapter);
    
    // Join queue on mount
    joinQueue();

    // Check queue count periodically
    const queueCheck = setInterval(async () => {
      const { data, error } = await supabase.from('queue').select('*');
      if (data) {
        console.log('📊 Queue check - players in queue:', data.length, data);
        setQueueCount(data.length);
      }
    }, 2000);

    // Start timer
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(queueCheck);
      leaveQueue();
    };
  }, []);

  const handleCancel = () => {
    leaveQueue();
    navigate('/');
  };

  const handleForceMatch = async () => {
    console.log('🔧 Manually triggering matchmaker...');
    toast.info('Triggering matchmaker manually...');
    
    try {
      const { data, error } = await supabase.functions.invoke('matchmaker_tick');
      
      console.log('🎯 Matchmaker result:', data, error);
      
      if (error) {
        toast.error('Matchmaker failed: ' + error.message);
      } else {
        toast.success(`Matchmaker ran! Made ${data?.matched || 0} matches`);
      }
    } catch (err) {
      console.error('❌ Force match error:', err);
      toast.error('Failed to trigger matchmaker');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      {/* Advanced Animated Background */}
      <div className="absolute inset-0">
        {/* Gradient base */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20"
          animate={{ 
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: '200% 200%' }}
        />
        
        {/* Multiple floating orbs with different speeds */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [0, Math.random() * 200 - 100, 0],
              y: [0, Math.random() * 200 - 100, 0],
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 1.5,
            }}
            className="absolute w-64 h-64 rounded-full blur-3xl"
            style={{
              background: i % 2 === 0 
                ? 'radial-gradient(circle, hsl(var(--primary) / 0.3), transparent)' 
                : 'radial-gradient(circle, hsl(var(--accent) / 0.3), transparent)',
              left: `${20 + i * 15}%`,
              top: `${10 + i * 12}%`,
            }}
          />
        ))}

        {/* Scanning line effect */}
        <motion.div
          className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"
          animate={{ y: ['-100%', '200%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col p-12">
        {/* Cancel Button with hover effect */}
        <motion.button
          onClick={handleCancel}
          className="absolute top-8 right-8 p-3 hover:bg-destructive/20 rounded-full transition-colors group"
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <X className="w-6 h-6 group-hover:text-destructive transition-colors" />
        </motion.button>

        {/* Timer and Queue Info with staggered animations */}
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.6, 
            ease: [0.16, 1, 0.3, 1],
            staggerChildren: 0.1 
          }}
          className="flex flex-col items-center gap-4 pt-8"
        >
          <motion.div 
            className="relative text-6xl font-bold"
            animate={{ 
              textShadow: [
                '0 0 20px hsl(var(--primary) / 0.5)',
                '0 0 40px hsl(var(--primary) / 0.8)',
                '0 0 20px hsl(var(--primary) / 0.5)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              {elapsedTime}s
            </span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground flex items-center gap-2"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-green-500"
            />
            Players in queue: <span className="font-bold text-foreground">{queueCount}</span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button 
              onClick={handleForceMatch}
              variant="outline"
              size="sm"
              className="hover:bg-primary/20"
            >
              Force Match (Test)
            </Button>
          </motion.div>
        </motion.div>

        {/* Main Content with advanced animations */}
        <div className="flex-1 flex items-center justify-center perspective-1000">
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotateY: -30 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ 
              duration: 0.8, 
              ease: [0.16, 1, 0.3, 1],
              delay: 0.2 
            }}
            className="text-center relative"
          >
            {/* Rotating icon with glow */}
            <div className="relative w-32 h-32 mx-auto mb-12">
              {/* Outer rotating ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary"
              />
              
              {/* Middle rotating ring - opposite direction */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-2 rounded-full border-2 border-accent/30 border-b-accent"
              />
              
              {/* Inner pulsing icon */}
              <motion.div
                animate={{ 
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    '0 0 20px hsl(var(--primary) / 0.5)',
                    '0 0 60px hsl(var(--accent) / 0.8)',
                    '0 0 20px hsl(var(--primary) / 0.5)',
                  ]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-4 bg-gradient-to-br from-primary via-accent to-primary rounded-full flex items-center justify-center"
              >
                <motion.div
                  animate={{ 
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ 
                    duration: 0.5,
                    repeat: Infinity,
                    repeatDelay: 1 
                  }}
                >
                  <Users className="w-12 h-12 text-white drop-shadow-lg" />
                </motion.div>
              </motion.div>
            </div>
            
            {/* Title with character stagger */}
            <motion.h1 
              className="text-6xl font-bold mb-6 tracking-wider"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {['F', 'I', 'N', 'D', 'I', 'N', 'G', ' ', 'O', 'P', 'P', 'O', 'N', 'E', 'N', 'T'].map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.03 }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xl text-muted-foreground mb-12"
            >
              Searching for worthy opponent...
            </motion.p>
            
            {/* Loading dots with bounce */}
            <div className="flex items-center justify-center gap-3">
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
                className="text-muted-foreground"
              >
                Searching
              </motion.span>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [0, -10, 0],
                      scale: [1, 1.2, 1],
                      opacity: [0.4, 1, 0.4] 
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut"
                    }}
                    className="w-3 h-3 bg-gradient-to-br from-primary to-accent rounded-full shadow-lg"
                    style={{
                      boxShadow: '0 0 10px hsl(var(--primary) / 0.5)'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Subtle particle effects around the main content */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary/60 rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                animate={{
                  x: [0, Math.cos(i * Math.PI / 4) * 150],
                  y: [0, Math.sin(i * Math.PI / 4) * 150],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.25,
                  ease: "easeOut"
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default MatchmakingScreen;
