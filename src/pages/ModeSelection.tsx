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
      gradient: 'from-blue-500 to-purple-600',
      description: 'Challenge your algebra, calculus, and analytical skills'
    },
    {
      id: 'physics',
      title: 'Physics', 
      icon: Atom,
      gradient: 'from-orange-500 to-red-600',
      description: 'Master mechanics, waves, and quantum phenomena'
    }
  ];

  const mathModes = [
    {
      id: 'A1',
      title: 'A1 ONLY',
      subtitle: 'AS Level Mathematics',
      description: 'Focus on foundational A-Level concepts',
      difficulty: 'Beginner',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'A2_ONLY', 
      title: 'A2 ONLY',
      subtitle: 'A2 Level Mathematics',
      description: 'Advanced A-Level mathematics concepts',
      difficulty: 'Advanced',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'A2',
      title: 'A1 + A2 MIXED',
      subtitle: 'Full A-Level Mathematics',
      description: 'Complete A-Level syllabus coverage', 
      difficulty: 'Expert',
      gradient: 'from-green-500 to-blue-500'
    }
  ];

  const physicsModes = [
    {
      id: 'A1',
      title: 'A1 PHYSICS',
      subtitle: 'AS Level Physics',
      description: 'Basic mechanics and waves',
      difficulty: 'Beginner',
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      id: 'A2_ONLY',
      title: 'A2 PHYSICS', 
      subtitle: 'A2 Level Physics',
      description: 'Advanced physics concepts',
      difficulty: 'Advanced',
      gradient: 'from-red-500 to-purple-500'
    },
    {
      id: 'A2',
      title: 'FULL PHYSICS',
      subtitle: 'Complete A-Level Physics',
      description: 'All physics topics combined',
      difficulty: 'Expert', 
      gradient: 'from-indigo-500 to-cyan-500'
    }
  ];

  const handleModeSelect = (mode: string) => {
    setSelectedMode(mode);
  };

  const handleStartBattle = () => {
    if (selectedSubject && selectedMode) {
      navigate('/matchmaking', { 
        state: { 
          subject: selectedSubject, 
          mode: selectedMode 
        } 
      });
    }
  };

  const getCurrentModes = () => {
    return selectedSubject === 'math' ? mathModes : physicsModes;
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
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
                <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Choose Your Subject
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Select your battlefield and dominate the competition
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl">
                {subjects.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    initial={{ x: index === 0 ? -50 : 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 + index * 0.2 }}
                  >
                    <div 
                      onClick={() => setSelectedSubject(subject.id as 'math' | 'physics')}
                      className="cyber-card p-12 hover:scale-105 transition-all duration-300 cursor-pointer group"
                    >
                      <div className="text-center">
                        <div className={`w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r ${subject.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                          <subject.icon className="w-12 h-12 text-white" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4 text-foreground">{subject.title}</h2>
                        <p className="text-lg text-muted-foreground mb-6">
                          {subject.description}
                        </p>
                        <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                          <span>Enter Battle Arena</span>
                          <motion.div
                            animate={{ x: [0, 5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            →
                          </motion.div>
                        </div>
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
                  <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {selectedSubject === 'math' ? 'Mathematics' : 'Physics'} Modes
                  </h1>
                </div>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Choose your game mode and difficulty level
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mb-12">
                {getCurrentModes().map((mode, index) => (
                  <motion.div
                    key={mode.id}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <div 
                      onClick={() => handleModeSelect(mode.id)}
                      className={`cyber-card p-8 hover:scale-105 transition-all duration-300 cursor-pointer group ${
                        selectedMode === mode.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="text-center">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${mode.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                          <span className="text-2xl font-bold text-white">
                            {mode.id === 'A1' ? 'A1' : mode.id === 'A2_ONLY' ? 'A2' : 'A★'}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2 text-foreground">{mode.title}</h3>
                        <p className="text-sm text-accent mb-3">{mode.subtitle}</p>
                        <p className="text-sm text-muted-foreground mb-4">{mode.description}</p>
                        <div className="inline-block px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                          {mode.difficulty}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Start Battle Button */}
              {selectedMode && (
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  onClick={handleStartBattle}
                  className="px-12 py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-xl rounded-lg hover:scale-105 transition-all duration-200 flex items-center gap-3"
                >
                  <Play className="w-6 h-6" />
                  START BATTLE
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;