export interface Question {
  id: string;
  q: string;
  options: string[];
  answer: number;
  chapter: string;
  level: 'A1' | 'A2';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  level: 'A1' | 'A2';
  order: number;
  requiredRankPoints: number;
  icon: string;
  questions: Question[];
}

export interface PhysicsLevel {
  id: 'A1' | 'A2_ONLY' | 'A2';
  title: string;
  description: string;
  chapters: Chapter[];
}

// A1 Physics Chapters (AS Level) - Aligned with rank progression
export const A1_CHAPTERS: Chapter[] = [
  // Bronze 1: Chapters 1-2 (0 points)
  {
    id: 'physical-quantities',
    title: 'Chapter 1: Physical Quantities',
    description: 'Base quantities, derived quantities, units, dimensions',
    level: 'A1',
    order: 1,
    requiredRankPoints: 0, // Bronze 1
    icon: '📏',
    questions: []
  },
  {
    id: 'kinematics',
    title: 'Chapter 2: Kinematics',
    description: 'Displacement, velocity, acceleration, equations of motion',
    level: 'A1',
    order: 2,
    requiredRankPoints: 0, // Bronze 1
    icon: '🏃',
    questions: []
  },
  // Bronze 2: Chapter 3 (100 points)
  {
    id: 'dynamics',
    title: 'Chapter 3: Dynamics',
    description: 'Force, mass, acceleration, Newton\'s laws of motion',
    level: 'A1',
    order: 3,
    requiredRankPoints: 100, // Bronze 2
    icon: '⚖️',
    questions: []
  },
  // Bronze 3: Chapter 4 (200 points)
  {
    id: 'force-density-pressure',
    title: 'Chapter 4: Force Density and Pressure',
    description: 'Force density, pressure, Pascal\'s principle, Archimedes\' principle',
    level: 'A1',
    order: 4,
    requiredRankPoints: 200, // Bronze 3
    icon: '💨',
    questions: []
  },
  // Silver 1: Chapter 5 (300 points)
  {
    id: 'work-power-energy',
    title: 'Chapter 5: Work, Power and Energy',
    description: 'Work done, power, kinetic energy, potential energy, conservation of energy',
    level: 'A1',
    order: 5,
    requiredRankPoints: 300, // Silver 1
    icon: '⚡',
    questions: []
  },
  // Silver 2: Chapter 6 (400 points)
  {
    id: 'deformation-solids',
    title: 'Chapter 6: Deformation of Solids',
    description: 'Stress, strain, Young\'s modulus, elastic and plastic deformation',
    level: 'A1',
    order: 6,
    requiredRankPoints: 400, // Silver 2
    icon: '🔩',
    questions: []
  },
  // Silver 3: Chapter 7 (500 points)
  {
    id: 'waves',
    title: 'Chapter 7: Waves',
    description: 'Wave properties, interference, diffraction, standing waves',
    level: 'A1',
    order: 7,
    requiredRankPoints: 500, // Silver 3
    icon: '🌊',
    questions: []
  },
  // Gold 1: Chapter 8 (600 points)
  {
    id: 'superpositions',
    title: 'Chapter 8: Superpositions',
    description: 'Principle of superposition, interference patterns, beats, standing waves',
    level: 'A1',
    order: 8,
    requiredRankPoints: 600, // Gold 1
    icon: '🌐',
    questions: []
  },
  // Gold 2: Chapter 9 (700 points)
  {
    id: 'current-electricity',
    title: 'Chapter 9: Current of Electricity',
    description: 'Electric current, potential difference, resistance, Ohm\'s law',
    level: 'A1',
    order: 9,
    requiredRankPoints: 700, // Gold 2
    icon: '🔌',
    questions: []
  },
  // Gold 3: Chapter 10 (800 points)
  {
    id: 'dc-circuits',
    title: 'Chapter 10: DC Circuits',
    description: 'Series & parallel circuits, Kirchhoff\'s laws, power in circuits',
    level: 'A1',
    order: 10,
    requiredRankPoints: 800, // Gold 3
    icon: '🔗',
    questions: []
  },
  // Platinum 1: Chapter 11 (900 points)
  {
    id: 'nuclear-physics',
    title: 'Chapter 11: Nuclear Physics',
    description: 'Atomic structure, radioactivity, nuclear reactions, decay',
    level: 'A1',
    order: 11,
    requiredRankPoints: 900, // Platinum 1
    icon: '☢️',
    questions: []
  }
];

