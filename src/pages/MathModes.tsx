import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';

const MathModes: React.FC = () => {
  const navigate = useNavigate();

  const gameModes = [
    {
      id: "A1",
      title: "A1 ONLY", 
      subtitle: "AS LEVEL MATHEMATICS",
      description: "Master the fundamentals - algebraic manipulation, basic calculus, and coordinate geometry",
      difficulty: "BEGINNER",
      icon: "📚",
      gradient: "from-emerald-500 to-teal-600",
      players: "2.1M+"
    },
    {
      id: "A2", 
      title: "A1 + A2 MIXED",
      subtitle: "FULL A-LEVEL MATHEMATICS", 
      description: "Complete A-Level experience - from basics to advanced integration and differential equations",
      difficulty: "EXPERT",
      icon: "📊",
      gradient: "from-purple-500 to-pink-600",
      players: "986K+"
    },
    {
      id: "A2_ONLY",
      title: "A2 ONLY",
      subtitle: "ADVANCED MATHEMATICS",
      description: "Pure A2 content - complex calculus, advanced functions, and parametric equations", 
      difficulty: "ADVANCED",
      icon: "∫",
      gradient: "from-orange-500 to-red-600",
      players: "1.8M+"
    }
  ];

  const handleModeSelect = (modeId: string) => {
    // Navigate back to main app with math battle mode
    navigate(`/?mode=math&level=${modeId}`, { replace: true });
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
            to="/subject-selection" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Subjects
          </Link>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              Mathematics Battle Modes
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose your level and prove your mathematical prowess
            </p>
          </motion.div>

          {/* Mode Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
            {gameModes.map((mode, index) => (
              <motion.div
                key={mode.id}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                className="cyber-card p-8 hover:scale-105 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                onClick={() => handleModeSelect(mode.id)}
              >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-4xl">{mode.icon}</div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${mode.gradient} text-white`}>
                      {mode.difficulty}
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-2">{mode.title}</h3>
                  <p className="text-sm text-accent font-semibold mb-4">{mode.subtitle}</p>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{mode.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      <span className="text-sm text-muted-foreground">{mode.players} players</span>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg transition-colors">
                      <Play className="w-4 h-4" />
                      <span className="text-sm font-semibold">BATTLE</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MathModes;