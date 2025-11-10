import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { useSubjectStore, Subject, Mode } from '@/store/useSubjectStore';

const CHAPTERS = {
  physics: [
    { id: 'mechanics', name: 'Mechanics' },
    { id: 'waves', name: 'Waves' },
    { id: 'electricity', name: 'Electricity' },
    { id: 'magnetism', name: 'Magnetism' },
  ],
  maths: [
    { id: 'algebra', name: 'Algebra' },
    { id: 'calculus', name: 'Calculus' },
    { id: 'statistics', name: 'Statistics' },
    { id: 'mechanics-maths', name: 'Mechanics' },
  ],
};

interface ModeOption {
  id: Mode;
  label: string;
  description: string;
}

const MODES: ModeOption[] = [
  { id: 'ranked', label: '1v1 Ranked', description: 'Competitive ranked match' },
  { id: 'quick', label: 'Quick Match', description: 'Fast casual battle' },
  { id: 'study', label: 'Study Mode', description: 'Practice at your pace' },
  { id: 'daily', label: 'Daily Challenge', description: 'Complete today\'s challenge' },
];

export function TopLeftSelect() {
  const navigate = useNavigate();
  const { subject, setSelection } = useSubjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'subject' | 'mode' | 'chapter'>('subject');
  const [selectedSubject, setSelectedSubject] = useState<Subject>(subject);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  const handleOpen = () => {
    setIsOpen(true);
    setStep('subject');
    setSelectedSubject(subject);
    setSelectedMode(null);
    setSelectedChapter(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep('subject');
  };

  const handleSubjectSelect = (newSubject: Subject) => {
    setSelectedSubject(newSubject);
    setStep('mode');
  };

  const handleModeSelect = (mode: Mode) => {
    setSelectedMode(mode);
    if (mode === 'ranked' || mode === 'quick') {
      setStep('chapter');
    } else {
      handleConfirm(mode);
    }
  };

  const handleChapterSelect = (chapter: string) => {
    setSelectedChapter(chapter);
    handleConfirm(selectedMode!, chapter);
  };

  const handleConfirm = (mode: Mode, chapter?: string) => {
    setSelection(selectedSubject, mode, chapter || undefined);
    setIsOpen(false);
    navigate(`/lobby?subject=${selectedSubject}&mode=${mode}${chapter ? `&chapter=${chapter}` : ''}`);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-primary)',
        }}
        aria-label="Select subject and mode"
      >
        <ListFilter className="w-4 h-4" />
        <span>Select</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              aria-hidden="true"
            />

            <motion.div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="select-dialog-title"
            >
              <div
                className="rounded-3xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(40px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
              >
                {step === 'subject' && (
                  <div>
                    <h2
                      id="select-dialog-title"
                      className="text-2xl font-bold mb-6 text-center"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Choose Subject
                    </h2>
                    <div className="space-y-3">
                      {(['physics', 'maths'] as Subject[]).map((subj) => (
                        <motion.button
                          key={subj}
                          onClick={() => handleSubjectSelect(subj)}
                          className="w-full p-4 rounded-2xl text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
                          style={{
                            background:
                              selectedSubject === subj
                                ? 'rgba(154,91,255,0.2)'
                                : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${
                              selectedSubject === subj
                                ? 'rgba(154,91,255,0.4)'
                                : 'rgba(255,255,255,0.1)'
                            }`,
                            color: 'var(--text-primary)',
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="text-lg font-bold uppercase tracking-wide">
                            {subj}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 'mode' && (
                  <div>
                    <h2
                      className="text-2xl font-bold mb-6 text-center"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Choose Mode
                    </h2>
                    <div className="space-y-3">
                      {MODES.map((mode) => (
                        <motion.button
                          key={mode.id}
                          onClick={() => handleModeSelect(mode.id)}
                          className="w-full p-4 rounded-2xl text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-primary)',
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="font-bold text-lg">{mode.label}</div>
                          <div className="text-sm" style={{ color: 'var(--text-dim)' }}>
                            {mode.description}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setStep('subject')}
                      className="mt-4 w-full"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      ← Back
                    </Button>
                  </div>
                )}

                {step === 'chapter' && (
                  <div>
                    <h2
                      className="text-2xl font-bold mb-6 text-center"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Choose Chapter
                    </h2>
                    <div className="space-y-3">
                      {CHAPTERS[selectedSubject].map((chapter) => (
                        <motion.button
                          key={chapter.id}
                          onClick={() => handleChapterSelect(chapter.id)}
                          className="w-full p-4 rounded-2xl text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-primary)',
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="font-bold">{chapter.name}</div>
                        </motion.button>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setStep('mode')}
                      className="mt-4 w-full"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      ← Back
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
