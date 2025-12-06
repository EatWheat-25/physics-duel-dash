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
  { id: 'physics' as Subject, name: 'Physics', icon: '⚛️', color: 'from-cyan-500 to-blue-600' },
  { id: 'math' as Subject, name: 'Mathematics', icon: '📐', color: 'from-purple-500 to-pink-600' },
  { id: 'chemistry' as Subject, name: 'Chemistry', icon: '🧪', color: 'from-green-500 to-emerald-600' },
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
  const { status, startMatchmaking, leaveQueue, match } = useMatchmaking();

  // Navigate to battle when matched
  useEffect(() => {
    if (status === 'matched' && match) {
      navigate(`/online-battle-new/${match.id}`, {
        state: { match }
      });
    }
  }, [status, match, navigate]);

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
    if (!selectedSubject || !selectedGrade || status === 'searching') return;
    await startMatchmaking();
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
    <div className="relative min-h-screen overflow-hidden">
      <Starfield />
      
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white/5 backdrop-blur-xl border border-white/10 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
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
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="mb-8"
                  >
                    <BookOpen className="w-20 h-20 mx-auto text-violet-400" />
                  </motion.div>
                  <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white">
                    Choose Your Subject
                  </h1>
                  <p className="text-xl text-gray-300">Select the subject you want to battle in</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {subjects.map((subject) => (
                    <motion.button
                      key={subject.id}
                      onClick={() => handleSubjectSelect(subject.id)}
                      className="relative p-8 rounded-2xl bg-gradient-to-br text-white overflow-hidden group"
                      style={{
                        background: `linear-gradient(135deg, ${subject.color.split(' ')[0]}, ${subject.color.split(' ')[2]})`,
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="relative z-10">
                        <div className="text-6xl mb-4">{subject.icon}</div>
                        <h2 className="text-2xl font-bold">{subject.name}</h2>
                      </div>
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
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
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="mb-8"
                  >
                    <GraduationCap className="w-20 h-20 mx-auto text-violet-400" />
                  </motion.div>
                  <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white">
                    Choose Your Level
                  </h1>
                  <p className="text-xl text-gray-300">Select your difficulty level</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {grades.map((grade) => (
                    <motion.button
                      key={grade.id}
                      onClick={() => handleGradeSelect(grade.id)}
                      className="p-8 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <h2 className="text-2xl font-bold mb-2">{grade.name}</h2>
                      <p className="text-gray-300">{grade.description}</p>
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
                  className="rounded-3xl p-12 text-center max-w-2xl w-full"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="mb-8"
                  >
                    <Zap className="w-20 h-20 mx-auto text-magenta-400" />
                  </motion.div>

                  <h1 className="text-5xl md:text-6xl font-bold mb-8 text-white">
                    Ready to Battle!
                  </h1>

                  <div className="flex flex-wrap gap-3 justify-center mb-8">
                    {selectedSubject && (
                      <div className="px-6 py-3 rounded-full text-lg font-bold bg-cyan-500/20 border-2 border-cyan-500/40 text-white">
                        {subjects.find(s => s.id === selectedSubject)?.icon} {subjects.find(s => s.id === selectedSubject)?.name}
                      </div>
                    )}

                    {selectedGrade && (
                      <div className="px-6 py-3 rounded-full text-lg font-bold bg-magenta-500/20 border-2 border-magenta-500/40 text-white">
                        {grades.find(g => g.id === selectedGrade)?.name}
                      </div>
                    )}
                  </div>

                  <motion.button
                    onClick={handleStartQueue}
                    disabled={status === 'searching'}
                    className="relative px-12 py-6 rounded-full font-bold text-2xl uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-magenta-400 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br from-red-500 to-red-400 text-white shadow-[0_0_40px_rgba(255,51,51,0.5)]"
                    whileHover={status !== 'searching' ? { scale: 1.1 } : {}}
                    whileTap={status !== 'searching' ? { scale: 0.95 } : {}}
                    animate={{
                      boxShadow: [
                        '0 0 40px rgba(255,51,51,0.5)',
                        '0 0 60px rgba(255,51,51,0.7)',
                        '0 0 40px rgba(255,51,51,0.5)',
                      ],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <Zap className="w-6 h-6 inline mr-2" />
                    START BATTLE
                  </motion.button>

                  <p className="text-sm mt-6 text-gray-400">
                    Click to find an opponent and start your match!
                  </p>
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
                  className="rounded-3xl p-12 text-center max-w-2xl w-full"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                  }}
                >
                  <h1 className="text-4xl md:text-5xl font-bold mb-8 text-white">
                    Finding Opponent...
                  </h1>

                  <Loader2 className="w-20 h-20 mx-auto mb-8 animate-spin text-violet-400" />

                  <p className="text-3xl font-bold mb-8 text-white">
                    {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
                  </p>

                  <motion.button
                    onClick={handleLeaveQueue}
                    className="px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-magenta-400 bg-white/10 border border-white/20 text-white"
                    whileHover={{ scale: 1.05 }}
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

