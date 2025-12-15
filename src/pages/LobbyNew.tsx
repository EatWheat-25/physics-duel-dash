import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Zap, ArrowLeft, BookOpen, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { Starfield } from '@/components/Starfield';
import { toast } from 'sonner';

type Subject = 'physics' | 'math' | 'chemistry';
type Grade = 'A1' | 'A2' | 'Both';

const subjects = [
  { id: 'physics' as Subject, name: 'Physics', icon: '⚛️', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)' },
  { id: 'math' as Subject, name: 'Mathematics', icon: '📐', color: '#60a5fa', glow: 'rgba(96, 165, 250, 0.5)' },
  { id: 'chemistry' as Subject, name: 'Chemistry', icon: '🧪', color: '#4a9eff', glow: 'rgba(74, 158, 255, 0.5)' },
];

const grades = [
  { id: 'A1' as Grade, name: 'AS Level (A1)', description: 'AS Level Only' },
  { id: 'A2' as Grade, name: 'A2 Level', description: 'A2 Level Only' },
  { id: 'Both' as Grade, name: 'AS + A2', description: 'Both Levels' },
];

export default function LobbyNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'subject' | 'grade' | 'ready'>('subject');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [queueTime, setQueueTime] = useState(0);
  const [isButtonLoading, setIsButtonLoading] = useState(false);
  const { status, startMatchmaking, leaveQueue, match } = useMatchmaking();

  // Navigate to battle when matched
  useEffect(() => {
    if (status === 'matched' && match) {
      navigate(`/online-battle-new/${match.id}`, {
        state: { match }
      });
    }
  }, [status, match, navigate]);

  // Reset button loading state when status changes
  useEffect(() => {
    if (status === 'searching') {
      setIsButtonLoading(false); // Status hook will handle the searching state
    } else if (status === 'idle' || status === 'matched') {
      setIsButtonLoading(false);
    }
  }, [status]);

  // Update queue time when searching
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'searching') {
      setQueueTime(0);
      interval = setInterval(() => {
        setQueueTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setStep('grade');
  };

  const handleGradeSelect = (grade: Grade) => {
    setSelectedGrade(grade);
    setStep('ready');
  };

  const handleStartQueue = async () => {
    if (!selectedSubject || !selectedGrade || status === 'searching' || isButtonLoading) return;
    
    // Immediately show loading state for instant feedback
    setIsButtonLoading(true);
    
    // Normalize values as safety net (authoritative normalization is in matchmake-simple)
    let subject = selectedSubject;
    let level = selectedGrade;
    
    // Normalize subject: 'maths' → 'math'
    if (subject === 'maths') subject = 'math';
    
    // Normalize level: ensure uppercase 'A1' or 'A2'
    if (level === 'Both') level = 'A2';
    if (level.toLowerCase() === 'a1') level = 'A1';
    if (level.toLowerCase() === 'a2') level = 'A2';
    
    // Fire async operation without blocking
    startMatchmaking(subject, level).catch((error) => {
      console.error('[LobbyNew] Matchmaking error:', error);
      setIsButtonLoading(false);
    });
  };

  const handleLeaveQueue = async () => {
    await leaveQueue();
    setStep('ready');
    setQueueTime(0);
  };

  const handleBack = () => {
    if (status === 'searching') {
      handleLeaveQueue();
    }
    if (step === 'grade') {
      setStep('subject');
      setSelectedGrade(null);
    } else if (step === 'ready') {
      setStep('grade');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Grid overlay for game aesthetic */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      <Starfield />
      
      <div className="absolute top-4 left-4 z-20">
        <motion.button
          onClick={handleBack}
          className="gap-2 px-4 py-2 font-bold uppercase tracking-wider bg-slate-800/80 backdrop-blur-sm border-2 border-slate-600 text-white hover:border-blue-400 hover:bg-slate-700/80 transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </motion.button>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20">
        <div className="w-full max-w-6xl">
          <AnimatePresence mode="wait">
            {step === 'subject' && (
              <motion.div
                key="subject"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-12">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="mb-8"
                  >
                    <div className="relative inline-block">
                      <BookOpen className="w-20 h-20 mx-auto text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)]" />
                      <motion.div
                        className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-50"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.3, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </motion.div>
                  <motion.h1 
                    className="text-5xl md:text-6xl font-bold mb-4 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    CHOOSE YOUR SUBJECT
                  </motion.h1>
                  <motion.p 
                    className="text-xl text-slate-300 font-mono"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Select the subject you want to battle in
                  </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {subjects.map((subject, index) => (
                    <motion.button
                      key={subject.id}
                      onClick={() => handleSubjectSelect(subject.id)}
                      className="relative p-8 rounded-lg bg-slate-800/90 border-2 border-slate-600 text-white overflow-hidden group backdrop-blur-sm"
                      style={{
                        boxShadow: `0 0 30px ${subject.glow}, inset 0 0 20px rgba(0,0,0,0.3)`,
                      }}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index, type: 'spring' }}
                      whileHover={{ 
                        scale: 1.05,
                        borderColor: subject.color,
                        boxShadow: `0 0 50px ${subject.glow}, 0 0 100px ${subject.glow}, inset 0 0 20px rgba(0,0,0,0.3)`,
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Animated border glow */}
                      <motion.div
                        className="absolute inset-0 rounded-lg"
                        style={{
                          border: `2px solid ${subject.color}`,
                          opacity: 0,
                        }}
                        animate={{
                          opacity: [0, 0.8, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                      
                      <div className="relative z-10">
                        <motion.div 
                          className="text-6xl mb-4"
                          animate={{ 
                            y: [0, -5, 0],
                            rotate: [0, 5, -5, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        >
                          {subject.icon}
                        </motion.div>
                        <h2 className="text-2xl font-bold font-mono uppercase tracking-wider">{subject.name}</h2>
                      </div>
                      
                      {/* Hover effect overlay */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/20"
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                      />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'grade' && (
              <motion.div
                key="grade"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-12">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="mb-8"
                  >
                    <div className="relative inline-block">
                      <GraduationCap className="w-20 h-20 mx-auto text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)]" />
                      <motion.div
                        className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-50"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.3, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </motion.div>
                  <motion.h1 
                    className="text-5xl md:text-6xl font-bold mb-4 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    CHOOSE YOUR LEVEL
                  </motion.h1>
                  <motion.p 
                    className="text-xl text-slate-300 font-mono"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Select your difficulty level
                  </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {grades.map((grade, index) => (
                    <motion.button
                      key={grade.id}
                      onClick={() => handleGradeSelect(grade.id)}
                      className="relative p-8 rounded-lg bg-slate-800/90 border-2 border-slate-600 text-white overflow-hidden group backdrop-blur-sm"
                      style={{
                        boxShadow: '0 0 30px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(0,0,0,0.3)',
                      }}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index, type: 'spring' }}
                      whileHover={{ 
                        scale: 1.05,
                        borderColor: '#3b82f6',
                        boxShadow: '0 0 50px rgba(59, 130, 246, 0.6), 0 0 100px rgba(59, 130, 246, 0.4), inset 0 0 20px rgba(0,0,0,0.3)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Animated border glow */}
                      <motion.div
                        className="absolute inset-0 rounded-lg border-2 border-blue-400"
                        animate={{
                          opacity: [0, 0.8, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                      
                      <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2 font-mono uppercase tracking-wider">{grade.name}</h2>
                        <p className="text-slate-300 font-mono">{grade.description}</p>
                      </div>
                      
                      {/* Hover effect overlay */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/20"
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                      />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'ready' && status !== 'searching' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center"
              >
                <div
                  className="relative rounded-lg p-12 text-center max-w-2xl w-full border-2 border-slate-600"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.9), rgba(15, 23, 42, 0.9))',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 0 50px rgba(59, 130, 246, 0.1)',
                  }}
                >
                  {/* Corner decorations */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400" />
                  
                  {/* Animated border glow */}
                  <motion.div
                    className="absolute inset-0 rounded-lg border-2 border-blue-400"
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="mb-8"
                  >
                    <div className="relative inline-block">
                      <Zap className="w-20 h-20 mx-auto text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)]" />
                      <motion.div
                        className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-50"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </motion.div>

                  <motion.h1 
                    className="text-5xl md:text-6xl font-bold mb-8 text-white font-mono uppercase tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    READY TO BATTLE!
                  </motion.h1>

                  <div className="flex flex-wrap gap-3 justify-center mb-8">
                    {selectedSubject && (
                      <motion.div 
                        className="px-6 py-3 rounded-lg text-lg font-bold bg-slate-700/80 border-2 border-blue-400 text-white font-mono uppercase tracking-wider"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        style={{
                          boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                        }}
                      >
                        {subjects.find(s => s.id === selectedSubject)?.icon} {subjects.find(s => s.id === selectedSubject)?.name}
                      </motion.div>
                    )}

                    {selectedGrade && (
                      <motion.div 
                        className="px-6 py-3 rounded-lg text-lg font-bold bg-slate-700/80 border-2 border-blue-400 text-white font-mono uppercase tracking-wider"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        style={{
                          boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                        }}
                      >
                        {grades.find(g => g.id === selectedGrade)?.name}
                      </motion.div>
                    )}
                  </div>

                  <motion.button
                    onClick={handleStartQueue}
                    disabled={status === 'searching' || isButtonLoading}
                    className="relative px-12 py-6 rounded-lg font-bold text-2xl uppercase tracking-wider transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br from-blue-600 to-blue-500 text-white font-mono border-2 border-blue-400 overflow-hidden"
                    style={{
                      boxShadow: '0 0 40px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(0,0,0,0.2)',
                    }}
                    whileHover={status !== 'searching' && !isButtonLoading ? { 
                      scale: 1.05,
                      boxShadow: '0 0 60px rgba(59, 130, 246, 0.9), 0 0 100px rgba(59, 130, 246, 0.5), inset 0 0 20px rgba(0,0,0,0.2)',
                    } : {}}
                    whileTap={status !== 'searching' && !isButtonLoading ? { 
                      scale: 0.95,
                    } : {}}
                    animate={{
                      boxShadow: status !== 'searching' && !isButtonLoading ? [
                        '0 0 40px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(0,0,0,0.2)',
                        '0 0 60px rgba(59, 130, 246, 0.9), 0 0 100px rgba(59, 130, 246, 0.5), inset 0 0 20px rgba(0,0,0,0.2)',
                        '0 0 40px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(0,0,0,0.2)',
                      ] : '0 0 40px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(0,0,0,0.2)',
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: status !== 'searching' && !isButtonLoading ? Infinity : 0,
                      ease: 'easeInOut',
                    }}
                  >
                    {/* Animated background gradient sweep */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                    
                    {/* Content */}
                    <span className="relative z-10 flex items-center justify-center">
                      {isButtonLoading || status === 'searching' ? (
                        <>
                          <Loader2 className="w-6 h-6 inline mr-2 animate-spin" />
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            STARTING...
                          </motion.span>
                        </>
                      ) : (
                        <>
                          <motion.div
                            animate={{
                              rotate: [0, 15, -15, 0],
                            }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              repeatDelay: 1,
                            }}
                          >
                            <Zap className="w-6 h-6 inline mr-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                          </motion.div>
                          <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">START BATTLE</span>
                        </>
                      )}
                    </span>
                    
                    {/* Pulse ring effect */}
                    {!isButtonLoading && status !== 'searching' && (
                      <motion.div
                        className="absolute inset-0 rounded-lg border-2 border-blue-300"
                        animate={{
                          scale: [1, 1.15, 1],
                          opacity: [0.8, 0, 0.8],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    )}
                  </motion.button>

                  <motion.p 
                    className="text-sm mt-6 text-slate-400 font-mono"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    Click to find an opponent and start your match!
                  </motion.p>
                </div>
              </motion.div>
            )}

            {status === 'searching' && (
              <motion.div
                key="queued"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-center"
              >
                <div
                  className="relative rounded-lg p-12 text-center max-w-2xl w-full border-2 border-slate-600"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.9), rgba(15, 23, 42, 0.9))',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 0 50px rgba(59, 130, 246, 0.1)',
                  }}
                >
                  {/* Corner decorations */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400" />
                  
                  {/* Animated border glow */}
                  <motion.div
                    className="absolute inset-0 rounded-lg border-2 border-blue-400"
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  
                  <motion.h1 
                    className="text-4xl md:text-5xl font-bold mb-8 text-white font-mono uppercase tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    FINDING OPPONENT...
                  </motion.h1>

                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="mb-8"
                  >
                    <Loader2 className="w-20 h-20 mx-auto text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)]" />
                  </motion.div>

                  <motion.p 
                    className="text-4xl font-bold mb-8 text-white font-mono"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
                  </motion.p>

                  <motion.button
                    onClick={handleLeaveQueue}
                    className="px-8 py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-300 focus:outline-none bg-slate-700/80 border-2 border-slate-600 text-white font-mono hover:border-blue-400 hover:bg-slate-600/80"
                    style={{
                      boxShadow: '0 0 20px rgba(0,0,0,0.3)',
                    }}
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: '0 0 30px rgba(59, 130, 246, 0.5)',
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel Search
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

