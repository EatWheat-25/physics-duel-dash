import React from 'react';
import { 
  Atom, 
  BookOpen, 
  Calculator, 
  Brain, 
  FlaskConical, 
  Microscope, 
  Pi, 
  Sigma, 
  Binary, 
  Dna,
  Compass,
  Ruler,
  Zap,
  Trophy,
  GraduationCap,
  Library
} from 'lucide-react';

export const StudyPatternBackground = () => {
  // Array of study-related icons to tile
  const icons = [
    Atom, Calculator, BookOpen, Brain, 
    FlaskConical, Microscope, Pi, Sigma,
    Binary, Dna, Compass, Ruler,
    Zap, Trophy, GraduationCap, Library
  ];

  // Create a grid of icons
  // We'll repeat the icon set multiple times to fill the screen
  const gridIcons = Array.from({ length: 100 }).map((_, i) => {
    const Icon = icons[i % icons.length];
    return Icon;
  });

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-950">
      {/* 1. Deep Dark Base */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #020617 100%)',
        }}
      />

      {/* 2. Pattern Overlay */}
      <div 
        className="absolute inset-0 flex flex-wrap justify-center items-center gap-12 sm:gap-16 opacity-[0.03] p-8 -rotate-12 scale-125 origin-center"
        style={{
          width: '150%',
          height: '150%',
          left: '-25%',
          top: '-25%',
        }}
      >
        {gridIcons.map((Icon, index) => (
          <div 
            key={index} 
            className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16"
          >
            <Icon 
              className="w-full h-full text-white" 
              strokeWidth={1.5}
            />
          </div>
        ))}
      </div>

      {/* 3. Subtle Vignette & Gradient Overlay for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(transparent_0%,#020617_100%)] opacity-80 pointer-events-none" />
      
      {/* 4. Optional: Very slow drift animation to keep it alive */}
      <div 
        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 animate-pulse" 
        style={{ animationDuration: '8s' }}
      />
    </div>
  );
};
