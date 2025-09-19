import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Atom, Play } from 'lucide-react';

const ModeSelection: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<'math' | 'physics' | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const navigate = useNavigate();

  const subjects = [
    {
      id: 'math',
      title: 'Mathematics',
      icon: Calculator,
      description: 'Challenge your algebra, calculus, and analytical skills'
    },
    {
      id: 'physics',
      title: 'Physics', 
      icon: Atom,
      description: 'Master mechanics, waves, and quantum phenomena'
    }
  ];

  const mathModes = [
    {
      id: 'A1',
      title: 'A1 ONLY',
      subtitle: 'AS Level Mathematics',
      description: 'Focus on foundational A-Level concepts',
      difficulty: 'Beginner'
    },
    {
      id: 'A2_ONLY', 
      title: 'A2 ONLY',
      subtitle: 'A2 Level Mathematics',
      description: 'Advanced A-Level mathematics concepts',
      difficulty: 'Advanced'
    },
    {
      id: 'A2',
      title: 'A1 + A2 MIXED',
      subtitle: 'Full A-Level Mathematics',
      description: 'Complete A-Level syllabus coverage', 
      difficulty: 'Expert'
    }
  ];

  const physicsModes = [
    {
      id: 'A1',
      title: 'A1 PHYSICS',
      subtitle: 'AS Level Physics',
      description: 'Basic mechanics and waves',
      difficulty: 'Beginner'
    },
    {
      id: 'A2_ONLY',
      title: 'A2 PHYSICS', 
      subtitle: 'A2 Level Physics',
      description: 'Advanced physics concepts',
      difficulty: 'Advanced'
    },
    {
      id: 'A2',
      title: 'FULL PHYSICS',
      subtitle: 'Complete A-Level Physics',
      description: 'All physics topics combined',
      difficulty: 'Expert'
    }
  ];

  const handleModeSelect = (mode: string) => {
    if (selectedSubject) {
      // Directly navigate to homepage with selected subject and mode
      navigate(`/?subject=${selectedSubject}&mode=${mode}`);
    }
  };

  const getCurrentModes = () => {
    return selectedSubject === 'math' ? mathModes : physicsModes;
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-3 text-muted-foreground hover:text-foreground transition-all duration-200 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          {!selectedSubject ? (
            <>
              {/* Subject Selection */}
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="text-center mb-16"
              >
                <h1 className="text-5xl font-bold mb-6 text-foreground">
                  Choose Your Subject
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Select your preferred subject to begin your learning journey
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                {subjects.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <div 
                      onClick={() => setSelectedSubject(subject.id as 'math' | 'physics')}
                      className="cyber-card p-10 cursor-pointer group"
                    >
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
                          <subject.icon className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold mb-4 text-foreground">{subject.title}</h2>
                        <p className="text-muted-foreground leading-relaxed">
                          {subject.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Mode Selection */}
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="text-center mb-16"
              >
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button 
                    onClick={() => setSelectedSubject(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h1 className="text-4xl font-bold text-foreground">
                    {selectedSubject === 'math' ? 'Mathematics' : 'Physics'} Modes
                  </h1>
                </div>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Select your preferred difficulty level and start learning
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
                {getCurrentModes().map((mode, index) => (
                  <motion.div
                    key={mode.id}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div 
                      onClick={() => handleModeSelect(mode.id)}
                      className="cyber-card p-8 cursor-pointer group"
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-all duration-300">
                          <span className="text-lg font-bold text-accent">
                            {mode.id === 'A1' ? 'A1' : mode.id === 'A2_ONLY' ? 'A2' : 'A★'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-foreground">{mode.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3 font-medium">{mode.subtitle}</p>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{mode.description}</p>
                        <div className="inline-block px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                          {mode.difficulty}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;