// A2 Physics Chapters (Additional A Level content)
export const A2_CHAPTERS: Chapter[] = [
  {
    id: 'thermodynamics',
    title: 'Thermodynamics',
    description: 'Heat engines, entropy, gas laws',
    level: 'A2',
    order: 6,
    requiredRankPoints: 600, // Silver 3
    icon: '🌡️',
    questions: [
      {
        id: 'thermo1-1',
        q: "Which of the following is a vector quantity?",
        options: ["Mass", "Temperature", "Displacement", "Speed"],
        answer: 2,
        chapter: 'thermodynamics',
        level: 'A2',
        difficulty: 'medium'
      }
    ]
  },
  {
    id: 'quantum-physics',
    title: 'Quantum Physics',
    description: 'Photons, wave-particle duality, atomic structure',
    level: 'A2',
    order: 7,
    requiredRankPoints: 1200, // Diamond 1
    icon: '⚛️',
    questions: []
  },
  {
    id: 'nuclear-physics',
    title: 'Nuclear Physics',
    description: 'Radioactivity, nuclear reactions, decay',
    level: 'A2',
    order: 8,
    requiredRankPoints: 1400, // Diamond 3
    icon: '☢️',
    questions: []
  }
];

export const PHYSICS_LEVELS: PhysicsLevel[] = [
  {
    id: 'A1',
    title: 'A1 Physics (AS Level)',
    description: 'Foundation physics concepts for AS Level',
    chapters: A1_CHAPTERS
  },
  {
    id: 'A2',
    title: 'A2 Physics (A Level Full)',
    description: 'Complete A Level physics including A1 + A2 content',
    chapters: [...A1_CHAPTERS, ...A2_CHAPTERS]
  },
  {
    id: 'A2_ONLY',
    title: 'A2 Physics Only',
    description: 'Advanced A2 Level physics content only',
    chapters: A2_CHAPTERS
  }
];

export const getUnlockedChapters = (level: 'A1' | 'A2_ONLY' | 'A2', currentPoints: number): Chapter[] => {
  const physicsLevel = PHYSICS_LEVELS.find(l => l.id === level);
  if (!physicsLevel) return [];
  
  // For Diamond ranks (1200+ points), unlock ALL chapters
  if (currentPoints >= 1200) {
    return physicsLevel.chapters;
  }
  
  // For Platinum 2+ (1000+ points), mix and integrate earlier chapters
  if (currentPoints >= 1000) {
    return physicsLevel.chapters.filter(chapter => 
      currentPoints >= chapter.requiredRankPoints
    );
  }
  
  // Standard progression for Bronze to Platinum 1
  return physicsLevel.chapters.filter(chapter => 
    currentPoints >= chapter.requiredRankPoints
  );
};

export const getNewlyUnlockedChapters = (level: 'A1' | 'A2_ONLY' | 'A2', oldPoints: number, newPoints: number): Chapter[] => {
  const physicsLevel = PHYSICS_LEVELS.find(l => l.id === level);
  if (!physicsLevel) return [];
  
  const oldUnlocked = getUnlockedChapters(level, oldPoints);
  const newUnlocked = getUnlockedChapters(level, newPoints);
  
  return newUnlocked.filter(chapter => 
    !oldUnlocked.some(oldChapter => oldChapter.id === chapter.id)
  );
};

export const getQuestionsFromChapters = (chapters: Chapter[], count: number = 5): Question[] => {
  const allQuestions: Question[] = [];
  chapters.forEach(chapter => {
    allQuestions.push(...chapter.questions);
  });
  
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, allQuestions.length));
};

// Get questions based on rank progression (automatic chapter filtering)
export const getQuestionsByRank = (level: 'A1' | 'A2_ONLY' | 'A2', currentPoints: number, count: number = 5): Question[] => {
  const unlockedChapters = getUnlockedChapters(level, currentPoints);
  return getQuestionsFromChapters(unlockedChapters, count);
};