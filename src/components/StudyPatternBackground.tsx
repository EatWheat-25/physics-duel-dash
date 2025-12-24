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
  Library,
  Lightbulb,
  Target,
  Rocket,
  Pencil,
  Search,
  Laptop,
  Code2,
  Puzzle,
  Globe,
  Award
} from 'lucide-react';

export const StudyPatternBackground = () => {
  // Expanded array of study-related icons for more variety
  const icons = [
    Atom, Calculator, BookOpen, Brain, 
    FlaskConical, Microscope, Pi, Sigma,
    Binary, Dna, Compass, Ruler,
    Zap, Trophy, GraduationCap, Library,
    Lightbulb, Target, Rocket, Pencil,
    Search, Laptop, Code2, Puzzle,
    Globe, Award
  ];

  // Create a larger, denser grid
  const gridIcons = Array.from({ length: 140 }).map((_, i) => {
    const Icon = icons[i % icons.length];
    return Icon;
  });

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black">
      {/* 1. High Contrast Dark Base (Black/Dark Slate) */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0f172a 0%, #000000 100%)',
        }}
      />

      {/* 2. Pattern Overlay - Cyan/Light Blue Icons */}
      <div 
        className="absolute inset-0 flex flex-wrap justify-center items-center gap-8 sm:gap-12 opacity-[0.08] p-4 -rotate-12 scale-125 origin-center"
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
            className="flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14"
          >
            <Icon 
              className="w-full h-full text-cyan-400" 
              strokeWidth={1.5}
            />
          </div>
        ))}
      </div>

      {/* 3. Stronger Vignette for focus */}
      <div className="absolute inset-0 bg-[radial-gradient(transparent_30%,#000000_100%)] opacity-90 pointer-events-none" />
      
      {/* 4. Electric Blue Glow Drifts */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-20 animate-blob-float"
        style={{ background: '#06b6d4' }} // Cyan-500
      />
      <div 
        className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-10 animate-blob-float"
        style={{ 
          background: '#3b82f6', // Blue-500
          animationDelay: '-5s' 
        }} 
      />
    </div>
  );
};
