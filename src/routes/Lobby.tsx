import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Starfield } from '@/components/Starfield';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, GraduationCap, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBattleQueueStore } from '@/store/useBattleQueueStore';

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
  const { setPendingBattle } = useBattleQueueStore();
  const [step, setStep] = useState<'subject' | 'grade' | 'ready'>('subject');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  useEffect(() => {
    document.title = 'Battle Lobby | BattleNerds';
  }, []);

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setStep('grade');
  };

  const handleGradeSelect = (grade: Grade) => {
    setSelectedGrade(grade);
    setStep('ready');
  };

  const handleStartQueue = () => {
    if (!selectedSubject || !selectedGrade) return;

    // Map grade to GameMode format
    const modeMap: Record<Grade, string> = {
      'as-level': 'AS Level',
      'a2-level': 'A2 Level', 
      'grade-9': 'Grade 9',
      'grade-10': 'Grade 10',
      'grade-11': 'Grade 11',
      'grade-12': 'AS + A2'
    };

    setPendingBattle(modeMap[selectedGrade] as any, selectedSubject);
    navigate('/');
  };

  const handleBack = () => {
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
          className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white',
          }}
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
                    <BookOpen className="w-8 h-8" style={{ color: 'var(--cyan)' }} />
                    <h1
                      className="text-5xl md:text-6xl font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Choose Your Subject
                    </h1>
                  </motion.div>
                  <p className="text-xl" style={{ color: 'var(--text-dim)' }}>
                    Select a subject to begin your battle
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
                          <h3 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                            {subject.name}
                          </h3>
                          <div
                            className="text-sm font-bold uppercase tracking-wider"
                            style={{ color: 'var(--text-dim)' }}
                          >
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
                    <GraduationCap className="w-8 h-8" style={{ color: 'var(--magenta)' }} />
                    <h1
                      className="text-5xl md:text-6xl font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Select Your Grade
                    </h1>
                  </motion.div>
                  <p className="text-xl mb-4" style={{ color: 'var(--text-dim)' }}>
                    Choose your academic level
                  </p>
                  {selectedSubject && (
                    <div
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                      style={{
                        background: 'rgba(88,196,255,0.2)',
                        border: '1px solid rgba(88,196,255,0.4)',
                        color: 'var(--text-primary)',
                      }}
                    >
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
                          <h3 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                            {grade.name}
                          </h3>
                          <div
                            className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full inline-block"
                            style={{
                              background: 'rgba(154,91,255,0.3)',
                              color: 'var(--text-dim)',
                            }}
                          >
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

            {step === 'ready' && (
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
                    <Zap className="w-20 h-20 mx-auto" style={{ color: 'var(--magenta)' }} />
                  </motion.div>

                  <h1
                    className="text-5xl md:text-6xl font-bold mb-8"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Ready to Battle!
                  </h1>

                  <div className="flex flex-wrap gap-3 justify-center mb-8">
                    {selectedSubject && (
                      <div
                        className="px-6 py-3 rounded-full text-lg font-bold"
                        style={{
                          background: 'rgba(88,196,255,0.2)',
                          border: '2px solid rgba(88,196,255,0.4)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {subjects.find(s => s.id === selectedSubject)?.icon} {subjects.find(s => s.id === selectedSubject)?.name}
                      </div>
                    )}

                    {selectedGrade && (
                      <div
                        className="px-6 py-3 rounded-full text-lg font-bold"
                        style={{
                          background: 'rgba(242,55,212,0.2)',
                          border: '2px solid rgba(242,55,212,0.4)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {grades.find(g => g.id === selectedGrade)?.name}
                      </div>
                    )}
                  </div>

                  <motion.button
                    onClick={handleStartQueue}
                    className="relative px-12 py-6 rounded-full font-bold text-2xl uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[var(--magenta)]"
                    style={{
                      background: 'linear-gradient(135deg, #ff3333, #ff6b6b)',
                      color: 'white',
                      boxShadow: '0 0 40px rgba(255,51,51,0.5)',
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
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

                  <p className="text-sm mt-6" style={{ color: 'var(--text-dim)' }}>
                    Click to find an opponent and start your match!
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
