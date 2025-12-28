import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudyPatternBackground } from '@/components/StudyPatternBackground';
import { supabase } from '@/integrations/supabase/client';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useActivePlayerCount } from '@/hooks/useActivePlayerCount';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowLeft, BookOpen, GraduationCap, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Subject = 'physics' | 'math' | 'chemistry';
type Grade = 'grade-9' | 'grade-10' | 'grade-11' | 'grade-12' | 'as-level' | 'a2-level';

const subjects = [
  { id: 'physics' as Subject, name: 'Physics', icon: '⚛️', color: 'from-cyan-500 to-blue-600' },
  { id: 'math' as Subject, name: 'Mathematics', icon: '📐', color: 'from-purple-500 to-pink-600' },
  { id: 'chemistry' as Subject, name: 'Chemistry', icon: '🧪', color: 'from-green-500 to-emerald-600' },
];

const grades = [
  { id: 'as-level' as Grade, name: 'AS Level', level: 'AS Only' },
  { id: 'a2-level' as Grade, name: 'A2 Level', level: 'A2 Only' },
  { id: 'grade-12' as Grade, name: 'AS + A2', level: 'Composite' },
];

export default function Lobby() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'subject' | 'grade' | 'ready'>('subject');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [queueTime, setQueueTime] = useState(0);
  const activePlayerCount = useActivePlayerCount();
  const { status: rawStatus, startMatchmaking, leaveQueue, match } = useMatchmaking();
  const status = rawStatus as 'idle' | 'searching' | 'matched';

  useEffect(() => {
    document.title = 'Battle Lobby | BattleNerds';
  }, []);

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

    await startMatchmaking(selectedSubject, selectedGrade);
  };

  const handleLeaveQueue = async () => {
    await leaveQueue();
  };

  const handleBack = async () => {
    if (status === 'searching') {
      await handleLeaveQueue();
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
      <StudyPatternBackground />

      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white/5 backdrop-blur-xl border border-white/10 text-white"
          aria-label="Go back"
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
                    className="inline-flex items-center gap-3 mb-4"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <BookOpen className="w-8 h-8 text-cyan-400" />
                    <h1 className="text-5xl md:text-6xl font-bold text-foreground">
                      Choose Your Subject
                    </h1>
                  </motion.div>
                  <p className="text-xl text-muted-foreground">
                    Select a subject to begin your battle
                  </p>
                  <p className="text-cyan-400 text-sm mt-2">
                    {activePlayerCount === null ? "…" : `Players online: ${activePlayerCount}`}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {subjects.map((subject, index) => (
                    <motion.button
                      key={subject.id}
                      onClick={() => handleSubjectSelect(subject.id)}
                      className="relative group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        className="relative overflow-hidden rounded-3xl p-8 h-64 flex flex-col items-center justify-center transition-all duration-300"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(40px)',
                          border: '2px solid rgba(255,255,255,0.18)',
                          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                        }}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${subject.color} opacity-10 group-hover:opacity-20 transition-opacity duration-300`}
                        />

                        <div className="relative z-10 text-center">
                          <div className="text-7xl mb-4">{subject.icon}</div>
                          <h3 className="text-3xl font-bold mb-2 text-foreground">
                            {subject.name}
                          </h3>
                          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Click to Select
                          </div>
                        </div>

                        <motion.div
                          className="absolute inset-0 rounded-3xl"
                          style={{
                            border: '2px solid rgba(88,196,255,0.6)',
                            opacity: 0,
                          }}
                          whileHover={{ opacity: 1 }}
                        />
                      </div>
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
                    className="inline-flex items-center gap-3 mb-4"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <GraduationCap className="w-8 h-8 text-magenta-400" />
                    <h1 className="text-5xl md:text-6xl font-bold text-foreground">
                      Select Your Grade
                    </h1>
                  </motion.div>
                  <p className="text-xl mb-4 text-muted-foreground">
                    Choose your academic level
                  </p>
                  {selectedSubject && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-cyan-500/20 border border-cyan-500/40 text-foreground">
                      {subjects.find(s => s.id === selectedSubject)?.icon} {subjects.find(s => s.id === selectedSubject)?.name}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {grades.map((grade, index) => (
                    <motion.button
                      key={grade.id}
                      onClick={() => handleGradeSelect(grade.id)}
                      className="relative group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        className="relative overflow-hidden rounded-2xl p-6 h-40 flex flex-col items-center justify-center transition-all duration-300"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          backdropFilter: 'blur(40px)',
                          border: '2px solid rgba(255,255,255,0.18)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                        }}
                      >
                        <div
                          className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-10 group-hover:opacity-20 transition-opacity duration-300"
                        />

                        <div className="relative z-10 text-center">
                          <h3 className="text-2xl font-bold mb-1 text-foreground">
                            {grade.name}
                          </h3>
                          <div className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full inline-block bg-purple-500/30 text-muted-foreground">
                            {grade.level}
                          </div>
                        </div>

                        <motion.div
                          className="absolute inset-0 rounded-2xl"
                          style={{
                            border: '2px solid rgba(242,55,212,0.6)',
                            opacity: 0,
                          }}
                          whileHover={{ opacity: 1 }}
                        />
                      </div>
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

                  <h1 className="text-5xl md:text-6xl font-bold mb-8 text-foreground">
                    Ready to Battle!
                  </h1>

                  <div className="flex flex-wrap gap-3 justify-center mb-8">
                    {selectedSubject && (
                      <div className="px-6 py-3 rounded-full text-lg font-bold bg-cyan-500/20 border-2 border-cyan-500/40 text-foreground">
                        {subjects.find(s => s.id === selectedSubject)?.icon} {subjects.find(s => s.id === selectedSubject)?.name}
                      </div>
                    )}

                    {selectedGrade && (
                      <div className="px-6 py-3 rounded-full text-lg font-bold bg-magenta-500/20 border-2 border-magenta-500/40 text-foreground">
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
                    {status === 'searching' ? 'STARTING...' : 'START BATTLE'}
                  </motion.button>

                  <p className="text-sm mt-6 text-muted-foreground">
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
                  <h1 className="text-4xl md:text-5xl font-bold mb-8 text-foreground">
                    Finding Opponent...
                  </h1>

                  <Loader2 className="w-20 h-20 mx-auto mb-8 animate-spin text-violet-400" />

                  <p className="text-3xl font-bold mb-8 text-foreground">
                    {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
                  </p>

                  <motion.button
                    onClick={handleLeaveQueue}
                    className="px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-magenta-400 bg-white/10 border border-white/20 text-foreground"
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
